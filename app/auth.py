import datetime
import jwt
from flask import Blueprint, request, jsonify, current_app
from . import db, bcrypt
from .models import User
import secrets
from .exercise import decode_token, client

auth_blueprint = Blueprint('auth', __name__)

@auth_blueprint.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    confirmPassword = data.get('confirmPassword')

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already taken'}), 400

    if not password or not confirmPassword or password != confirmPassword:
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
    token = secrets.token_hex(32)  # e.g., 64-hex char random string
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

@auth_blueprint.route('/api/user', methods=['GET'])
def get_user():
    """Fetch details of the currently authenticated user."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        decoded = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

    user = User.query.get(decoded.get('user_id'))
    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'email': user.email,
        'is_admin': user.is_admin
    })

@auth_blueprint.route('/api/logout', methods=['POST'])
def logout_user():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    decoded = decode_token(token)  # Similar lógica de decodificar JWT
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = decoded.get('user_id')

    # Lógica para remover contenedores activos de ese usuario:
    containers = client.containers.list(all=True, filters={"name": f"user-{user_id}-"})
    for container in containers:
        container.remove(force=True)

    # Aquí podrías invalidar el JWT si manejas lista de tokens, etc.
    return jsonify({"message": "Logged out and containers removed."})
