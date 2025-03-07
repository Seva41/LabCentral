from app import create_app, db

app = create_app()

# Crear la base de datos en el primer inicio
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001, debug=True)