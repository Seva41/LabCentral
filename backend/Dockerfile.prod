# Dockerfile
FROM python:3.9-slim

# Set work directory
WORKDIR /app

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
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "run:app"]
