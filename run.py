from app import create_app, db

app = create_app()

# Crear la base de datos en el primer inicio
with app.app_context():
    db.create_all()

import os

if __name__ == "__main__":
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() in ['true', '1', 'yes']
    app.run(host='0.0.0.0', port=5001, debug=debug_mode)