import jwt
from flask import Blueprint, jsonify, request, current_app
import docker
import os
import re
import zipfile
import shutil
from werkzeug.utils import secure_filename

from .models import (
    Exercise,
    ExerciseAnswer,
    ExerciseQuestion,
    User,
    db,
    ExerciseGroup,
    GroupExerciseAnswer,
)
 
exercise_blueprint = Blueprint('exercise', __name__)
client = docker.from_env()

def decode_token():
    """
    Lee el JWT desde la cookie 'session_token'.
    Si la cookie no está o el token es inválido/expirado, retorna None.
    """
    token = request.cookies.get('session_token', '')
    if not token:
        return None
    try:
        return jwt.decode(
            token, 
            current_app.config['SECRET_KEY'], 
            algorithms=['HS256']
        )
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_free_port():
    """
    Retorna el primer puerto libre entre 8000 y 9999
    que no esté siendo usado por ningún ejercicio en la base de datos.
    """
    used_ports = [ex.port for ex in Exercise.query.all()]
    for candidate in range(8000, 10000):
        if candidate not in used_ports:
            return candidate
    raise RuntimeError("No free ports available in the specified range")

def get_used_ports_by_containers():
    """
    Retorna un set con los puertos HostPort que actualmente
    están mapeados por contenedores en ejecución.
    """
    used = set()
    for container in client.containers.list():
        ports_info = container.attrs["NetworkSettings"]["Ports"] or {}
        for port_spec, host_data in ports_info.items():
            if host_data:
                for binding in host_data:
                    if binding.get("HostPort"):
                        used.add(int(binding["HostPort"]))
    return used

def safe_extract(zip_file, extract_path):
    """
    Extrae los archivos del ZIP en 'extract_path' tras verificar 
    que ninguna ruta salga de este directorio (prevención de Zip Slip).
    """
    abs_extract_path = os.path.abspath(extract_path)
    for member in zip_file.infolist():
        member_path = os.path.join(extract_path, member.filename)
        abs_member_path = os.path.abspath(member_path)
        if not abs_member_path.startswith(abs_extract_path + os.sep):
            raise Exception("Zip Slip detected: " + member.filename)
    zip_file.extractall(extract_path)


# -------------------------
#     RUTAS DE LECTURA
# -------------------------

@exercise_blueprint.route('/api/exercises', methods=['GET'])
def get_exercises():
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    exercises = Exercise.query.all()
    result = [{'id': e.id, 'title': e.title, 'description': e.description} for e in exercises]
    return jsonify(result)

@exercise_blueprint.route('/api/user_exercises', methods=['GET'])
def get_user_exercises():
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = decoded['user_id']
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    exercises = Exercise.query.all()
    completed_exercises = [c.exercise_id for c in user.completed_exercises]
    result = []
    for exercise in exercises:
        result.append({
            'id': exercise.id,
            'title': exercise.title,
            'completed': exercise.id in completed_exercises
        })
    return jsonify(result)

@exercise_blueprint.route('/api/exercise/<int:exercise_id>', methods=['GET'])
def get_exercise_detail(exercise_id):
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    exercise = Exercise.query.get(exercise_id)
    if not exercise:
        return jsonify({'error': 'Exercise not found'}), 404

    return jsonify({
        'id': exercise.id,
        'title': exercise.title,
        'description': exercise.description
    })


# -------------------------
#   INICIAR/DETENER CONTAINER
# -------------------------

@exercise_blueprint.route('/api/exercise/<int:exercise_id>/start', methods=['POST'])
def start_exercise(exercise_id):
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = decoded['user_id']
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    exercise = Exercise.query.get(exercise_id)
    if not exercise:
        return jsonify({'error': 'Exercise not found'}), 404

    # Verificar si el usuario forma parte de un grupo para este ejercicio.
    group = ExerciseGroup.query.filter(
        ExerciseGroup.exercise_id == exercise_id,
        ((ExerciseGroup.leader_id == user_id) | (ExerciseGroup.partner_id == user_id))
    ).first()

    # Si está en un grupo y NO es el líder, no puede lanzar el contenedor
    if group and group.leader_id != user_id:
        return jsonify({'message': 'El contenedor ya fue lanzado por tu compañero'}), 403

    try:
        container_name = f"user-{user_id}-exercise-{exercise_id}"
        # Verificar si ya existe el contenedor
        try:
            existing_container = client.containers.get(container_name)
            if existing_container.status == "running":
                return jsonify({
                    'message': f'Exercise {exercise_id} is already running',
                    'proxy_url': f'/api/exercise/{exercise_id}/proxy'
                })
            else:
                existing_container.remove(force=True)
        except docker.errors.NotFound:
            pass

        # Construir la imagen en base a la carpeta dockerfile_path
        image_tag = f"exercise-{exercise_id}"
        build_path = exercise.dockerfile_path
        client.images.build(path=build_path, tag=image_tag)

        # Correr el contenedor sin mapear puertos externos
        container = client.containers.run(
            image_tag,
            detach=True,
            name=container_name,
            network="lab_app_net"
        )

        return jsonify({
            'message': f'Exercise {exercise_id} started successfully',
            'proxy_url': f'/api/exercise/{exercise_id}/proxy'
        })
    except docker.errors.APIError as e:
        return jsonify({'error': f'Failed to start container: {str(e)}'}), 500

@exercise_blueprint.route('/api/exercise/<int:exercise_id>/stop', methods=['POST'])
def stop_exercise(exercise_id):
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = decoded['user_id']
    container_name = f"user-{user_id}-exercise-{exercise_id}"

    try:
        container = client.containers.get(container_name)
        container.stop()
        container.remove()
        return jsonify({'message': f'Exercise {exercise_id} stopped successfully'})
    except docker.errors.NotFound:
        return jsonify({'error': 'Container not found'}), 404
    except docker.errors.APIError as e:
        return jsonify({'error': f'Failed to stop container: {str(e)}'}), 500


# -------------------------
#   MANEJO DE GRUPOS
# -------------------------

@exercise_blueprint.route('/api/exercise/<int:exercise_id>/group', methods=['POST'])
def create_exercise_group(exercise_id):
    """
    Crea un grupo para el ejercicio, indicando el email del compañero.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = decoded['user_id']

    data = request.json
    partner_email = data.get('partner_email')
    if not partner_email:
        return jsonify({'error': 'No se especificó el correo del compañero'}), 400

    partner = User.query.filter_by(email=partner_email).first()
    if not partner:
        return jsonify({'error': 'No se encontró un usuario con ese email'}), 404

    if partner.id == user_id:
        return jsonify({'error': 'No puedes ser tu propio compañero'}), 400

    existing_group = ExerciseGroup.query.filter(
        ExerciseGroup.exercise_id == exercise_id,
        ((ExerciseGroup.leader_id == user_id) | (ExerciseGroup.partner_id == user_id))
    ).first()
    if existing_group:
        return jsonify({'error': 'Ya formas parte de un grupo para este ejercicio'}), 400

    new_group = ExerciseGroup(
        exercise_id=exercise_id, 
        leader_id=user_id, 
        partner_id=partner.id
    )
    db.session.add(new_group)
    db.session.commit()

    leader = User.query.get(new_group.leader_id)
    partner_user = User.query.get(new_group.partner_id)

    return jsonify({
        'message': 'Grupo creado exitosamente',
        'group_id': new_group.id,
        'exercise_id': new_group.exercise_id,
        'leader': {
            'id': leader.id,
            'email': leader.email
        },
        'partner': {
            'id': partner_user.id,
            'email': partner_user.email
        }
    }), 201

@exercise_blueprint.route('/api/exercise/<int:exercise_id>/my_group', methods=['GET'])
def get_my_group(exercise_id):
    """
    Devuelve el grupo en el que participa el usuario para el ejercicio dado.
    Si no forma parte de ningún grupo, retorna {'group': None}.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = decoded['user_id']

    group = ExerciseGroup.query.filter(
        ExerciseGroup.exercise_id == exercise_id,
        ((ExerciseGroup.leader_id == user_id) | (ExerciseGroup.partner_id == user_id))
    ).first()
    if not group:
        return jsonify({'group': None}), 200

    leader = User.query.get(group.leader_id)
    partner = User.query.get(group.partner_id)
    return jsonify({
        'group_id': group.id,
        'exercise_id': group.exercise_id,
        'leader': {
            'id': leader.id,
            'email': leader.email
        },
        'partner': {
            'id': partner.id,
            'email': partner.email
        }
    }), 200

@exercise_blueprint.route('/api/exercise/<int:exercise_id>/submit_answer', methods=['POST'])
def submit_group_answer(exercise_id):
    """
    Permite enviar respuestas a nivel grupal para las preguntas.
    Si el alumno forma parte de un grupo, se guarda o actualiza la respuesta.
    """
    decoded = decode_token()
    if not decoded:
         return jsonify({'error': 'Unauthorized'}), 401
    user_id = decoded['user_id']

    data = request.json
    question_id = data.get('question_id')
    answer_text = data.get('answer_text')
    if not question_id or answer_text is None:
         return jsonify({'error': 'Faltan datos para la respuesta'}), 400

    group = ExerciseGroup.query.filter(
        ExerciseGroup.exercise_id == exercise_id,
        ((ExerciseGroup.leader_id == user_id) | (ExerciseGroup.partner_id == user_id))
    ).first()

    if group:
        group_answer = GroupExerciseAnswer.query.filter_by(
            group_id=group.id, 
            question_id=question_id
        ).first()

        if not group_answer:
            group_answer = GroupExerciseAnswer(
                group_id=group.id, 
                question_id=question_id, 
                answer_text=answer_text
            )
            db.session.add(group_answer)
        else:
            group_answer.answer_text = answer_text

        db.session.commit()
        return jsonify({'message': 'Respuesta enviada a nivel grupal'}), 200
    else:
        return jsonify({'error': 'No estás en un grupo para este ejercicio'}), 400

@exercise_blueprint.route('/api/exercise/<int:exercise_id>/group', methods=['DELETE'])
def dissolve_group(exercise_id):
    """
    Disuelve el grupo del usuario actual (si existe) y elimina
    las respuestas grupales asociadas.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = decoded['user_id']

    group = ExerciseGroup.query.filter(
        ExerciseGroup.exercise_id == exercise_id,
        ((ExerciseGroup.leader_id == user_id) | (ExerciseGroup.partner_id == user_id))
    ).first()

    if not group:
        return jsonify({'error': 'No perteneces a ningún grupo para este ejercicio'}), 404

    # Borra respuestas del grupo, si existiesen
    GroupExerciseAnswer.query.filter_by(group_id=group.id).delete()

    # Elimina el grupo en sí
    db.session.delete(group)
    db.session.commit()

    return jsonify({'message': 'Grupo disuelto correctamente'}), 200

@exercise_blueprint.route('/api/exercise/<int:exercise_id>/available_users', methods=['GET'])
def get_available_users(exercise_id):
    """
    Devuelve lista de usuarios que no estén en ningún grupo
    de este ejercicio (excluyendo al usuario actual).
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    # Obtener todos los grupos asociados al ejercicio
    groups = ExerciseGroup.query.filter(ExerciseGroup.exercise_id == exercise_id).all()

    # Crear un conjunto con los IDs de usuarios que ya están en algún grupo
    used_ids = set()
    for group in groups:
        used_ids.add(group.leader_id)
        if group.partner_id:
            used_ids.add(group.partner_id)

    # Excluir al usuario actual, para que no se invite a sí mismo
    used_ids.add(decoded['user_id'])

    # Consultar y devolver los usuarios que no están en used_ids
    available_users = User.query.filter(~User.id.in_(list(used_ids))).all()
    result = [{
        'id': user.id,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name
    } for user in available_users]

    return jsonify(result), 200


# -------------------------
#       ADMIN: CRUD
# -------------------------

@exercise_blueprint.route('/api/exercise', methods=['POST'])
def add_exercise():
    """
    Crea un ejercicio sin ZIP (por JSON), recibiendo `port` directamente.
    Solo para usuarios admin.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded['user_id'])
    if not user or not user.is_admin:
        return jsonify({'error': 'Permission denied'}), 403

    data = request.json
    new_exercise = Exercise(
        title=data['title'],
        description=data['description'],
        dockerfile_path=data['dockerfile_path'],
        port=data['port']
    )
    db.session.add(new_exercise)
    db.session.commit()
    return jsonify({'message': 'Exercise added successfully'}), 201

@exercise_blueprint.route('/api/exercise_with_zip', methods=['POST'])
def add_exercise_with_zip():
    """
    Crea un nuevo ejercicio subiendo un ZIP que contiene Dockerfile y archivos extra,
    descomprimiéndolo en /dockerfiles/<slug>.
    El puerto se asigna automáticamente, sin pedirle al usuario que lo ingrese.
    Solo para usuarios admin.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded['user_id'])
    if not user or not user.is_admin:
        return jsonify({'error': 'Permission denied'}), 403

    title = request.form.get('title', '').strip()
    description = request.form.get('description', '').strip()
    zipfile_obj = request.files.get('zipfile', None)

    if not title or not zipfile_obj:
        return jsonify({'error': 'Missing title or zipfile'}), 400

    port = get_free_port()
    slug = re.sub(r'[^A-Za-z0-9]+', '_', title.lower()).strip('_')
    if not slug:
        slug = "exercise"

    base_dir = os.path.abspath(os.path.dirname(__file__))
    dockerfiles_dir = os.path.join(base_dir, '..', 'dockerfiles')
    exercise_dir = os.path.join(dockerfiles_dir, slug)

    os.makedirs(exercise_dir, exist_ok=True)

    zip_path = os.path.join(exercise_dir, secure_filename(zipfile_obj.filename))
    zipfile_obj.save(zip_path)
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            safe_extract(zf, exercise_dir)
    except Exception as e:
        return jsonify({'error': 'Invalid or corrupted ZIP file: ' + str(e)}), 400
    finally:
        os.remove(zip_path)

    new_exercise = Exercise(
        title=title,
        description=description,
        dockerfile_path=f"dockerfiles/{slug}",
        port=port
    )
    db.session.add(new_exercise)
    db.session.commit()

    return jsonify({'message': 'Exercise with ZIP added successfully'})

@exercise_blueprint.route('/api/exercise/<int:exercise_id>', methods=['DELETE'])
def delete_exercise(exercise_id):
    """
    Elimina el ejercicio de la BD y su carpeta, deteniendo y
    removiendo contenedores asociados para liberar el puerto.
    Solo para admin.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded['user_id'])
    if not user or not user.is_admin:
        return jsonify({'error': 'Permission denied'}), 403

    exercise = Exercise.query.get(exercise_id)
    if not exercise:
        return jsonify({'error': 'Exercise not found'}), 404

    # Detener y eliminar contenedores asociados
    containers = client.containers.list(all=True, filters={"name": f"exercise-{exercise_id}"})
    for c in containers:
        try:
            c.stop()
        except docker.errors.APIError:
            pass
        try:
            c.remove(force=True)
        except docker.errors.APIError:
            pass

    # Eliminar el ejercicio de la BD
    db.session.delete(exercise)
    db.session.commit()

    # Borrar carpeta dockerfiles asociada (si existe)
    base_dir = os.path.abspath(os.path.dirname(__file__))
    dockerfiles_root = os.path.join(base_dir, '..', 'dockerfiles')
    relative_path = exercise.dockerfile_path.replace('dockerfiles/', '').strip('/')
    folder_path = os.path.join(dockerfiles_root, relative_path)

    if os.path.isdir(folder_path):
        try:
            shutil.rmtree(folder_path)
            print(f"Carpeta '{folder_path}' eliminada")
        except Exception as e:
            print(f"No se pudo eliminar la carpeta: {e}")

    return jsonify({'message': 'Exercise deleted successfully'}), 200


# -------------------------
#   ADMIN: LISTAR/CALIFICAR
# -------------------------

@exercise_blueprint.route('/api/admin/exercise/<int:exercise_id>/answers', methods=['GET'])
def get_exercise_answers(exercise_id):
    """
    Devuelve en un JSON las respuestas individuales y grupales de un ejercicio.
    Solo accesible para administradores.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    admin_user = User.query.get(decoded['user_id'])
    if not admin_user or not admin_user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    # --- Respuestas INDIVIDUALES ---
    individual_q = (
        db.session.query(
            ExerciseAnswer.id.label('answer_id'),
            ExerciseAnswer.answer_text,
            ExerciseAnswer.score,
            ExerciseAnswer.feedback,
            ExerciseQuestion.id.label('question_id'),
            ExerciseQuestion.question_text,
            User.id.label('user_id'),
            User.email.label('user_email')
        )
        .join(ExerciseQuestion, ExerciseQuestion.id == ExerciseAnswer.question_id)
        .join(User, User.id == ExerciseAnswer.user_id)
        .filter(ExerciseQuestion.exercise_id == exercise_id)
    )

    individual_answers = [{
        'answer_id': row.answer_id,
        'question_id': row.question_id,
        'question_text': row.question_text,
        'user': {
            'id': row.user_id,
            'email': row.user_email
        },
        'answer_text': row.answer_text,
        'score': row.score,
        'feedback': row.feedback
    } for row in individual_q.all()]

    # --- Respuestas GRUPALES ---
    group_q = (
        db.session.query(
            GroupExerciseAnswer.id.label('answer_id'),
            GroupExerciseAnswer.answer_text,
            GroupExerciseAnswer.score,
            ExerciseQuestion.id.label('question_id'),
            ExerciseQuestion.question_text,
            ExerciseGroup.id.label('group_id'),
            ExerciseGroup.leader_id,
            ExerciseGroup.partner_id
        )
        .join(ExerciseQuestion, ExerciseQuestion.id == GroupExerciseAnswer.question_id)
        .join(ExerciseGroup, ExerciseGroup.id == GroupExerciseAnswer.group_id)
        .filter(ExerciseQuestion.exercise_id == exercise_id)
    )

    group_answers = []
    for row in group_q.all():
        leader = User.query.get(row.leader_id)
        partner = User.query.get(row.partner_id) if row.partner_id else None
        group_answers.append({
            'answer_id': row.answer_id,
            'question_id': row.question_id,
            'question_text': row.question_text,
            'group': {
                'id': row.group_id,
                'leader_email': leader.email if leader else None,
                'partner_email': partner.email if partner else None
            },
            'answer_text': row.answer_text,
            'score': row.score
        })

    return jsonify({
        'individual_answers': individual_answers,
        'group_answers': group_answers
    }), 200

@exercise_blueprint.route('/api/admin/answer/<string:mode>/<int:answer_id>', methods=['PATCH'])
def grade_answer(mode, answer_id):
    """
    Actualiza score y feedback de una respuesta, según sea individual o grupal.
    mode = 'individual'  -> ExerciseAnswer
    mode = 'group'       -> GroupExerciseAnswer
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    admin_user = User.query.get(decoded['user_id'])
    if not admin_user or not admin_user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    data = request.json
    new_score = data.get('score')
    new_feedback = data.get('feedback')

    if mode == 'individual':
        answer = ExerciseAnswer.query.get(answer_id)
    elif mode == 'group':
        answer = GroupExerciseAnswer.query.get(answer_id)
    else:
        return jsonify({'error': 'Invalid mode'}), 400

    if not answer:
        return jsonify({'error': 'Answer not found'}), 404

    # Asignar el nuevo score
    answer.score = new_score

    # Por defecto, sólo las respuestas individuales tienen 'feedback'.
    # Si deseas feedback también para grupos, añade la columna 'feedback' al modelo GroupExerciseAnswer.
    if hasattr(answer, 'feedback'):
        answer.feedback = new_feedback

    db.session.commit()
    return jsonify({'message': 'Answer graded successfully'}), 200
