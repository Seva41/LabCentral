import jwt
from flask import Blueprint, jsonify, request, current_app
from .models import CompletedExercise, Exercise, User, db

exercise_blueprint = Blueprint('exercise', __name__)

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

    # Logic for starting an exercise (placeholder)
    return jsonify({'message': f'Exercise {exercise_id} started successfully'})

