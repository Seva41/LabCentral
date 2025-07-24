import datetime
import jwt
import secrets
from flask import Blueprint, request, jsonify, current_app, make_response
from . import db, bcrypt
from .models import User
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

    exp_time = datetime.timedelta(hours=12)
    payload = {
        'user_id': user.id,
        'is_admin': user.is_admin,
        'exp': datetime.datetime.utcnow() + exp_time
    }
    token = jwt.encode(
        payload,
        current_app.config['SECRET_KEY'],
        algorithm='HS256'
    )

    if user.force_password_change:
        resp_data = {
            'message': 'Password change required',
            'force_password_change': True,
            'token': token,
            'is_admin': user.is_admin
        }
    else:
        resp_data = {
            'message': 'Login successful',
            'token': token,
            'is_admin': user.is_admin
        }

    resp = jsonify(resp_data)
    resp.set_cookie(
        'session_token',
        token,
        httponly=True,
        samesite='Lax',
        secure=True
    )

    return resp, 200


@auth_blueprint.route('/api/logout', methods=['POST'])
def logout_user():
    """
    Cierra la sesión basada en la cookie 'session_token'.
    Remueve contenedores activos de ese usuario y vacía la cookie.
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = decoded.get('user_id')
    containers = client.containers.list(all=True, filters={"name": f"user-{user_id}-"})
    for container in containers:
        container.remove(force=True)

    response = make_response(jsonify({"message": "Logged out and containers removed."}))
    response.set_cookie('session_token', '', expires=0, secure=True, httponly=True, samesite='Strict')  # Borrar cookie
    return response


@auth_blueprint.route('/api/request_password_reset', methods=['POST'])
def request_password_reset():
    """
    Genera un token de reset de contraseña y lo retorna en JSON (en futuro se mandaría por email).
    """
    data = request.json
    email = data.get('email', '')
    user = User.query.filter_by(email=email).first()

    # No revelamos si el usuario existe o no, para evitar enumeraciones
    if not user:
        return jsonify({'message': 'If that email is registered, a reset was sent.'})

    token = secrets.token_hex(32)
    user.reset_token = token
    user.reset_token_expiry = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    db.session.commit()

    return jsonify({
        'message': 'Password reset token generated',
        'reset_token': token
    })


@auth_blueprint.route('/api/reset_password', methods=['POST'])
def reset_password():
    """
    Recibe un `token` de reset y la `new_password`.
    """
    data = request.json
    token = data.get('token', '')
    new_password = data.get('new_password', '')

    user = User.query.filter_by(reset_token=token).first()
    if not user:
        return jsonify({'error': 'Invalid token'}), 400

    if user.reset_token_expiry < datetime.datetime.utcnow():
        return jsonify({'error': 'Token expired'}), 400

    user.set_password(new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    # Si quisieras que cada reset obligue a cambiar la pass otra vez, pondrías force_password_change=True
    user.force_password_change = False
    db.session.commit()

    return jsonify({'message': 'Password updated successfully'})


@auth_blueprint.route('/api/user', methods=['GET'])
def get_user():
    """
    Devuelve datos del usuario autenticado (leyendo token de la cookie session_token).
    """
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401

    user = User.query.get(decoded.get('user_id'))
    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'email': user.email,
        'first_name': user.first_name,  # Ahora se envía el nombre
        'last_name': user.last_name,    # y el apellido
        'is_admin': user.is_admin
    })


@auth_blueprint.route('/api/admin/bulk_create_users', methods=['POST'])
def bulk_create_users():
    """
    Crea varios usuarios en masa. Debe ser llamado por un admin (token en Authorization).
    """
    # Verificar token y admin
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'error': 'No token provided'}), 401
    
    try:
        decoded = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

    admin_user = User.query.get(decoded.get('user_id'))
    if not admin_user or not admin_user.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    data = request.json  # Estructura: {"users": [ { "email": "...", "first_name": "...", "last_name": "..." }, ... ]}
    users_list = data.get('users', [])

    created_users = []
    for u in users_list:
        email = u.get('email')
        first_name = u.get('first_name', '')
        last_name = u.get('last_name', '')

        # Generar contraseña aleatoria
        temp_password = secrets.token_urlsafe(8)

        # Si el usuario ya existe, se salta
        if User.query.filter_by(email=email).first():
            continue

        new_user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            force_password_change=True  # Obligará a cambiar en su 1er login
        )
        new_user.set_password(temp_password)
        db.session.add(new_user)
        db.session.commit()

        created_users.append({
            "email": email,
            "temp_password": temp_password
        })
    
    return jsonify({
        "message": "Usuarios creados",
        "created": created_users
    }), 201


@auth_blueprint.route('/api/force_change_password', methods=['POST'])
def force_change_password():
    """
    Endpoint para que un usuario ya logueado (con token en Authorization)
    cambie su contraseña si force_password_change=True.
    """
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'error': 'No token provided'}), 401

    try:
        decoded = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

    data = request.json
    new_password = data.get('new_password')
    if not new_password:
        return jsonify({'error': 'No new password provided'}), 400

    user = User.query.get(decoded.get('user_id'))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user.set_password(new_password)
    user.force_password_change = False
    db.session.commit()

    return jsonify({'message': 'Password updated successfully'})


@auth_blueprint.route('/api/users', methods=['GET'])
def get_users():
    decoded = decode_token()
    if not decoded:
        return jsonify({'error': 'Unauthorized'}), 401
    users = User.query.all()
    result = [{
        'id': user.id,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name
    } for user in users]
    return jsonify(result), 200
