from flask import Blueprint, jsonify

dashboard = Blueprint('dashboard', __name__)

@dashboard.route('/api/dashboard', methods=['GET'])
def get_dashboard_info():
    """
    Endpoint de ejemplo: retorna un JSON con información
    (en lugar de renderizar HTML).
    """
    data = {
        "welcomeMessage": "Hello from Flask!",
        "labs": [
            {"id": 1, "title": "Lab 1", "description": "Description 1"},
            {"id": 2, "title": "Lab 2", "description": "Description 2"}
        ]
    }
    return jsonify(data)