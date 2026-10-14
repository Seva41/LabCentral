#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
if [ "$#" -ne 1 ]; then
  echo "Uso: $0 nombre-de-usuario" >&2
  exit 2
fi
username=$1
docker compose exec -it app python -c '
import getpass
import sys
from sqlalchemy import delete, select
from app.database import SessionLocal
from app.models import LoginSession, PasswordResetToken, User
from app.security import hash_password

username = sys.argv[1].strip().lower()
password = getpass.getpass("Nueva contraseña (12+ caracteres): ")
if len(password) < 12 or len(password) > 200:
    raise SystemExit("La contraseña debe tener entre 12 y 200 caracteres.")
with SessionLocal() as db:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        raise SystemExit("No existe ese usuario.")
    user.password_hash = hash_password(password)
    db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    db.commit()
print("Contraseña actualizada; las sesiones anteriores fueron revocadas.")
' "$username"
