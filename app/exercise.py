import jwt
from flask import Blueprint, jsonify, request, current_app
from .models import CompletedExercise, Exercise, User, db
import docker

exercise_blueprint = Blueprint('exercise', __name__)
client = docker.from_env()

def decode_token(token):
    # Helper to decode JWT
    try:
        return jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

@exercise_blueprint.route('/api/exercises', methods=['GET'])
def get_exercises():
    # Obtain all exercises from the database
    exercises = Exercise.query.all()
    result = [{'id': e.id, 'title': e.title, 'description': e.description} for e in exercises]
    return jsonify(result)

@exercise_blueprint.route('/api/user_exercises', methods=['GET'])
def get_user_exercises():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    decoded = decode_token(token)
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = decoded['user_id']
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Get exercises and their completion status for the user
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
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    decoded = decode_token(token)
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
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    decoded = decode_token(token)
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
                    'url': f'http://localhost:{exercise.port}'
                })
            else:
                existing_container.remove(force=True)
        except docker.errors.NotFound:
            pass

        # 2. Construir la imagen en base a la carpeta dockerfile_path
        image_tag = f"exercise-{exercise_id}"  # Por ejemplo, un nombre simple
        build_path = exercise.dockerfile_path  # por ej. "dockerfiles/networking"
        client.images.build(path=build_path, tag=image_tag)  

        # 3. Correr el contenedor
        container = client.containers.run(
            image_tag,  # La imagen recién construida
            detach=True,
            ports={'5000/tcp': exercise.port},
            name=container_name
        )

        return jsonify({
            'message': f'Exercise {exercise_id} started successfully',
            'url': f'http://localhost:{exercise.port}'
        })
    except docker.errors.APIError as e:
        return jsonify({'error': f'Failed to start container: {str(e)}'}), 500

@exercise_blueprint.route('/api/exercise/<int:exercise_id>/stop', methods=['POST'])
def stop_exercise(exercise_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    decoded = decode_token(token)
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = decoded['user_id']
    container_name = f"user-{user_id}-exercise-{exercise_id}"

    # Stop and remove the container
    try:
        container = client.containers.get(container_name)
        container.stop()
        container.remove()
        return jsonify({'message': f'Exercise {exercise_id} stopped successfully'})
    except docker.errors.NotFound:
        return jsonify({'error': 'Container not found'}), 404
    except docker.errors.APIError as e:
        return jsonify({'error': f'Failed to stop container: {str(e)}'}), 500

# Admin routes
@exercise_blueprint.route('/api/exercise', methods=['POST'])
def add_exercise():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    decoded = decode_token(token)
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
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    decoded = decode_token(token)
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded['user_id'])
    if not user or not user.is_admin:
        return jsonify({'error': 'Permission denied'}), 403

    exercise = Exercise.query.get(exercise_id)
    if not exercise:
        return jsonify({'error': 'Exercise not found'}), 404

    db.session.delete(exercise)
    db.session.commit()
    return jsonify({'message': 'Exercise deleted successfully'}), 200
