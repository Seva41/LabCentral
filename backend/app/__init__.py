import os
import json
import jwt
from datetime import datetime
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_migrate import Migrate
from flask_cors import CORS                    # <–– importa CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_limiter.errors import RateLimitExceeded

basedir = os.path.abspath(os.path.dirname(__file__))
instance_dir = os.path.join(basedir, "..", "instance")
os.makedirs(instance_dir, exist_ok=True)
db_path = os.path.join(instance_dir, "app.db")

db = SQLAlchemy()
bcrypt = Bcrypt()
migrate = Migrate()


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "replace-this-with-a-strong-secret")
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"

    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    # Permitir CORS desde el frontend en localhost:3000 con credenciales
    CORS(app,
         resources={r"/api/*": {"origins": ["http://localhost:3000"]}},
         supports_credentials=True)

    # Configurar Flask-Limiter sin pasar el app en el constructor
    limiter = Limiter(key_func=get_remote_address, default_limits=["800 per minute"])
    limiter.init_app(app)

    # Personalizar la respuesta cuando se exceda el límite
    @app.errorhandler(RateLimitExceeded)
    def ratelimit_handler(e):
        return (
            jsonify(
                {"error": "Límite de peticiones excedido. Intente de nuevo más tarde."}
            ),
            429,
        )

    # --- Verificación de licencia ---
    license_key = os.getenv("LICENSE_KEY")
    if not license_key:
        raise RuntimeError("LICENSE_KEY no configurada")
    try:
        data = jwt.decode(license_key, app.config["SECRET_KEY"], algorithms=["HS256"])
        if datetime.utcnow().timestamp() > data.get("exp", 0):
            raise RuntimeError("Licencia expirada")
        app.config["LICENSE_DATA"] = data
    except Exception as e:
        raise RuntimeError(f"Licencia inválida: {e}")

    with app.app_context():
        # registro de blueprints y carga de ejercicios
        from .models import Exercise
        from .proxy import proxy_blueprint
        from .auth import auth_blueprint
        from .exercise import exercise_blueprint
        from .question_blueprint import question_blueprint
        from .license_blueprint import license_bp

        app.register_blueprint(auth_blueprint)
        app.register_blueprint(exercise_blueprint)
        app.register_blueprint(proxy_blueprint)
        app.register_blueprint(license_bp)

        db.create_all()

        if not Exercise.query.first():
            json_path = os.path.join(os.path.dirname(__file__), "exercises.json")
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    # Leemos el contenido bruto
                    file_content = f.read().strip()

                    # Si no hay contenido, evitamos decodificar
                    if not file_content:
                        print(f"El archivo {json_path} está vacío. No se crearon ejercicios.")
                    else:
                        # Decodificamos el JSON
                        exercises_data = json.loads(file_content)

                        # Verificamos si el JSON decodificado está vacío
                        if not exercises_data:
                            print("El JSON está vacío (array o diccionario sin datos). No se crearon ejercicios.")
                        else:
                            # Cargamos cada ejercicio
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
