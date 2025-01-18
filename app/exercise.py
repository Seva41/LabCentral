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

    # Docker-specific logic
    try:
        container_name = f"user-{user_id}-exercise-{exercise_id}"
        
        # Check if the container already exists
        try:
            existing_container = client.containers.get(container_name)
            if existing_container.status == "running":
                return jsonify({
                    'message': f'Exercise {exercise_id} is already running',
                    'url': f'http://localhost:{exercise.port}'
                })
            else:
                existing_container.remove(force=True)  # Remove non-running container
        except docker.errors.NotFound:
            pass  # Continue if container does not exist

        # Start a new container
        container = client.containers.run(
            exercise.docker_image,
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
