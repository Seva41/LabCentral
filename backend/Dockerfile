<<<<<<< HEAD:backend/Dockerfile
# Dockerfile
=======
>>>>>>> 39c64e2 (feat: replace legacy LabCentral app with LabCentral 2 CTF platform):Dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

<<<<<<< HEAD:backend/Dockerfile
# Install build dependencies for psycopg2
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc libpq-dev \
 && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
=======
WORKDIR /srv/labcentral
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && groupadd --system labcentral \
    && useradd --system --gid labcentral --home-dir /srv/labcentral labcentral \
    && install -d -m 0755 -o labcentral -g labcentral /var/lib/labcentral/assets/objects
>>>>>>> 39c64e2 (feat: replace legacy LabCentral app with LabCentral 2 CTF platform):Dockerfile

COPY app ./app
COPY alembic.ini ./alembic.ini
COPY migrations ./migrations
USER labcentral:labcentral
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*' --workers ${APP_WORKERS:-2} --limit-concurrency ${WORKER_MAX_CONCURRENCY:-256} --limit-max-requests 10000 --limit-max-requests-jitter 1000 --timeout-keep-alive 5 --timeout-graceful-shutdown 25 --backlog 2048 --ws-max-size 65536 --ws-max-queue 16 --ws-ping-interval 20 --ws-ping-timeout 20"]
