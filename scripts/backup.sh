#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
db_output="backups/labcentral-${stamp}.dump"
db_temporary="${db_output}.partial"
assets_output="backups/labcentral-${stamp}-assets.tar.gz"
assets_temporary="${assets_output}.partial"
cleanup() { rm -f "$db_temporary" "$assets_temporary"; }
trap cleanup EXIT HUP INT TERM

if ! docker compose exec -T db sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$db_temporary"; then
  echo "No se pudo ejecutar pg_dump; verifica que el servicio db esté activo." >&2
  exit 1
fi
if [ ! -s "$db_temporary" ]; then
  echo "La copia PostgreSQL quedó vacía." >&2
  exit 1
fi
if ! docker compose exec -T backup tar --exclude='*.partial' -C /assets/objects -czf - . > "$assets_temporary"; then
  echo "No se pudo crear la copia de archivos adjuntos." >&2
  exit 1
fi
if [ ! -s "$assets_temporary" ]; then
  echo "La copia de archivos adjuntos quedó vacía." >&2
  exit 1
fi
chmod 600 "$db_temporary" "$assets_temporary"
mv "$db_temporary" "$db_output"
mv "$assets_temporary" "$assets_output"
trap - EXIT HUP INT TERM
echo "Copia de base de datos y archivos creada: $stamp"
