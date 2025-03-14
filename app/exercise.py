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

def get_free_port():
    """
    Retorna el primer puerto libre entre 8000 y 9999
    que no esté siendo usado por ningún ejercicio en la base de datos.
    """
    used_ports = [ex.port for ex in Exercise.query.all()]

    for candidate in range(8000, 10000):
        if candidate not in used_ports:
            return candidate

    # Si no encontró ningún puerto, se lanza excepción
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
            # host_data podría ser como [{'HostIp': '0.0.0.0', 'HostPort': '8000'}]
            if host_data:
                for binding in host_data:
                    if binding.get("HostPort"):
                        used.add(int(binding["HostPort"]))
    return used

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
    """
    Crea un ejercicio sin ZIP (por JSON), recibiendo port directamente.
    Se deja tal cual, aunque en la subida con ZIP ya no pedimos puerto.
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

@exercise_blueprint.route('/api/exercise/<int:exercise_id>', methods=['DELETE'])
def delete_exercise(exercise_id):
    """
    Elimina el ejercicio de la BD y su carpeta, y se asegura de detener
    y remover contenedores asociados para liberar el puerto.
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

    # 1. Detener y eliminar cualquier contenedor asociado a este ejercicio
    #    que contenga "exercise-<exercise_id>" en su nombre
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

    base_dir = os.path.abspath(os.path.dirname(__file__))
    dockerfiles_root = os.path.join(base_dir, '..', 'dockerfiles')
    relative_path = exercise.dockerfile_path.replace('dockerfiles/', '').strip('/')

    # 2. Elimina el registro de la BD
    db.session.delete(exercise)
    db.session.commit()

    # 3. Borra la carpeta (si existe)
    folder_path = os.path.join(dockerfiles_root, relative_path)
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

    El puerto se asigna automáticamente, sin pedirle al usuario que lo ingrese.
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
    zipfile_obj = request.files.get('zipfile', None)

    if not title or not zipfile_obj:
        return jsonify({'error': 'Missing title or zipfile'}), 400

    # 2. Asignar puerto automáticamente
    port = get_free_port()

    # 3. Crear slug a partir del título
    slug = re.sub(r'[^A-Za-z0-9]+', '_', title.lower()).strip('_')
    if not slug:
        slug = "exercise"

    # 4. Crear carpeta /dockerfiles/<slug>
    base_dir = os.path.abspath(os.path.dirname(__file__))
    dockerfiles_dir = os.path.join(base_dir, '..', 'dockerfiles')
    exercise_dir = os.path.join(dockerfiles_dir, slug)
    os.makedirs(exercise_dir, exist_ok=True)

    # 5. Guardar el ZIP temporalmente, y luego descomprimir
    zip_path = os.path.join(exercise_dir, secure_filename(zipfile_obj.filename))
    zipfile_obj.save(zip_path)

    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(exercise_dir)
    except zipfile.BadZipFile:
        return jsonify({'error': 'Invalid or corrupted ZIP file'}), 400
    finally:
        os.remove(zip_path)  # Elimina el ZIP original tras la extracción

    # 6. Crear registro en la BD
    new_exercise = Exercise(
        title=title,
        description=description,
        dockerfile_path=f"dockerfiles/{slug}",
        port=port
    )
    db.session.add(new_exercise)
    db.session.commit()

    return jsonify({'message': 'Exercise with ZIP added successfully'})
