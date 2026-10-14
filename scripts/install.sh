#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

fail() { echo "Error: $*" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || fail "instala Docker Engine y el complemento Docker Compose."
docker compose version >/dev/null 2>&1 || fail "no se encontró Docker Compose v2."
command -v openssl >/dev/null 2>&1 || fail "instala openssl."
command -v curl >/dev/null 2>&1 || fail "instala curl."

created_env=false
if [ ! -f .env ]; then
  cp .env.example .env
  created_env=true
  set_env() {
    key=$1 value=$2
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  }
  set_env POSTGRES_PASSWORD "$(openssl rand -hex 32)"
  set_env FLAG_PEPPER "$(openssl rand -hex 32)"
  set_env SETUP_KEY "$(openssl rand -hex 32)"
  uid=$(id -u); gid=$(id -g)
  [ "$uid" -ne 0 ] || uid=1000
  [ "$gid" -ne 0 ] || gid=1000
  set_env BACKUP_UID "$uid"
  set_env BACKUP_GID "$gid"
  chmod 600 .env
else
  chmod 600 .env
fi

if grep -Eq '^(POSTGRES_PASSWORD|FLAG_PEPPER|SETUP_KEY)=(|replace-with.*)$' .env; then
  fail "revisa .env: hay secretos pendientes de configurar."
fi
database_name=$(sed -n 's/^POSTGRES_DB=//p' .env | tail -n 1)
case "$database_name" in ''|*[!A-Za-z0-9_]*|[0-9]*) fail "POSTGRES_DB debe usar solo letras, números y guion bajo, y no comenzar con un número." ;; esac
mkdir -p backups
chmod 700 backups
if [ "$(id -u)" -eq 0 ]; then
  backup_uid=$(sed -n 's/^BACKUP_UID=//p' .env | tail -n 1); backup_uid=${backup_uid:-1000}
  backup_gid=$(sed -n 's/^BACKUP_GID=//p' .env | tail -n 1); backup_gid=${backup_gid:-1000}
  chown "$backup_uid:$backup_gid" backups
fi
port=$(sed -n 's/^LABCENTRAL_HTTP_PORT=//p' .env | tail -n 1)
port=${port:-8000}
case "$port" in *[!0-9]*|'') fail "LABCENTRAL_HTTP_PORT debe ser un puerto numérico." ;; esac

# A re-deploy gets a recoverable copy before any new image or migration is applied.
if docker compose ps --status running --services 2>/dev/null | grep -qx db; then
  echo "Creando una copia previa al despliegue…"
  ./scripts/backup.sh || fail "no se pudo crear la copia previa; no se actualizaron los servicios."
fi

docker compose config --quiet || fail "la configuración de Compose no es válida."
echo "Construyendo e iniciando LabCentral 2…"
docker compose up -d --build
if ! curl --fail --silent --show-error --retry 60 --retry-connrefused --retry-delay 2 --retry-max-time 150 "http://127.0.0.1:${port}/health/ready" >/dev/null; then
  docker compose logs --tail=80 db migrate app caddy >&2 || true
  fail "la aplicación no quedó lista; revisa los logs mostrados y vuelve a ejecutar este instalador después de corregir el problema."
fi

echo "LabCentral 2 está listo en http://IP-DEL-SERVIDOR:${port}"
if [ "$created_env" = true ]; then
  echo "La clave de instalación inicial quedó guardada en .env; consúltala con: grep '^SETUP_KEY=' .env"
fi
echo "Servicios: docker compose ps"
echo "Logs: docker compose logs -f app"
