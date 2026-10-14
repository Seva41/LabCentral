#!/bin/sh
set -eu

interval=${BACKUP_INTERVAL_SECONDS:-86400}
retention_days=${BACKUP_RETENTION_DAYS:-14}
mkdir -p /backups
find /backups -type f \( -name 'labcentral-*.partial' -o -name 'labcentral-*-assets.tar.gz.partial' \) -mmin +120 -delete

while :; do
    stamp=$(date -u +%Y%m%dT%H%M%SZ)
    db_temporary="/backups/labcentral-${stamp}.dump.partial"
    db_output="/backups/labcentral-${stamp}.dump"
    assets_temporary="/backups/labcentral-${stamp}-assets.tar.gz.partial"
    assets_output="/backups/labcentral-${stamp}-assets.tar.gz"
    if pg_dump --format=custom --no-owner --file="$db_temporary" && tar --exclude='*.partial' -C /assets/objects -czf "$assets_temporary" .; then
        chmod 600 "$db_temporary" "$assets_temporary"
        mv "$db_temporary" "$db_output"
        mv "$assets_temporary" "$assets_output"
        find /backups -type f -name 'labcentral-*.dump' -mtime "+${retention_days}" -delete
        find /backups -type f -name 'labcentral-*-assets.tar.gz' -mtime "+${retention_days}" -delete
        echo "Backup PostgreSQL y archivos creado: ${stamp}"
    else
        rm -f "$db_temporary" "$assets_temporary"
        echo "Falló el backup; se volverá a intentar en 15 minutos." >&2
        sleep 900
        continue
    fi
    sleep "$interval"
done
