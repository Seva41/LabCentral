from flask import Blueprint, render_template
from flask_login import login_required, current_user
from .docker_manager import create_user_container

dashboard = Blueprint('dashboard', __name__)

@dashboard.route('/dashboard')
@login_required
def index():
    return render_template('dashboard.html', user=current_user)

@dashboard.route('/exercise', methods=['GET'])
@login_required
def start_exercise():
    container = create_user_container(current_user.id)
    return f"Ejercicio iniciado. Conéctate al contenedor: {container.name}"

@dashboard.route('/')
def home():
    return render_template('index.html')  # Asegúrate de tener este archivo HTML