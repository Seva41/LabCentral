# LabCentral 2

Portal en español para organizar eventos CTF en una red local o por internet. Incluye cuentas, eventos individuales y por equipos, retos con puntaje fijo o dinámico, tablero en vivo, checkpoints, archivos adjuntos, recuperación de contraseñas y señales de integridad.

**Hecho por Sebastián Dinator · [sebadinator.com](https://sebadinator.com)**

Esta versión sustituye la aplicación anterior del repositorio por el overhaul LabCentral 2. Se conservan la licencia y los avisos de atribución en [LICENSE](LICENSE) y [COPYRIGHT](COPYRIGHT).

> ¿Es la primera vez que lo instalas? Sigue la [guía paso a paso para principiantes](docs/GUIA_PASO_A_PASO.md), desde preparar Linux hasta crear un evento, invitar participantes, hacer respaldos y resolver problemas comunes.

## Capacidades

- La primera cuenta organizadora se protege con una clave generada en `.env`.
- Registro mediante código aleatorio por evento y código independiente para entrar a equipos.
- Eventos individuales o por equipos, con inicio manual/programado, término y reloj.
- Retos que se agregan, editan o retiran durante la sesión. Al retirarlos se conservan las soluciones registradas.
- Puntaje fijo o dinámico: `máximo(mínimo, inicial − soluciones previas × baja)`.
- Tablero WebSocket con Redis Pub/Sub entre workers; PostgreSQL conserva puntajes y estado autoritativos. El navegador vuelve a consultar si se pierde la conexión.
- Adjuntos de retos privados por evento, descargados solo por sus participantes u organización.
- Recuperación de contraseña por correo con token de un solo uso, vencimiento a 30 minutos y revocación de sesiones previas.
- Señales de intentos reiterados de flags incorrectas, revisables y exportables por organización. No aplican sanciones automáticas.
- CSV protegido contra fórmulas; checkpoints descargables y restauración de soluciones.
- Limpieza periódica de sesiones, adjuntos incompletos y registros antiguos (90 días por defecto).
- PostgreSQL persistente, migraciones Alembic, reinicio de contenedores, backups diarios de base y archivos.

## Instalación automatizada en Linux

Requisitos: Docker Engine con el complemento Docker Compose v2, `openssl`, `curl` y acceso de red desde los clientes al servidor. Ejecuta como el usuario Linux que administra Docker (no hace falta instalar Python en el host):

```sh
./scripts/install.sh
```

El instalador crea `.env` si no existe, genera secretos aleatorios distintos, protege el archivo con permisos `0600`, prepara el directorio de copias, valida Compose, compila e inicia los servicios, ejecuta la migración y espera a que `/health/ready` responda. Al actualizar una instalación activa, genera primero una copia de respaldo. Al volver a ejecutarlo respeta la configuración existente.

Abre `http://IP-DEL-SERVIDOR:8000`, consulta la clave inicial con `grep '^SETUP_KEY=' .env` y crea la cuenta organizadora. Desde ella crea un evento y comparte el código con los participantes. Para revisar el servicio: `docker compose ps` y `docker compose logs -f app`.

<<<<<<< HEAD
```bash
 cd frontend/labselector
 npm i
=======
La publicación inicial escucha en el puerto 8000 y está pensada para una LAN confiable. PostgreSQL y Redis no publican puertos al host. Los datos viven en volúmenes Docker; `docker compose down` los conserva. **No uses `docker compose down -v`** salvo que intencionalmente quieras eliminar datos y adjuntos.

### Acceso por internet con HTTPS

Configura un dominio con DNS hacia el servidor, permite TCP 80/443 en el firewall/router y edita `.env`:

```dotenv
PUBLIC_DOMAIN=ctf.ejemplo.cl
PUBLIC_BASE_URL=https://ctf.ejemplo.cl
LABCENTRAL_HTTP_PORT=80
LABCENTRAL_HTTPS_PORT=443
COOKIE_SECURE=true
>>>>>>> 39c64e2 (feat: replace legacy LabCentral app with LabCentral 2 CTF platform)
```

Después ejecuta `./scripts/install.sh`. Caddy obtiene y renueva el certificado TLS. Si existe otro proxy delante, conserva `Host` y configura solo proxies de confianza. No publiques puertos de app, base de datos ni Redis.

### Recuperación de contraseñas por correo

La entrega de enlaces necesita una cuenta de correo saliente/relay SMTP. Edita estos valores en `.env` y vuelve a iniciar el servicio con `docker compose up -d`:

```dotenv
PUBLIC_BASE_URL=https://ctf.ejemplo.cl
SMTP_HOST=smtp.ejemplo.cl
SMTP_PORT=587
SMTP_USERNAME=labcentral@ejemplo.cl
SMTP_PASSWORD=SECRETO_DEL_RELAY
SMTP_FROM="LabCentral 2 <labcentral@ejemplo.cl>"
SMTP_STARTTLS=true
SMTP_USE_SSL=false
```

Usa `SMTP_USE_SSL=true` para SMTPS implícito, por ejemplo puerto 465; no habilites SSL implícito y STARTTLS a la vez. `PUBLIC_BASE_URL` debe ser una URL que los usuarios puedan abrir. Para una LAN reemplázala por `http://IP-DEL-SERVIDOR:8000`. El contenedor app tiene salida por la red `mail-egress`; restringe en el firewall del host esa salida al relay y puerto que administres. Sin SMTP configurado, el formulario responde de forma genérica pero no entrega enlaces. Las cuentas existentes pueden guardar su correo desde el botón **Agregar correo**, confirmando su contraseña actual.

Si el relay no está disponible y administras el servidor, puedes recuperar una cuenta directamente en forma interactiva. La contraseña no se pasa en argumentos ni se escribe en logs:

```sh
./scripts/reset-password.sh nombre-de-usuario
```

Los mensajes de recuperación no revelan si una cuenta existe. Se limita la frecuencia; los tokens se guardan como digest, solo funcionan una vez y expiran. Un cambio de contraseña invalida todas las sesiones abiertas. Las cuentas migradas desde versiones anteriores pueden añadir su correo luego de iniciar sesión.

## Archivos adjuntos

La organización puede adjuntar hasta 20 archivos por reto, con máximo 5 MiB por archivo; la cuota predeterminada es 1 GiB por evento (`ASSET_EVENT_QUOTA_BYTES`). Se aceptan `.txt`, `.md`, `.pdf`, imágenes PNG/JPEG, `.zip`, `.pcap`, `.pcapng`, `.csv`, `.json` y `.bin`. No se extraen archivos comprimidos, no se sirven desde la web estática y todas las descargas usan `application/octet-stream` con autorización de evento. Nombres originales se conservan solo para presentación; el almacenamiento usa nombres aleatorios y digest SHA-256. Se admiten 4 cargas simultáneas por worker (`MAX_CONCURRENT_UPLOADS`) para mantener acotado el espacio temporal.

Los archivos viven en un volumen Docker separado de la aplicación web. Deben considerarse contenido potencialmente malicioso: la lista de extensiones y `Content-Disposition: attachment` reducen ejecución accidental, pero no reemplazan análisis antimalware ni validación de quien organiza. Revisa los adjuntos antes de publicarlos.

## Operación, actualizaciones y capacidad

La app ejecuta 2 workers por contenedor por defecto, con concurrencia, conexiones de base de datos y colas WebSocket acotadas. Redis distribuye eventos y límites de frecuencia entre workers. Ajusta `APP_WORKERS`, `WORKER_MAX_CONCURRENCY`, `DB_POOL_SIZE` y `DB_MAX_OVERFLOW` según RAM y conexiones permitidas por PostgreSQL; el máximo aproximado de conexiones es réplicas × workers × (pool + overflow).

Se puede escalar la app en un mismo host:

```sh
docker compose up -d --build --scale app=3
```

Caddy encuentra las réplicas por DNS de Docker. Mantén el total de conexiones por debajo del límite de PostgreSQL. El volumen de archivos es compartido entre ellas.

Las nuevas migraciones se ejecutan en el servicio `migrate` antes de iniciar las réplicas. Para actualizar con el instalador, ejecuta `./scripts/install.sh`; antes de actualizar, el script respalda la base de datos y los adjuntos. PostgreSQL es una instancia única: reinicio y backups ayudan a recuperarse de fallos de procesos/disco lógico, pero varias réplicas web no ofrecen failover de servidor ni de base de datos.

Si Redis cae, la app usa límites locales acotados por proceso, el fan-out entre procesos deja de estar disponible temporalmente y el dashboard sigue refrescando cada 30 segundos. PostgreSQL sigue siendo la fuente autoritativa de puntajes y progreso.

## Seguridad y aislamiento

- Contraseñas derivadas con PBKDF2-HMAC-SHA256; flags almacenadas como HMAC con `FLAG_PEPPER` estable.
- Sesiones aleatorias almacenadas como digest, cookie `HttpOnly`/`SameSite=Strict`, token CSRF, validación de origen y expiración a 12 horas.
- Inicio de sesión, alta, acceso a eventos y envío de flags limitados con Redis y fallback en memoria acotada.
- El proxy Caddy limita solicitudes a 6 MiB; la app permite 256 KiB para JSON y 5 MiB por archivo. Caddy limita encabezados y corta conexiones que quedan inactivas; la app acota concurrencia, WebSockets, timeouts de base y pools.
- App y migrador no corren como root, usan filesystem de solo lectura, pierden capabilities y no montan el socket de Docker. El volumen de adjuntos es la única ruta persistente escribible por la app.
- Las señales de integridad cubren flags incorrectas reiteradas (5 o más en 10 minutos, con una alerta por participante cada 30 minutos). No guardan el texto de las respuestas ni direcciones IP. Son indicadores para que una persona revise el contexto; no prueban trampas.
- El producto presenta retos con instrucciones y adjuntos. **No ejecuta código de participantes, no crea máquinas vulnerables ni ofrece una red de laboratorio**. Así, un usuario no recibe una ruta de red a otro. Si se agregan entornos ejecutables, deben vivir en infraestructura aparte, con aislamiento por equipo, egreso bloqueado y sin acceso a la red de gestión.

La red `mail-egress` da salida de red al servicio app para alcanzar el relay SMTP. Restringe esa salida en el firewall del host al relay y puerto conocidos; la base de datos, Redis y el backup permanecen sin acceso externo. El código de invitación no sustituye HTTPS, firewall ni autenticación.

## Backups, checkpoints y recuperación

El servicio `backup` hace una copia `pg_dump` y un archivo `tar.gz` de adjuntos al iniciar y luego cada 24 horas. Los archivos correspondientes llevan la misma marca UTC (`labcentral-FECHA.dump` y `labcentral-FECHA-assets.tar.gz`), se escriben primero como parciales y se conservan 14 días (`BACKUP_INTERVAL_SECONDS`, `BACKUP_RETENTION_DAYS`). Permisos `0600`. También puedes generar una copia manual:

<<<<<<< HEAD
1. Asegúrese de que el contenedor del backend esté corriendo (p.ej., `labcentral-backend`).
2. Abra una terminal en dicho contenedor:
   ```bash
   docker-compose exec webapp bash
   ```
3. Ingrese al shell de Flask:
   ```bash
   flask shell
   ```
4. Dentro del shell de Flask, ejecute:
   ```python
   from app import db
   from app.models import User
  
   user = User(email='admin@example.com', is_admin=True)
   user.set_password('password123')
   db.session.add(user)
   db.session.commit()
   
   ```
5. Cierre el shell y la terminal. Ahora podrá iniciar sesión con las credenciales indicadas (email: `admin@example.com`, password: `password123`).
=======
```sh
./scripts/backup.sh
ls -lh backups/
```
>>>>>>> 39c64e2 (feat: replace legacy LabCentral app with LabCentral 2 CTF platform)

Guarda ambos archivos de la misma fecha fuera del servidor; incluye `.env` cifrado/protegido por separado. Para restaurar, el script detiene app y backup, solicita confirmación y, si encuentra el par de adjuntos, valida las rutas del archivo antes de extraerlo:

```sh
./scripts/restore.sh backups/labcentral-FECHA.dump
docker compose up -d
```

Los respaldos antiguos `.dump` sin `-assets.tar.gz` siguen restaurando la base, pero no contienen archivos adjuntos. Los checkpoints guardan estado del evento y soluciones (hasta 20 por evento); restaurarlos reemplaza el conjunto de soluciones, no revierte usuarios, equipos, edición de retos ni adjuntos. Para una recuperación integral usa el par del backup.

Una copia en el mismo disco protege de algunos errores lógicos y caídas de procesos, no de pérdida/robo del host. PostgreSQL conserva fsync por defecto; checksums se habilitan al crear un volumen nuevo y no se activan retroactivamente.

## Diagnóstico

- `GET /health/live`: el proceso web responde.
- `GET /health/ready`: la app puede consultar PostgreSQL.
- `docker compose ps` y `docker compose logs -f app db redis caddy backup`.
- Reinicios automáticos: `restart: unless-stopped`. Tras una caída, confirma readiness y revisa la fecha del último par de backup antes de reabrir un evento.
- Si el instalador no consigue readiness, muestra los logs recientes de DB, migración, app y proxy; corrige la causa y ejecútalo otra vez.

## Arquitectura y código

```mermaid
flowchart LR
  C[Clientes] -->|HTTP(S) / WebSocket| P[Caddy]
  P --> A[LabCentral 2 · FastAPI]
  A --> D[(PostgreSQL · usuarios, eventos y puntajes)]
  A <--> R[(Redis · pub/sub y rate limits)]
  A --> F[(Volumen privado de archivos)]
  B[Backup diario] --> D
  B --> F
  A -->|SMTP opcional| M[Relay de correo]
```

La política de puntaje usa **Strategy** (`app/scoring.py`); `EventStream` implementa fan-out tipo **Observer** (`app/realtime.py`); límites por frecuencia viven en `app/rate_limits.py`; correo SMTP en `app/mailer.py`. API/controladores: `app/main.py`; modelos: `app/models.py`; autenticación: `app/security.py`; migraciones: `migrations/`; scripts de instalación, backup y restore: `scripts/`; interfaz: `app/static/`.

Las rutas con SQLAlchemy son síncronas para que FastAPI las envíe a su threadpool; transferencias usan `UploadFile` y archivos con límites. Pools y timeouts evitan que una conexión lenta bloquee el loop de WebSockets. PostgreSQL conserva el estado autoritativo.

## Límites conocidos

- Un servidor Linux y una sola instancia PostgreSQL. No hay failover de hardware, réplica automática, recuperación punto en el tiempo ni pruebas de carga certificadas.
- Redis es efímero; durante su caída hay fallback con límites locales y polling, pero las ventanas pueden reiniciarse y no existe fan-out cruzado entre workers.
- El correo de recuperación depende de configurar y mantener un relay SMTP alcanzable.
- Los organizadores deben revisar archivos antes de compartirlos; no se incluye antivirus.
- Las ediciones de modelos futuras requieren una revisión Alembic nueva; el instalador la ejecutará antes de servir la app.

## Documentación del stack

- [FastAPI](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.0](https://docs.sqlalchemy.org/en/20/)
- [Alembic](https://alembic.sqlalchemy.org/)
- [Psycopg 3](https://www.psycopg.org/psycopg3/docs/)
- [Redis para Python](https://redis.readthedocs.io/en/stable/)
- [Caddy](https://caddyserver.com/docs/)
