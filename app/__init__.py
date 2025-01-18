from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_migrate import Migrate

db = SQLAlchemy()
bcrypt = Bcrypt()
migrate = Migrate()

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'replace-this-with-a-strong-secret'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
    
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    CORS(app)

    with app.app_context():
        from .models import Exercise

        from .auth import auth_blueprint
        from .exercise import exercise_blueprint
        app.register_blueprint(auth_blueprint)
        app.register_blueprint(exercise_blueprint)

        # Crea las tablas si no existen
        db.create_all()

        # Poblar la base de datos con ejercicios si está vacía
        if not Exercise.query.first():
            exercises = [
                Exercise(
                    title="Basic Networking",
                    description="Learn basic networking concepts.",
                    docker_image="exercise1",
                    port=8001
                ),
                Exercise(
                    title="SQL Injection",
                    description="Exploit an SQL injection vulnerability.",
                    docker_image="exercise2",
                    port=8002
                ),
                Exercise(
                    title="XSS Attack",
                    description="Learn how cross-site scripting works.",
                    docker_image="exercise3",
                    port=8003
                )
            ]
            db.session.add_all(exercises)
            db.session.commit()
            print("Ejercicios creados exitosamente")

    return app
