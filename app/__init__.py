from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_migrate import Migrate
import os
import json

basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, '..', 'instance', 'app.db')

db = SQLAlchemy()
bcrypt = Bcrypt()
migrate = Migrate()

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'replace-this-with-a-strong-secret'
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"

    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    CORS(app, supports_credentials=True, resources={r"/*": {"origins": "http://localhost:3000"}})

    with app.app_context():
        from .models import Exercise
        from .proxy import proxy_blueprint
        from .auth import auth_blueprint
        from .exercise import exercise_blueprint

        app.register_blueprint(auth_blueprint)
        app.register_blueprint(exercise_blueprint)
        app.register_blueprint(proxy_blueprint)

        # Crea las tablas si no existen
        db.create_all()

        # Si no hay ejercicios en la BD, cargarlos desde exercises.json
        if not Exercise.query.first():
            json_path = "/app/app/exercises.json"
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    exercises_data = json.load(f)

                for item in exercises_data:
                    new_exercise = Exercise(
                        title=item["title"],
                        description=item["description"],
                        dockerfile_path=item["dockerfile_path"],
                        port=item["port"]
                    )
                    db.session.add(new_exercise)

                db.session.commit()
                print("Ejercicios creados exitosamente desde exercises.json")
            except FileNotFoundError:
                print(f"No se encontró el archivo {json_path}. No se crearon ejercicios.")
            except json.JSONDecodeError as e:
                print(f"Error al decodificar JSON: {str(e)}. No se crearon ejercicios.")

    return app
