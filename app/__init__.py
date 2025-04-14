import os
import json
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_limiter.errors import RateLimitExceeded

# Directorios y base de datos
basedir = os.path.abspath(os.path.dirname(__file__))
instance_dir = os.path.join(basedir, "..", "instance")
os.makedirs(instance_dir, exist_ok=True)
db_path = os.path.join(instance_dir, "app.db")

# Cargar variables de entorno desde .env usando python-dotenv
from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(basedir), ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)

db = SQLAlchemy()
bcrypt = Bcrypt()
migrate = Migrate()

def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "replace-this-with-a-strong-secret"
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"

    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)

    # Configuración dinámica de CORS
    # Se lee la variable de entorno CORS_ALLOWED_IPS (generada por el script de instalación)
    cors_ips = os.environ.get("CORS_ALLOWED_IPS", "")
    # Se admite que las IPs estén separadas por espacios o comas
    if "," in cors_ips:
        ip_list = [ip.strip() for ip in cors_ips.split(",") if ip.strip()]
    else:
        ip_list = [ip.strip() for ip in cors_ips.split() if ip.strip()]

    allowed_origins = []
    for ip in ip_list:
        allowed_origins.append(f"http://{ip}:3000")
        allowed_origins.append(f"https://{ip}:3000")
    # Siempre se asegura que localhost esté incluido
    if "http://localhost:3000" not in allowed_origins:
        allowed_origins.append("http://localhost:3000")

    CORS(
        app,
        supports_credentials=True,
        resources={r"/*": {"origins": allowed_origins}}
    )

    # Configurar Flask-Limiter sin pasar el app en el constructor
    limiter = Limiter(key_func=get_remote_address, default_limits=["800 per minute"])
    limiter.init_app(app)

    @app.errorhandler(RateLimitExceeded)
    def ratelimit_handler(e):
        return (
            jsonify({"error": "Límite de peticiones excedido. Intente de nuevo más tarde."}),
            429,
        )

    with app.app_context():
        # Registro de blueprints y carga de ejercicios
        from .models import Exercise
        from .proxy import proxy_blueprint
        from .auth import auth_blueprint
        from .exercise import exercise_blueprint
        from .question_blueprint import question_blueprint

        app.register_blueprint(auth_blueprint)
        app.register_blueprint(exercise_blueprint)
        app.register_blueprint(proxy_blueprint)
        app.register_blueprint(question_blueprint)

        db.create_all()

        # Carga inicial de ejercicios desde exercises.json (si existe)
        if not Exercise.query.first():
            json_path = os.path.join(os.path.dirname(__file__), "exercises.json")
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    file_content = f.read().strip()
                    if not file_content:
                        print(f"El archivo {json_path} está vacío. No se crearon ejercicios.")
                    else:
                        exercises_data = json.loads(file_content)
                        if not exercises_data:
                            print("El JSON está vacío. No se crearon ejercicios.")
                        else:
                            for item in exercises_data:
                                new_exercise = Exercise(
                                    title=item.get("title", "Sin título"),
                                    description=item.get("description", "Sin descripción"),
                                    dockerfile_path=item.get("dockerfile_path", ""),
                                    port=item.get("port", 8000),
                                )
                                db.session.add(new_exercise)
                            db.session.commit()
                            print("Ejercicios creados exitosamente desde exercises.json")
            except FileNotFoundError:
                print(f"No se encontró el archivo {json_path}. No se crearon ejercicios.")
            except json.JSONDecodeError as e:
                print(f"Error al decodificar JSON: {str(e)}. No se crearon ejercicios.")

    return app
