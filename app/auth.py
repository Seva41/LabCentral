# app/auth.py
import datetime
import jwt
from flask import Blueprint, request, jsonify, current_app
from . import db, bcrypt
from .models import User

auth_blueprint = Blueprint('auth', __name__)

@auth_blueprint.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirmPassword')

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already taken'}), 400

    if not password or not confirm_password or password != confirm_password:
        return jsonify({'error': 'Passwords do not match'}), 400

    new_user = User(email=email)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'User created successfully'}), 201

@auth_blueprint.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Generate JWT token
    token = jwt.encode(
        {
            'user_id': user.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=12)
        },
        current_app.config['SECRET_KEY'],
        algorithm='HS256'
    )
    return jsonify({'token': token})
