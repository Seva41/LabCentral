# app/auth.py
import datetime
import jwt
from flask import Blueprint, request, jsonify, current_app
from . import db, bcrypt
from .models import User
import secrets
import datetime

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

@auth_blueprint.route('/api/request_password_reset', methods=['POST'])
def request_password_reset():
    data = request.json
    email = data.get('email')

    user = User.query.filter_by(email=email).first()
    if not user:
        # Return 200 anyway to avoid revealing which emails exist
        return jsonify({'message': 'If that email is registered, a reset was sent.'})

    # Generate a random token
    token = secrets.token_hex(32)  # e.g. 64-hex char random string
    user.reset_token = token
    user.reset_token_expiry = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    db.session.commit()

    # In real life, send an email with a link:
    # https://your-frontend-url/reset-password?token=some_token
    # For dev, just return it:
    return jsonify({
        'message': 'Password reset token generated',
        'token': token
    })

@auth_blueprint.route('/api/reset_password', methods=['POST'])
def reset_password():
    data = request.json
    token = data.get('token')
    new_password = data.get('new_password')

    user = User.query.filter_by(reset_token=token).first()
    if not user:
        return jsonify({'error': 'Invalid token'}), 400

    # Check expiry
    if user.reset_token_expiry < datetime.datetime.utcnow():
        return jsonify({'error': 'Token expired'}), 400

    # Update password & clear token
    user.set_password(new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.session.commit()

    return jsonify({'message': 'Password updated successfully'})
