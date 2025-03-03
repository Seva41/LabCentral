from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_migrate import Migrate
import os



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
    CORS(app)

    with app.app_context():
        from .models import Exercise
        from .proxy import proxy_blueprint
        from .auth import auth_blueprint
        from .exercise import exercise_blueprint
        app.register_blueprint(auth_blueprint)
        app.register_blueprint(exercise_blueprint)

        # Crea las tablas si no existen
        db.create_all()

        app.register_blueprint(proxy_blueprint)

        # Poblar la base de datos con ejercicios si está vacía
        # Reemplaza el bloque del if not Exercise.query.first():
        if not Exercise.query.first():
            exercises = [
                Exercise(
                    title="CTF 2",
                    description="Test curso",
                    dockerfile_path="dockerfiles/ctf2",
                    port=8001
                ),
                Exercise(
                    title="SQL Injection",
                    description="Exploit an SQL injection vulnerability.",
                    dockerfile_path="dockerfiles/sql_injection",
                    port=8002
                ),
                Exercise(
                    title="XSS Attack",
                    description="Learn how cross-site scripting works.",
                    dockerfile_path="dockerfiles/xss_attack",
                    port=8003
                )
            ]
            db.session.add_all(exercises)
            db.session.commit()
            print("Ejercicios creados exitosamente")


    return app
