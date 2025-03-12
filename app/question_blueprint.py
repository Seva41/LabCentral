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
    question_text = data.get('question_text')  # Título principal de la pregunta
    question_body = data.get('question_body')    # Texto adicional, opcional
    question_type = data.get('question_type', 'abierta')

    if not question_text:
        return jsonify({'error': 'question_text is required'}), 400

    # Procesar choices
    choices_data = data.get('choices', [])
    # Guardarlos como string JSON
    import json
    choices_str = ""
    if question_type == "multiple_choice":
        # Validar que sea al menos 2 opciones
        if len(choices_data) < 2:
            return jsonify({'error': 'Debe haber al menos 2 opciones'}), 400
        choices_str = json.dumps(choices_data)
    else:
        choices_str = ""  # Para preguntas abiertas

    new_q = ExerciseQuestion(
        exercise_id=exercise_id,
        question_text=question_text,
        question_body=question_body or "",
        question_type=question_type,
        choices=choices_str
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
    question_text = data.get('question_text')
    question_body = data.get('question_body')
    question_type = data.get('question_type')
    choices_data = data.get('choices')

    if question_text is not None:
        question.question_text = question_text
    if question_body is not None:
        question.question_body = question_body
    if question_type is not None:
        question.question_type = question_type

    import json
    if question_type == 'multiple_choice' and choices_data is not None:
        question.choices = json.dumps(choices_data)
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
    
    # (No es solo para admin, porque los alumnos necesitan verlas)
    questions = ExerciseQuestion.query.filter_by(exercise_id=exercise_id, is_active=True).all()
    results = []
    for q in questions:
        results.append({
            'id': q.id,
            'text': q.question_text,
            'type': q.question_type,
            'choices': q.choices
        })
    return jsonify(results), 200


@question_blueprint.route('/api/exercise/<int:exercise_id>/question/<int:question_id>/answer', methods=['POST'])
def submit_answer(exercise_id, question_id):
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = decoded['user_id']

    # Verificar si ya existe la respuesta
    existing = ExerciseAnswer.query.filter_by(user_id=user_id, question_id=question_id).first()
    if existing:
        return jsonify({'error': 'Ya respondiste esta pregunta, no se puede editar.'}), 400

    data = request.json
    answer_text = data.get('answer_text', '')

    # Crear la nueva respuesta
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

    # Obtener todas las preguntas de ese ejercicio
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

    # También podríamos verificar que la answer pertenece a una pregunta del ejercicio dado
    question = ExerciseQuestion.query.get(answer.question_id)
    if not question or question.exercise_id != exercise_id:
        return jsonify({'error': 'Answer does not belong to this exercise'}), 400

    # Actualizar
    if score is not None:
        answer.score = score
    if feedback is not None:
        answer.feedback = feedback

    db.session.commit()
    return jsonify({'message': 'Answer evaluated'}), 200

@question_blueprint.route('/api/exercise/<int:exercise_id>/question/<int:question_id>', methods=['DELETE'])
def delete_question(exercise_id, question_id):
    """
    Elimina una pregunta (solo admin).
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

    db.session.delete(question)
    db.session.commit()
    return jsonify({'message': 'Question deleted'}), 200

@question_blueprint.route('/api/exercise/<int:exercise_id>/my_answers', methods=['GET'])
def get_my_answers(exercise_id):
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = decoded['user_id']

    # Buscamos todas las respuestas de ese user en ese ejercicio
    answers = db.session.query(ExerciseAnswer).join(ExerciseQuestion).filter(
        ExerciseQuestion.exercise_id == exercise_id,
        ExerciseAnswer.user_id == user_id
    ).all()

    # Retornar un diccionario question_id => answer_text
    result = {}
    for ans in answers:
        result[ans.question_id] = ans.answer_text

    return jsonify(result)
