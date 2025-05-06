import requests
import re
from flask import Blueprint, request, jsonify, Response, current_app
import html
from urllib.parse import urljoin, quote
from .exercise import decode_token, client
import bleach
from bs4 import BeautifulSoup

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
            # Raw HTML from the container
            html_content = resp.text

            # Prepare safe rewriting
            proxy_prefix = f"/api/exercise/{exercise_id}/proxy/"
            safe_path = quote(path, safe="")  # percent-encode the path

            # Parse HTML safely
            soup = BeautifulSoup(html_content, "html.parser")

            # Rewrite href/src attributes
            for tag in soup.find_all(["a", "link", "script", "img"]):
                attr = "href" if tag.name in ["a", "link"] else "src"
                if tag.has_attr(attr):
                    url = tag[attr]
                    if url.startswith("/"):
                        tag[attr] = proxy_prefix + url.lstrip("/")
                    elif url.startswith("./"):
                        tag[attr] = proxy_prefix + url[2:]

            # Rewrite form actions
            for form in soup.find_all("form"):
                form["action"] = proxy_prefix + safe_path

            # Define a stricter bleach Cleaner
            ALLOWED_TAGS = bleach.sanitizer.ALLOWED_TAGS + ["form", "input", "button"]
            ALLOWED_ATTRS = {
                **bleach.sanitizer.ALLOWED_ATTRIBUTES,
                "form": ["action", "method"],
                "input": ["type", "name", "value"],
                "button": ["type", "name"],
            }

            cleaner = bleach.Cleaner(
                tags=ALLOWED_TAGS,
                attributes=ALLOWED_ATTRS,
                protocols=["http", "https"],
                strip=True
            )

            # Clean the rewritten HTML
            clean_html = cleaner.clean(str(soup))
            content = clean_html.encode("utf-8")

        return Response(content, resp.status_code, headers=headers)

    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"RequestException occurred: {str(e)}")
        return jsonify({"error": "An internal error occurred"}), 502
