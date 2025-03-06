import jwt
from flask import Blueprint, jsonify, request, current_app
from .models import Exercise, User, db
import docker
import os
import re
from werkzeug.utils import secure_filename
import zipfile
import shutil

exercise_blueprint = Blueprint('exercise', __name__)
client = docker.from_env()

def decode_token():
    """
    Lee el JWT desde la cookie 'session_token'
    """
    token = request.cookies.get('session_token', '')
    if not token:
        return None
    try:
        return jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

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

    try:
        container_name = f"user-{user_id}-exercise-{exercise_id}"

        # 1. Verificar si ya existe el contenedor
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

        # 2. Construir la imagen en base a la carpeta dockerfile_path
        image_tag = f"exercise-{exercise_id}"
        build_path = exercise.dockerfile_path
        client.images.build(path=build_path, tag=image_tag)

        # 3. Correr el contenedor sin mapear puertos externos
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

# Rutas de admin
@exercise_blueprint.route('/api/exercise', methods=['POST'])
def add_exercise():
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

@exercise_blueprint.route('/api/exercise/<int:exercise_id>', methods=['DELETE'])
def delete_exercise(exercise_id):
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded['user_id'])
    if not user or not user.is_admin:
        return jsonify({'error': 'Permission denied'}), 403

    exercise = Exercise.query.get(exercise_id)
    if not exercise:
        return jsonify({'error': 'Exercise not found'}), 404

    base_dir = os.path.abspath(os.path.dirname(__file__))
    dockerfiles_root = os.path.join(base_dir, '..', 'dockerfiles')

    relative_path = exercise.dockerfile_path.replace('dockerfiles/', '').strip('/')

    # Ruta absoluta a la carpeta
    folder_path = os.path.join(dockerfiles_root, relative_path)

    # 1. Elimina el registro de la BD
    db.session.delete(exercise)
    db.session.commit()

    # 2. Borra la carpeta (si existe)
    if os.path.isdir(folder_path):
        try:
            shutil.rmtree(folder_path)
            print(f"Carpeta '{folder_path}' eliminada")
        except Exception as e:
            print(f"No se pudo eliminar la carpeta: {e}")
    
    return jsonify({'message': 'Exercise deleted successfully'}), 200

@exercise_blueprint.route('/api/exercise_with_zip', methods=['POST'])
def add_exercise_with_zip():
    """
    Crea un nuevo ejercicio subiendo un ZIP que contiene
    Dockerfile y archivos extra, descomprimiéndolo en /dockerfiles/<slug>.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded['user_id'])
    if not user or not user.is_admin:
        return jsonify({'error': 'Permission denied'}), 403

    # 1. Leer campos de FormData
    title = request.form.get('title', '').strip()
    description = request.form.get('description', '').strip()
    port = request.form.get('port', '').strip()
    zipfile_obj = request.files.get('zipfile', None)

    if not title or not zipfile_obj:
        return jsonify({'error': 'Missing title or zipfile'}), 400

    # 2. Crear slug a partir del título
    slug = re.sub(r'[^A-Za-z0-9]+', '_', title.lower()).strip('_')
    if not slug:
        slug = "exercise"

    # 3. Crear carpeta /dockerfiles/<slug> (al mismo nivel que /app)
    base_dir = os.path.abspath(os.path.dirname(__file__))
    dockerfiles_dir = os.path.join(base_dir, '..', 'dockerfiles')
    exercise_dir = os.path.join(dockerfiles_dir, slug)
    os.makedirs(exercise_dir, exist_ok=True)

    # 4. Guardar el ZIP temporalmente, y luego descomprimir
    zip_path = os.path.join(exercise_dir, secure_filename(zipfile_obj.filename))
    zipfile_obj.save(zip_path)

    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(exercise_dir)
    except zipfile.BadZipFile:
        return jsonify({'error': 'Invalid or corrupted ZIP file'}), 400
    finally:
        # Remove the original ZIP file after extraction if you prefer
        os.remove(zip_path)

    # 5. Crear registro en la BD
    new_exercise = Exercise(
        title=title,
        description=description,
        dockerfile_path=f"dockerfiles/{slug}",
        port=int(port) if port else 8000
    )
    db.session.add(new_exercise)
    db.session.commit()

    return jsonify({'message': 'Exercise with ZIP added successfully'})