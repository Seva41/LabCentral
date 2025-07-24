from flask_sqlalchemy import SQLAlchemy
from . import db
from flask_bcrypt import generate_password_hash, check_password_hash
from datetime import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)

    first_name = db.Column(db.String(80), nullable=True)
    last_name = db.Column(db.String(80), nullable=True)
    force_password_change = db.Column(db.Boolean, default=False)

    reset_token = db.Column(db.String(128), nullable=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)

    completed_exercises = db.relationship('CompletedExercise', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class CompletedExercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exercise_id = db.Column(db.Integer, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Exercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    dockerfile_path = db.Column(db.String(200), nullable=False)
    port = db.Column(db.Integer, nullable=False)

class ExerciseQuestion(db.Model):
    __tablename__ = 'exercise_question'
    id = db.Column(db.Integer, primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
    question_text = db.Column(db.String(255), nullable=False)
    question_body = db.Column(db.Text, nullable=True)
    question_type = db.Column(db.String(50), default='abierta')
    choices = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    score = db.Column(db.Integer, nullable=False, default=0)

class ExerciseAnswer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('exercise_question.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    answer_text = db.Column(db.Text, nullable=False)
    score = db.Column(db.Float, nullable=True)
    feedback = db.Column(db.Text, nullable=True)

class ExerciseGroup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
    leader_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    partner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)

    # Relaciones para facilitar consultas
    exercise = db.relationship('Exercise', backref='groups')
    leader = db.relationship('User', foreign_keys=[leader_id])
    partner = db.relationship('User', foreign_keys=[partner_id])


class GroupExerciseAnswer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('exercise_group.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('exercise_question.id'), nullable=False)
    answer_text = db.Column(db.Text, nullable=False)
    score = db.Column(db.Float, nullable=True)

class License(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.Text, nullable=False, unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    valid_until = db.Column(db.DateTime, nullable=False)

    user = db.relationship('User', backref='licenses')

    def is_valid(self):
        return self.valid_until > datetime.utcnow()
