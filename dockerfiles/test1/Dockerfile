# Usa la imagen base oficial de Python 3.10
FROM python:3.10-slim

# Variables de entorno para Python (opcional, pero suelen ser buenas prácticas)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Instala dependencias del sistema que puedan ser necesarias
RUN apt-get update && apt-get install -y \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Crea el directorio de la app dentro del contenedor
WORKDIR /app

# Copia los archivos de tu proyecto al contenedor
# Usa . (directorio actual) solo si tu Docker build se lanza desde la carpeta del proyecto
COPY . /app

# Instala las dependencias de Python (asume que requirements.txt existe en la raíz)
RUN pip install --no-cache-dir -r requirements.txt

# Expone el puerto 5000 (Flask suele correr en 5000)
EXPOSE 5000

# Comando de arranque
CMD ["python", "app.py"]
