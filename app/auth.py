import datetime
import jwt
from flask import Blueprint, request, jsonify, current_app, make_response
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

    # Generar JWT token
    token = jwt.encode(
        {
            'user_id': user.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=12)
        },
        current_app.config['SECRET_KEY'],
        algorithm='HS256'
    )

    response = make_response(jsonify({'message': 'Login successful'}))
    response.set_cookie(
            "session_token",
            token,
            httponly=True,
            secure=False,         # CAMBIAR EN PRODUCCION
            samesite="Lax",
            path="/"
        )
    return response


@auth_blueprint.route('/api/logout', methods=['POST'])
def logout_user():
    # Decodificar token desde cookie
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = decoded.get('user_id')

    # Remover contenedores activos de ese usuario
    containers = client.containers.list(all=True, filters={"name": f"user-{user_id}-"})
    for container in containers:
        container.remove(force=True)

    # Para “cerrar sesión”, podemos vaciar la cookie
    response = make_response(jsonify({"message": "Logged out and containers removed."}))
    response.set_cookie('session_token', '', expires=0)  # Borrado
    return response

@auth_blueprint.route('/api/request_password_reset', methods=['POST'])
def request_password_reset():
    pass

@auth_blueprint.route('/api/reset_password', methods=['POST'])
def reset_password():
    pass

@auth_blueprint.route('/api/user', methods=['GET'])
def get_user():
    """
    Devuelve los datos del usuario autenticado,
    leyendo el JWT desde la cookie en vez de Authorization.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded.get('user_id'))
    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'email': user.email,
        'is_admin': user.is_admin
    })
