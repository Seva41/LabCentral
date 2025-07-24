# Dockerfile
FROM python:3.12-slim

# Set work directory
WORKDIR /app

# Install build dependencies for psycopg2
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc libpq-dev \
 && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose Flask port
EXPOSE 5001

# Set environment variable for Flask
ENV FLASK_APP=run.py

# Command to run the application
CMD ["flask", "run", "--host=0.0.0.0", "--port=5001"]
