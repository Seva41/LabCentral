import requests
import re
from flask import Blueprint, request, jsonify, Response, current_app
import html
from urllib.parse import urljoin
from .exercise import decode_token, client
import bleach

proxy_blueprint = Blueprint('proxy', __name__)

def get_container_ip(container_name):
    container = client.containers.get(container_name)
    networks = container.attrs['NetworkSettings']['Networks']
    if not networks:
        return None
    first_network = list(networks.keys())[0]
    return networks[first_network]['IPAddress']

@proxy_blueprint.route('/api/exercise/<int:exercise_id>/proxy/', defaults={'path': ''}, methods=['GET','POST','PUT','PATCH','DELETE','OPTIONS'])
@proxy_blueprint.route('/api/exercise/<int:exercise_id>/proxy/<path:path>', methods=['GET','POST','PUT','PATCH','DELETE','OPTIONS'])
def proxy_to_exercise(exercise_id, path=""):
    decoded = decode_token()
    if not decoded:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = decoded["user_id"]
    proxy_prefix = f"/api/exercise/{exercise_id}/proxy"

    container_name = f"user-{user_id}-exercise-{exercise_id}"

    try:
        container = client.containers.get(container_name)
    except Exception as e:
        current_app.logger.error(f"RequestException occurred: {str(e)}")
        return jsonify({"error": "An internal error occurred"}), 404

    container_ip = get_container_ip(container_name)
    if not container_ip:
        return jsonify({"error": "No container IP found"}), 500

    internal_url = f"http://{container_ip}:5000/{path}"

    try:
        resp = requests.request(
            method=request.method,
            url=internal_url,
            headers={key: value for key, value in request.headers if key.lower() != 'host'},
            params=request.args,
            data=request.get_data(),
            allow_redirects=False,
        )

        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        headers = [(name, value) for name, value in resp.headers.items() if name.lower() not in excluded_headers]

        content = resp.content
        content_type = resp.headers.get('Content-Type', '')

        if 'text/html' in content_type:
            html_content = resp.text
            proxy_prefix = html.escape(f"/api/exercise/{exercise_id}/proxy/")

            # Reescribe URLs absolutas (empiezan con /)
            html_content = re.sub(
                r'(href|src)=["\']/(?!api/)',
                rf'\1="{proxy_prefix}',
                html_content
            )

            # Reescribe URLs relativas (empiezan con ./)
            html_content = re.sub(
                r'(href|src)=("|\')\./',
                rf'\1=\2{proxy_prefix}',
                html_content
            )

            # Manejo especial para forms con action=""
            html_content = re.sub(
                r'action=("|\')\s*\1',
                rf'action="{proxy_prefix}{html.escape(path)}"',
                html_content
            )

            # Limpia el HTML para evitar XSS
            html_content = bleach.clean(
                html_content,
                tags=bleach.sanitizer.ALLOWED_TAGS + ["form", "input", "button"],
                attributes=bleach.sanitizer.ALLOWED_ATTRIBUTES,
                protocols=bleach.sanitizer.ALLOWED_PROTOCOLS,
                strip=True
            )

            content = html_content.encode('utf-8')

        return Response(content, resp.status_code, headers=[(name, value) for name, value in headers if name.lower() not in excluded_headers])

    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"RequestException occurred: {str(e)}")
        return jsonify({"error": "An internal error occurred"}), 502
