# app/dashboard.py

from flask import Blueprint, jsonify

dashboard = Blueprint('dashboard', __name__)

@dashboard.route('/api/dashboard', methods=['GET'])
def get_dashboard_info():
    # Return JSON data instead of rendering HTML
    data = {
        "welcomeMessage": "Hello from Flask!",
        "labs": [
            {"id": 1, "title": "Lab 1", "description": "Description 1"},
            {"id": 2, "title": "Lab 2", "description": "Description 2"}
        ]
    }
    return jsonify(data)