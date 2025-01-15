# app/exercise.py
import jwt
from flask import Blueprint, jsonify, request, current_app
from .models import CompletedExercise, User, db

exercise_blueprint = Blueprint('exercise', __name__)

def decode_token(token):
    # Helper to decode JWT
    try:
        return jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except:
        return None

@exercise_blueprint.route('/api/exercises', methods=['GET'])
def get_exercises():
    # In a real scenario, fetch from DB. Hardcoded example:
    sample_exercises = [
        {'id': 1, 'title': 'Basic Networking'},
        {'id': 2, 'title': 'SQL Injection'},
        {'id': 3, 'title': 'XSS Attack'},
        {'id': 4, 'title': 'Buffer Overflow'},
    ]
    return jsonify(sample_exercises)

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
    
    # Return IDs of completed exercises
    completed_ids = [c.exercise_id for c in user.completed_exercises]
    return jsonify({'completed_exercises': completed_ids})

@exercise_blueprint.route('/api/complete_exercise', methods=['POST'])
def complete_exercise():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    decoded = decode_token(token)
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    exercise_id = data.get('exercise_id')
    
    user_id = decoded['user_id']
    # Check if already completed
    existing = CompletedExercise.query.filter_by(user_id=user_id, exercise_id=exercise_id).first()
    if existing:
        return jsonify({'message': 'Already completed'})

    new_completion = CompletedExercise(user_id=user_id, exercise_id=exercise_id)
    db.session.add(new_completion)
    db.session.commit()

    return jsonify({'message': 'Exercise marked as completed'})
