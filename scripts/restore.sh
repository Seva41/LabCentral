#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "Uso: $0 backups/labcentral-FECHA.dump" >&2
  exit 2
fi
backup_file=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
stamp=$(basename "$backup_file" .dump)
assets_file="$(dirname "$backup_file")/${stamp}-assets.tar.gz"
if [ -f "$assets_file" ]; then
  assets_file=$(cd "$(dirname "$assets_file")" && pwd)/$(basename "$assets_file")
fi
printf 'Esto reemplazará los datos y archivos de LabCentral 2. Escribe RESTORE para continuar: '
read -r answer
if [ "$answer" != "RESTORE" ]; then
  echo "Restauración cancelada."
  exit 1
fi
cd "$(dirname "$0")/.."
database_name=$(sed -n 's/^POSTGRES_DB=//p' .env | tail -n 1)
case "$database_name" in
  ''|*[!A-Za-z0-9_]*|[0-9]*) echo "POSTGRES_DB debe usar solo letras, números y guion bajo." >&2; exit 2 ;;
esac
restore_db="lc_restore_$(date +%s)_$$"
previous_db="lc_previous_$(date +%s)_$$"
cleanup() {
  docker compose exec -T db dropdb --maintenance-db=template1 --if-exists --force -U "$(sed -n 's/^POSTGRES_USER=//p' .env | tail -n 1)" "$restore_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

if ./scripts/backup.sh; then
  echo "Respaldo previo a la restauración creado."
else
  echo "Aviso: no se pudo crear un respaldo del estado actual; continuará la restauración solicitada." >&2
fi
docker compose stop app backup

# Load into a fresh temporary database first so a damaged dump cannot destroy the current database.
if ! docker compose exec -T db sh -c 'createdb --maintenance-db=template1 --owner="$POSTGRES_USER" -U "$POSTGRES_USER" "$1" && pg_restore --exit-on-error --no-owner --single-transaction -U "$POSTGRES_USER" -d "$1"' sh "$restore_db" < "$backup_file"; then
  echo "No se pudo cargar el backup; la base de datos activa permanece intacta." >&2
  exit 1
fi

if [ -f "$assets_file" ]; then
  docker compose run --rm --no-deps -v "$assets_file:/restore-assets.tar.gz:ro" --entrypoint python app - /restore-assets.tar.gz <<'PY'
import os, re, shutil, sys, tarfile, uuid
from pathlib import Path, PurePosixPath

archive = Path(sys.argv[1])
parent = Path("/var/lib/labcentral/assets")
root = parent / "objects"
stage = parent / f".objects.restore-{uuid.uuid4().hex}"
previous = parent / ".objects.previous"

if previous.exists():
    if root.exists():
        shutil.rmtree(previous)
    else:
        os.replace(previous, root)

try:
    with tarfile.open(archive, "r:gz") as bundle:
        files = []
        total = 0
        for member in bundle.getmembers():
            name = member.name
            while name.startswith("./"):
                name = name[2:]
            if name in {"", "."} and member.isdir():
                continue
            parts = PurePosixPath(name).parts
            if len(parts) == 1 and parts[0].isdigit() and member.isdir():
                continue
            if (len(parts) != 2 or not parts[0].isdigit()
                    or not re.fullmatch(r"[0-9a-f]{32}\.blob", parts[1])
                    or not member.isfile() or member.issym() or member.islnk()
                    or member.size > 5 * 1024 * 1024):
                raise SystemExit(f"Archivo inválido en backup: {member.name}")
            total += member.size
            if total > 50 * 1024 * 1024 * 1024:
                raise SystemExit("El backup supera el límite de restauración de 50 GiB")
            files.append((member, int(parts[0]), parts[1]))
        stage.mkdir(mode=0o755)
        for member, event_id, filename in files:
            folder = stage / str(event_id)
            folder.mkdir(mode=0o755, exist_ok=True)
            source = bundle.extractfile(member)
            if source is None:
                raise SystemExit(f"No se pudo leer: {member.name}")
            target = folder / filename
            with source, target.open("xb") as output:
                shutil.copyfileobj(source, output, length=64 * 1024)
            os.chmod(target, 0o644)
    if root.exists():
        os.replace(root, previous)
    try:
        os.replace(stage, root)
    except Exception:
        if previous.exists() and not root.exists():
            os.replace(previous, root)
        raise
    if previous.exists():
        shutil.rmtree(previous)
except Exception:
    if stage.exists():
        shutil.rmtree(stage)
    raise
PY
else
  echo "Aviso: este backup antiguo no incluye archivos adjuntos."
fi

# Keep the current database until the temporary restore and assets are ready.
if ! docker compose exec -T db sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d template1 -c "ALTER DATABASE \"$POSTGRES_DB\" RENAME TO \"$1\"" && psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d template1 -c "ALTER DATABASE \"$2\" RENAME TO \"$POSTGRES_DB\""' sh "$previous_db" "$restore_db"; then
  docker compose exec -T db sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d template1 -c "ALTER DATABASE \"$1\" RENAME TO \"$POSTGRES_DB\""' sh "$previous_db" >/dev/null 2>&1 || true
  echo "No se pudo activar la copia restaurada; se intentó recuperar el nombre original de la base." >&2
  exit 1
fi
docker compose exec -T db sh -c 'dropdb --maintenance-db=template1 --if-exists --force -U "$POSTGRES_USER" "$1"' sh "$previous_db"
echo "Restauración completada. Inicia los servicios con: docker compose up -d"
