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

basedir = os.path.abspath(os.path.dirname(__file__))
instance_dir = os.path.join(basedir, "..", "instance")
os.makedirs(instance_dir, exist_ok=True)
db_path = os.path.join(instance_dir, "app.db")

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
    CORS(
        app,
        supports_credentials=True,
        resources={
            r"/*": {
                "origins": [
                    "http://192.168.191.100:3000",
                    "http://172.18.0.3:3000",
                    "http://localhost:3000",
                    "http://10.80.3.10:3000",
                    "http://10.80.3.200:3000",
                    "https://10.80.3.200:3000",
                    "http://10.0.1.100:3000",
                    "https://10.0.1.100:3000"
                ]
            }
        },
    )

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

    with app.app_context():
        # registro de blueprints y carga de ejercicios
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

        if not Exercise.query.first():
            json_path = "/app/app/exercises.json"
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    exercises_data = json.load(f)
                for item in exercises_data:
                    new_exercise = Exercise(
                        title=item["title"],
                        description=item["description"],
                        dockerfile_path=item["dockerfile_path"],
                        port=item["port"],
                    )
                    db.session.add(new_exercise)
                db.session.commit()
                print("Ejercicios creados exitosamente desde exercises.json")
            except FileNotFoundError:
                print(
                    f"No se encontró el archivo {json_path}. No se crearon ejercicios."
                )
            except json.JSONDecodeError as e:
                print(f"Error al decodificar JSON: {str(e)}. No se crearon ejercicios.")

    return app
