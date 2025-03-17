import json
import bleach
from flask import Blueprint, request, jsonify
from .models import ExerciseQuestion, ExerciseAnswer, User, db
from .exercise import decode_token

question_blueprint = Blueprint('questions', __name__)

@question_blueprint.route('/api/exercise/<int:exercise_id>/questions', methods=['POST'])
def create_question(exercise_id):
    """
    Crea una nueva pregunta para un ejercicio, con soporte para 'abierta' o 'multiple_choice'.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded['user_id'])
    if not user or not user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    data = request.json

    # Saneamos texto y cuerpo
    question_text = bleach.clean(data.get('question_text', ''))
    question_body = bleach.clean(data.get('question_body') or "")
    question_type = data.get('question_type', 'abierta')
    score = data.get('score', 0)

    if not question_text:
        return jsonify({'error': 'question_text is required'}), 400

    # Manejo de choices
    choices_str = ""
    if question_type == "multiple_choice":
        raw_choices = data.get('choices', [])
        # Si es un string, parsearlo como JSON
        if isinstance(raw_choices, str):
            try:
                raw_choices = json.loads(raw_choices)
            except json.JSONDecodeError:
                return jsonify({'error': 'Formato inválido en choices'}), 400

        # Debe ser una lista y tener al menos 2 opciones
        if not isinstance(raw_choices, list) or len(raw_choices) < 2:
            return jsonify({'error': 'Debe haber al menos 2 opciones'}), 400

        sanitized_options = []
        for option in raw_choices:
            if isinstance(option, dict):
                # Copiamos para no modificar el original
                sanitized_option = option.copy()
                sanitized_option['text'] = bleach.clean(option.get('text', ''))
                # Si no existe la clave 'correct', la forzamos a False
                sanitized_option.setdefault('correct', False)
                sanitized_options.append(sanitized_option)
            elif isinstance(option, str):
                # Si el frontend envió un string simple
                sanitized_options.append({'text': bleach.clean(option), 'correct': False})
            else:
                # Cualquier otro tipo se convierte a string
                sanitized_options.append({'text': bleach.clean(str(option)), 'correct': False})

        choices_str = json.dumps(sanitized_options)
    else:
        choices_str = ""

    new_q = ExerciseQuestion(
        exercise_id=exercise_id,
        question_text=question_text,
        question_body=question_body,
        question_type=question_type,
        choices=choices_str,
        score=score
    )
    db.session.add(new_q)
    db.session.commit()

    return jsonify({'message': 'Question created', 'question_id': new_q.id}), 201


@question_blueprint.route('/api/exercise/<int:exercise_id>/question/<int:question_id>', methods=['PATCH'])
def update_question(exercise_id, question_id):
    """
    Edita una pregunta existente (solo admin).
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded['user_id'])
    if not user or not user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    question = ExerciseQuestion.query.filter_by(
        id=question_id, exercise_id=exercise_id
    ).first()
    if not question:
        return jsonify({'error': 'Question not found'}), 404

    data = request.json

    # Saneamos texto y cuerpo si vienen
    q_text = data.get('question_text')
    q_body = data.get('question_body')
    question_text = bleach.clean(q_text) if q_text is not None else None
    question_body = bleach.clean(q_body) if q_body is not None else None

    question_type = data.get('question_type')
    score = data.get('score')
    choices_data = data.get('choices')

    # Actualizamos campos si vienen
    if question_text is not None:
        question.question_text = question_text
    if question_body is not None:
        question.question_body = question_body
    if question_type is not None:
        question.question_type = question_type
    if score is not None:
        question.score = score

    # Manejo de choices en caso de multiple_choice
    if question_type == 'multiple_choice' and choices_data is not None:
        if isinstance(choices_data, str):
            try:
                choices_data = json.loads(choices_data)
            except json.JSONDecodeError:
                return jsonify({'error': 'Invalid JSON en choices'}), 400

        if not isinstance(choices_data, list) or len(choices_data) < 2:
            return jsonify({'error': 'Debe haber al menos 2 opciones'}), 400

        sanitized_options = []
        for option in choices_data:
            if isinstance(option, dict):
                sanitized_option = option.copy()
                sanitized_option['text'] = bleach.clean(option.get('text', ''))
                sanitized_option.setdefault('correct', False)
                sanitized_options.append(sanitized_option)
            elif isinstance(option, str):
                sanitized_options.append({'text': bleach.clean(option), 'correct': False})
            else:
                sanitized_options.append({'text': bleach.clean(str(option)), 'correct': False})

        question.choices = json.dumps(sanitized_options)
    elif question_type == 'abierta':
        question.choices = ""

    db.session.commit()
    return jsonify({'message': 'Question updated'}), 200


@question_blueprint.route('/api/exercise/<int:exercise_id>/questions', methods=['GET'])
def list_questions(exercise_id):
    """
    Lista todas las preguntas activas para cierto ejercicio.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    questions = ExerciseQuestion.query.filter_by(exercise_id=exercise_id, is_active=True).all()
    results = []
    for q in questions:
        results.append({
            'id': q.id,
            'text': q.question_text,
            'type': q.question_type,
            'choices': q.choices,
            'score': q.score
        })
    return jsonify(results), 200


@question_blueprint.route('/api/exercise/<int:exercise_id>/question/<int:question_id>/answer', methods=['POST'])
def submit_answer(exercise_id, question_id):
    """
    Envía una respuesta a la pregunta (solo se puede responder una vez).
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = decoded['user_id']

    existing = ExerciseAnswer.query.filter_by(user_id=user_id, question_id=question_id).first()
    if existing:
        return jsonify({'error': 'Ya respondiste esta pregunta, no se puede editar.'}), 400

    data = request.json
    answer_text = bleach.clean(data.get('answer_text', ''))

    new_answer = ExerciseAnswer(
        question_id=question_id,
        user_id=user_id,
        answer_text=answer_text
    )
    db.session.add(new_answer)
    db.session.commit()

    return jsonify({'message': 'Answer saved'}), 201


@question_blueprint.route('/api/exercise/<int:exercise_id>/answers', methods=['GET'])
def list_answers(exercise_id):
    """
    Lista todas las respuestas de los usuarios para las preguntas de un ejercicio (solo admin).
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded['user_id'])
    if not user or not user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    questions = ExerciseQuestion.query.filter_by(exercise_id=exercise_id).all()
    question_ids = [q.id for q in questions]
    answers = ExerciseAnswer.query.filter(ExerciseAnswer.question_id.in_(question_ids)).all()

    results = []
    for ans in answers:
        results.append({
            'answer_id': ans.id,
            'question_id': ans.question_id,
            'user_id': ans.user_id,
            'answer_text': ans.answer_text,
            'score': ans.score,
            'feedback': ans.feedback
        })
    return jsonify(results), 200


@question_blueprint.route('/api/exercise/<int:exercise_id>/answer/<int:answer_id>/evaluate', methods=['PATCH'])
def evaluate_answer(exercise_id, answer_id):
    """
    El admin califica o añade feedback a una respuesta dada.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded['user_id'])
    if not user or not user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    data = request.json
    score = data.get('score')
    feedback = data.get('feedback')

    answer = ExerciseAnswer.query.get(answer_id)
    if not answer:
        return jsonify({'error': 'Answer not found'}), 404

    question = ExerciseQuestion.query.get(answer.question_id)
    if not question or question.exercise_id != exercise_id:
        return jsonify({'error': 'Answer does not belong to this exercise'}), 400

    if score is not None:
        answer.score = score
    if feedback is not None:
        answer.feedback = feedback

    db.session.commit()
    return jsonify({'message': 'Answer evaluated'}), 200


@question_blueprint.route('/api/exercise/<int:exercise_id>/question/<int:question_id>', methods=['DELETE'])
def delete_question(exercise_id, question_id):
    """
    Elimina una pregunta (solo admin), y sus respuestas asociadas.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded['user_id'])
    if not user or not user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    question = ExerciseQuestion.query.filter_by(
        id=question_id, exercise_id=exercise_id
    ).first()
    if not question:
        return jsonify({'error': 'Question not found'}), 404

    answers = ExerciseAnswer.query.filter_by(question_id=question.id).all()
    for ans in answers:
        db.session.delete(ans)

    db.session.delete(question)
    db.session.commit()

    return jsonify({'message': 'Question deleted'}), 200


@question_blueprint.route('/api/exercise/<int:exercise_id>/my_answers', methods=['GET'])
def get_my_answers(exercise_id):
    """
    Devuelve un dict { question_id: answer_text } con las respuestas 
    que el usuario actual ha enviado para las preguntas de este ejercicio.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = decoded['user_id']

    answers = db.session.query(ExerciseAnswer).join(ExerciseQuestion).filter(
        ExerciseQuestion.exercise_id == exercise_id,
        ExerciseAnswer.user_id == user_id
    ).all()

    result = {}
    for ans in answers:
        result[ans.question_id] = ans.answer_text

    return jsonify(result)
