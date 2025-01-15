# app/__init__.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS

db = SQLAlchemy()
bcrypt = Bcrypt()

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'replace-this-with-a-strong-secret'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
    
    db.init_app(app)
    bcrypt.init_app(app)
    CORS(app)  # Allows cross-origin requests from React (localhost:3000, etc.)

    from .auth import auth_blueprint
    from .exercise import exercise_blueprint
    
    app.register_blueprint(auth_blueprint)
    app.register_blueprint(exercise_blueprint)

    with app.app_context():
        db.create_all()

    return app
