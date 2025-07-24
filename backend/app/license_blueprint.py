from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from datetime import datetime, timedelta
import jwt
from .models import db, License

license_bp = Blueprint('license', __name__, url_prefix='/api/license')

def admin_required(func):
    from functools import wraps
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            return jsonify({"error": "Permisos insuficientes"}), 403
        return func(*args, **kwargs)
    return wrapper

@license_bp.route('/generate', methods=['POST'])
@login_required
@admin_required
def generate_license():
    data = request.json or {}
    target_user = data.get('user_id')
    days = data.get('duration_days', 30)
    exp = datetime.utcnow() + timedelta(days=days)
    payload = {'user_id': target_user, 'exp': int(exp.timestamp())}
    key = jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    lic = License(key=key, user_id=target_user, valid_until=exp)
    db.session.add(lic)
    db.session.commit()
    return jsonify({'license_key': key})

@license_bp.route('/validate', methods=['POST'])
@login_required
def validate_license():
    data = request.json or {}
    key = data.get('license_key')
    try:
        payload = jwt.decode(key, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        return jsonify({'valid': True, 'data': payload})
    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)}), 400