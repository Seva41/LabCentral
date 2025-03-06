import requests
from flask import Blueprint, request, jsonify, Response
from .exercise import decode_token, client
from .models import Exercise

proxy_blueprint = Blueprint('proxy', __name__)

def get_container_ip(container_name):
    container = client.containers.get(container_name)
    networks = container.attrs['NetworkSettings']['Networks']
    if not networks:
        return None
    first_network = list(networks.keys())[0]
    return networks[first_network]['IPAddress']

@proxy_blueprint.route('/api/exercise/<int:exercise_id>/proxy', defaults={'path': ''}, methods=['GET','POST','PUT','PATCH','DELETE'])
@proxy_blueprint.route('/api/exercise/<int:exercise_id>/proxy/<path:path>', methods=['GET','POST','PUT','PATCH','DELETE'])
def proxy_to_exercise(exercise_id, path):
    # 1. Leer el JWT
    decoded = decode_token()
    if not decoded:
        return jsonify({"error": "Unauthorized"}), 401
    user_id = decoded["user_id"]

    # 2. Verificar que el contenedor es del usuario
    container_name = f"user-{user_id}-exercise-{exercise_id}"
    try:
        container = client.containers.get(container_name)
    except:
        return jsonify({"error": "Container not found"}), 404

    # 3. Obtener IP interna
    container_ip = get_container_ip(container_name)
    if not container_ip:
        return jsonify({"error": "No container IP found"}), 500

    # 4. Reenviar la petición con requests
    internal_url = f"http://{container_ip}:5000/{path}"
    method = request.method
    headers = {k: v for k, v in request.headers if k.lower() != 'host'}
    data = request.get_data()
    params = request.args

    resp = requests.request(method, internal_url, headers=headers, params=params, data=data)

    # 5. Construir la respuesta
    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    response_headers = [(name, value) for (name, value) in resp.headers.items() if name.lower() not in excluded_headers]

    return Response(resp.content, resp.status_code, response_headers)
