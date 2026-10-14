# Guía paso a paso para LabCentral 2

Esta guía explica cómo copiar LabCentral 2 a un servidor Linux, ponerlo en marcha, organizar un evento y resolver las tareas habituales. Está escrita para quien no administra servidores a diario.

## 1. Qué necesitas

- Un servidor Linux encendido y conectado a la red. Para empezar, Ubuntu Server LTS o Debian estable son opciones sencillas.
- Una cuenta de usuario con acceso SSH y permiso para administrar Docker. Conserva esa cuenta: la necesitarás para actualizar y hacer respaldos.
- Docker Engine y el complemento **Docker Compose v2**.
- Para acceso en la red local: el servidor y los participantes deben estar en la misma LAN o tener una ruta entre sus redes.
- Para acceso desde internet: además necesitarás un dominio, DNS hacia el servidor, un firewall/router que permita el tráfico HTTPS y un certificado TLS. El código de invitación de un evento **no publica ni conecta por sí solo** un servidor a internet.

El instalador también necesita `openssl` y `curl`; los instala la mayoría de distribuciones o se pueden instalar con el gestor de paquetes.

### Instalar Docker en Ubuntu o Debian

Docker cambia sus instrucciones según la distribución. Sigue su guía oficial para [Ubuntu](https://docs.docker.com/engine/install/ubuntu/) o [Debian](https://docs.docker.com/engine/install/debian/) y asegúrate de instalar el paquete `docker-compose-plugin`. No uses el script de conveniencia de Docker en un servidor de producción.

Al terminar, comprueba que el servicio esté iniciado:

```sh
sudo systemctl enable --now docker
sudo docker run hello-world
sudo docker compose version
```

Para no anteponer `sudo` a todos los comandos, Docker permite agregar tu cuenta al grupo `docker` y luego cerrar sesión y volver a entrar:

```sh
sudo usermod -aG docker "$USER"
```

Comprueba el cambio después de volver a entrar:

```sh
docker run hello-world
docker compose version
```

El grupo `docker` puede controlar el servidor con privilegios de administrador. Añade solo cuentas de personas de confianza. Si no quieres dar ese acceso, usa `sudo` delante de los comandos Docker y de los scripts del proyecto.

> Nota de firewall: en Linux, los puertos publicados por Docker pueden no quedar bloqueados por las reglas habituales de UFW/firewalld. La documentación oficial explica esta limitación y cómo aplicar reglas compatibles. Revisa el firewall del servidor y del router antes de publicar el servicio.

## 2. Copiar el proyecto al servidor

Abre una terminal en tu computador y copia la carpeta del proyecto por SSH. Sustituye `RUTA-LOCAL`, `USUARIO` e `IP-DEL-SERVIDOR` por tus valores. `RUTA-LOCAL` es la carpeta que contiene `LabCentral` (por ejemplo, `~/Documentos/proyectos`). La barra final de la ruta local significa “copiar el contenido de esta carpeta”.

```sh
rsync -av --exclude='.env' --exclude='backups/' --exclude='.git/' \
  "RUTA-LOCAL/LabCentral/" \
  USUARIO@IP-DEL-SERVIDOR:/home/USUARIO/LabCentral/
```

Por ejemplo, `USUARIO` es el nombre con el que inicias sesión en Linux. La primera conexión SSH puede pedirte confirmar la identidad del servidor; verifica que la dirección sea la correcta y escribe `yes`. Después te pedirá la contraseña SSH o usará tu llave SSH.

No copies `.env` desde otro equipo: contiene secretos ligados a una instalación. Tampoco copies los respaldos antiguos de otra instalación salvo que quieras restaurarlos intencionalmente.

Entra al servidor:

```sh
ssh USUARIO@IP-DEL-SERVIDOR
cd /home/USUARIO/LabCentral
```

Comprueba que estás en la carpeta correcta. Deberías ver `compose.yaml`, `README.md` y la carpeta `scripts`:

```sh
ls
```

## 3. Instalar y arrancar LabCentral 2

Ejecuta el instalador desde la carpeta del proyecto:

```sh
./scripts/install.sh
```

Si Docker solo funciona con `sudo`, usa:

```sh
sudo ./scripts/install.sh
```

La primera ejecución crea `.env` con secretos aleatorios, valida la configuración, construye los contenedores, crea/migra la base de datos y espera a que el sitio responda. Puede tardar varios minutos la primera vez porque descarga imágenes y construye la aplicación. No cierres la sesión mientras trabaja.

Si termina correctamente verás `LabCentral 2 está listo`. Si falla, no repitas la instalación muchas veces sin mirar el error: ve a [Resolver problemas](#12-resolver-problemas), corrige la causa y vuelve a ejecutar el mismo instalador. Es seguro volver a ejecutarlo; respeta el `.env` existente y, al actualizar una instalación activa, crea un respaldo antes del despliegue.

### Obtener la dirección del servidor

En el servidor ejecuta:

```sh
hostname -I
```

Verás una o más direcciones. Usa la dirección LAN del adaptador conectado a tu red, normalmente algo como `192.168.x.x` o `10.x.x.x`; no uses `127.0.0.1` ni una dirección de Docker como `172.17.x.x`. Si tienes dudas, pregunta al administrador de la red cuál es la IP reservada para el servidor.

Desde un equipo de la misma LAN abre en el navegador:

```text
http://IP-DEL-SERVIDOR:8000
```

Reemplaza `IP-DEL-SERVIDOR` por la dirección real. Por ejemplo: `http://192.168.1.40:8000`.

Si la página no carga, revisa que el servidor y computador estén en la misma red, que el puerto TCP 8000 esté permitido en el firewall y que los contenedores estén arriba:

```sh
docker compose ps
```

## 4. Crear la cuenta organizadora

La primera persona que complete la pantalla inicial será la cuenta administradora de esta instalación. En el servidor, desde la carpeta `LabCentral`, consulta la clave de configuración:

```sh
grep '^SETUP_KEY=' .env
```

Si ejecutas Docker con `sudo` y no puedes leer el archivo, usa `sudo grep '^SETUP_KEY=' .env`.

1. Abre LabCentral 2 en el navegador.
2. Copia el valor que aparece después de `SETUP_KEY=` y pégalo en el formulario de configuración inicial.
3. Elige un nombre de usuario, nombre visible, correo electrónico y contraseña. Usa una contraseña larga y única (12 caracteres o más).
4. Pulsa el botón para crear la cuenta. Esa cuenta recibe permisos de organización.
5. Guarda la clave inicial en un gestor de contraseñas o bórrala de tus notas. No la compartas con participantes.

Después de crear la cuenta inicial, el formulario de configuración deja de estar disponible. Las cuentas nuevas que se registran no reciben permisos de organización.

## 5. Crear y abrir el primer evento

1. Inicia sesión con la cuenta organizadora.
2. En el panel, pulsa **Crear evento**.
3. Escribe un nombre y, opcionalmente, una descripción.
4. Elige **Individual** o **Por equipos**. El modo no se puede cambiar después de crear el evento.
5. Si quieres, establece hora de inicio y término. Déjalas vacías para no fijar esos horarios. Las horas se interpretan en la zona horaria del computador desde el que estás usando el navegador.
6. Pulsa **Crear evento**.
7. El sitio mostrará un **código de evento**. Cópialo y compártelo solo con quienes deban participar.
8. Antes de la competencia, añade al menos un reto. Cuando estés listo, pulsa **Iniciar**. Si se definió una hora futura de inicio, se abrirá a esa hora.

El código permite encontrar el evento; cualquier participante aún debe iniciar sesión. Si el evento tiene horario de término, el sistema deja de aceptar soluciones al llegar la hora. También puedes pulsar **Finalizar** para cerrarlo antes.

### Invitar participantes

Los participantes pueden crear su cuenta desde la página de inicio:

1. Pulsa **Regístrate**.
2. Completa nombre de usuario, nombre visible, correo, código de evento y contraseña.
3. Inicia sesión y abre el evento.

Una persona que ya tiene cuenta no necesita registrarse otra vez: inicia sesión, pega el código en **¿Tienes un código?** y pulsa **Unirme**.

En el modo **Por equipos**, cada participante debe crear un equipo o unirse a uno antes de enviar respuestas. Quien crea el equipo comparte el código del equipo con sus compañeros. El código del equipo es distinto del código del evento. En modo individual no se crean equipos.

## 6. Añadir, cambiar y puntuar retos

Dentro del evento, la organización usa el botón **＋ Reto** para publicar un reto. Completa:

- **Nombre** y **Categoría**: ayudan a encontrar y ordenar el reto.
- **Descripción e instrucciones**: indica exactamente qué debe hacer la persona y qué formato debe tener la respuesta. No incluyas la flag en el texto visible.
- **Flag**: respuesta secreta que comprobará el sistema. Puede tener hasta 200 caracteres. En la interfaz suele mostrarse con un formato como `flag{...}`.
- **Puntaje**: elige fijo o dinámico.

En un reto fijo, cada solución correcta recibe los puntos configurados. En uno dinámico, el puntaje de cada nueva solución es `máximo(mínimo, inicial − soluciones anteriores × baja)`. Por ejemplo, inicial 100, mínimo 40 y baja 10 da 100 puntos a la primera solución, 90 a la segunda y así sucesivamente, hasta llegar a 40. En un evento por equipos se cuenta cada equipo una vez.

La organización puede adjuntar archivos al reto después de publicarlo: en la tarjeta del reto pulsa **＋ Archivo** y selecciona el archivo en el computador. El límite es 5 MiB por archivo y se permiten hasta 20 por reto. Los formatos admitidos son `.txt`, `.md`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.zip`, `.pcap`, `.pcapng`, `.csv`, `.json` y `.bin`. No se extraen los ZIP. Revisa cada archivo antes de subirlo y no publiques archivos ejecutables.

Durante una sesión puedes editar o quitar retos. **Quitar** oculta el reto a participantes y elimina sus adjuntos, pero conserva las soluciones que ya se registraron. Si editas la respuesta correcta, prueba que funciona antes de volver a aceptar soluciones.

### Qué ve y hace un participante

1. Abre el evento y lee las instrucciones.
2. Descarga los adjuntos que necesite.
3. Introduce la respuesta en el cuadro del reto y pulsa **Enviar**.
4. Una respuesta correcta se registra una sola vez por participante/equipo y actualiza el tablero.

El tablero se actualiza en tiempo real. Si una conexión en vivo se interrumpe, el navegador vuelve a consultar el estado periódicamente. No hace falta refrescar continuamente la página.

## 7. Revisar el evento y exportar resultados

- **Tablero**: muestra puntajes y avance de las personas o equipos.
- **Integridad**: lista señales de 5 o más intentos incorrectos en 10 minutos. Una señal es un indicio para revisión humana, no prueba que alguien haya hecho trampa y no suspende cuentas automáticamente. Puedes exportar esas señales a CSV desde esa sección.
- **Exportar CSV**: descarga resultados del evento para abrirlos en una hoja de cálculo. El CSV protege los campos frente a la ejecución accidental de fórmulas.
- **＋ Reto** y **Editar evento**: sirven para administrar la competencia mientras está en curso.

Antes de compartir un CSV, comprueba que el archivo no incluya datos que no quieras entregar a los participantes.

## 8. Recuperar una contraseña

### Recuperación automática por correo

Para enviar enlaces de recuperación, configura primero un relay SMTP y una URL que los participantes puedan abrir. Desde la carpeta del proyecto, edita `.env` con un editor de texto:

```sh
nano .env
```

Configura las variables SMTP con los datos de tu proveedor de correo. Ejemplo para un relay SMTP con STARTTLS:

```dotenv
PUBLIC_BASE_URL=http://IP-DEL-SERVIDOR:8000
SMTP_HOST=smtp.ejemplo.cl
SMTP_PORT=587
SMTP_USERNAME=labcentral@ejemplo.cl
SMTP_PASSWORD=CONTRASEÑA_DEL_RELAY
SMTP_FROM="LabCentral 2 <labcentral@ejemplo.cl>"
SMTP_STARTTLS=true
SMTP_USE_SSL=false
```

Reemplaza los valores de ejemplo. Guarda en `nano` con **Ctrl+O**, **Enter**, y sal con **Ctrl+X**. Para un sitio público, usa `PUBLIC_BASE_URL=https://tu-dominio` y configura HTTPS como se explica más abajo. No compartas ni envíes `.env`: contiene contraseñas y secretos.

Reinicia la aplicación para que lea la configuración:

```sh
docker compose up -d
```

En la pantalla de inicio de sesión, la persona pulsa **¿Olvidaste tu contraseña?** y sigue el enlace que llegue a su correo. Los mensajes no revelan si la cuenta existe. Sin SMTP correctamente configurado el formulario no puede entregar correo. Una persona que ya inició sesión puede guardar o cambiar su correo con **Agregar correo**, confirmando su contraseña actual.

### Restablecimiento por el administrador del servidor

Si no hay correo disponible, una persona con acceso al servidor puede establecer una contraseña nueva de manera interactiva:

```sh
./scripts/reset-password.sh NOMBRE-DE-USUARIO
```

Si usas Docker con `sudo`, ejecuta `sudo ./scripts/reset-password.sh NOMBRE-DE-USUARIO`. El script solicita la nueva contraseña sin mostrarla al escribir y cierra las sesiones existentes de esa cuenta. Entrega la contraseña nueva directamente a su titular.

## 9. Checkpoints y respaldos

### Checkpoint de un evento

El botón **Guardar checkpoint** guarda el estado del evento y sus soluciones actuales, y descarga un archivo JSON al navegador. Usa **Historial** para ver y descargar checkpoints anteriores. Si pulsas **Restaurar progreso**, el sistema elimina las soluciones posteriores al checkpoint y restaura las que estaban guardadas en él.

Un checkpoint es para retroceder el progreso de soluciones. No recupera adjuntos, lista de participantes, equipos ni cambios de los retos. Para una recuperación completa usa un respaldo del servidor.

### Respaldo completo del servidor

LabCentral 2 crea automáticamente respaldos al iniciar y cada 24 horas. Se guardan en la carpeta `backups/` del servidor. Cada respaldo completo tiene dos archivos de la misma fecha: uno `.dump` de base de datos y otro `-assets.tar.gz` con archivos adjuntos. El servidor conserva los últimos 14 días por defecto.

También puedes crear uno justo antes/después de una competencia:

```sh
./scripts/backup.sh
ls -lh backups/
```

Con `sudo`, antepone `sudo` a ambos comandos. Copia **los dos archivos de la misma fecha** a otro equipo o almacenamiento seguro. Un respaldo guardado solo en el mismo disco no te protege si el disco o el servidor se pierde. Protege `.env` por separado: contiene credenciales necesarias para administrar la instalación y no debe subirse a servicios públicos.

Para restaurar un respaldo completo, usa el nombre del archivo `.dump` como argumento; el archivo de adjuntos asociado debe estar en la misma carpeta. Este proceso reemplaza el estado actual. Primero descarga o conserva una copia fuera del servidor y avisa a usuarios que no podrán usar el sitio durante la operación:

```sh
./scripts/restore.sh backups/labcentral-FECHA.dump
```

El script pide escribir literalmente `RESTORE` antes de continuar. Luego intenta hacer un respaldo preventivo. Al terminar, inicia los servicios:

```sh
docker compose up -d
docker compose ps
```

No edites manualmente los archivos de backup. Un archivo `.dump` antiguo sin su par `-assets.tar.gz` no recupera los adjuntos.

## 10. Acceso desde internet con HTTPS

Haz esto solo si sabes administrar el dominio, router y firewall. Para un evento interno, usa primero la LAN.

1. Consigue un dominio o subdominio, por ejemplo `ctf.ejemplo.cl`.
2. Crea un registro DNS que apunte al servidor o a la IP pública del router.
3. Configura el router/firewall para redirigir TCP 80 y 443 al servidor. Configura el firewall del servidor para aceptar esos puertos desde las redes deseadas.
4. Abre `.env` y cambia los siguientes valores:

   ```dotenv
   PUBLIC_DOMAIN=ctf.ejemplo.cl
   PUBLIC_BASE_URL=https://ctf.ejemplo.cl
   LABCENTRAL_HTTP_PORT=80
   LABCENTRAL_HTTPS_PORT=443
   COOKIE_SECURE=true
   ```

   Si otra aplicación ya usa los puertos 80 o 443 en este servidor, detente y planifica el proxy/dominio antes de continuar.

5. Ejecuta `./scripts/install.sh` para aplicar la configuración.
6. Espera a que Caddy obtenga el certificado y prueba `https://ctf.ejemplo.cl` desde una red externa, por ejemplo datos móviles.
7. Comparte el código del evento con los participantes.

El código de evento es una invitación, no un túnel ni un cortafuegos. No publiques PostgreSQL o Redis. Si tienes un proxy inverso delante de Caddy, asegúrate de que conserve el encabezado `Host` y no confíes solicitudes reenviadas de proxies que no administras.

## 11. Uso diario: iniciar, detener, actualizar

Los siguientes comandos se ejecutan desde `/home/USUARIO/LabCentral` en el servidor.

```sh
# Ver estado de los servicios
docker compose ps

# Seguir los logs de la aplicación en vivo (Ctrl+C sale de los logs, no detiene el sitio)
docker compose logs -f app

# Detener temporalmente
docker compose stop

# Volver a iniciar
docker compose start

# Actualizar/reconstruir: el instalador hace una copia previa si ya está activo
./scripts/install.sh
```

Si ejecutas Docker con `sudo`, añade `sudo` al inicio de cada comando. `docker compose down` detiene y retira contenedores pero conserva los volúmenes. **No ejecutes `docker compose down -v`**: `-v` borra la base de datos y los adjuntos persistentes.

## 12. Resolver problemas

| Qué ves | Qué hacer |
|---|---|
| `docker: command not found` | Instala Docker Engine según tu distribución, vuelve a entrar en la terminal y confirma con `docker --version`. |
| `docker compose` no existe | Instala el complemento `docker-compose-plugin` y confirma con `docker compose version`. |
| `permission denied` al usar Docker | Ejecuta el comando con `sudo`, o añade tu usuario al grupo `docker` y cierra sesión y vuelve a entrar. |
| El instalador dice que falta `.env` o no hay secretos | Desde la carpeta del proyecto, vuelve a ejecutar `./scripts/install.sh`. No copies un `.env` de ejemplo con sus secretos de muestra. |
| La web no carga en el servidor | Revisa `docker compose ps` y `docker compose logs --tail=100 app caddy db migrate`. Espera un minuto si la primera construcción aún descarga imágenes. |
| La web abre en el servidor pero no en otro computador | Verifica que ambos estén en la LAN, que uses la IP LAN correcta y que el puerto TCP 8000 esté permitido. Comprueba también el firewall del router. |
| Error de puerto ocupado | Mira qué programa usa el puerto. Si no necesitas el puerto 8000, cambia `LABCENTRAL_HTTP_PORT` en `.env` a un puerto libre y ejecuta `./scripts/install.sh` de nuevo. Luego usa ese puerto en la URL. |
| `SETUP_KEY` no aparece en pantalla | Dentro del proyecto ejecuta `grep '^SETUP_KEY=' .env`; con instalación root, `sudo grep '^SETUP_KEY=' .env`. No pegues esa clave en chats o tickets. |
| No llega el correo de recuperación | Comprueba `PUBLIC_BASE_URL`, host/puerto/usuario/contraseña SMTP, valores STARTTLS/SSL y los logs con `docker compose logs --tail=100 app`. Verifica que el servidor pueda alcanzar el relay SMTP. |
| No se acepta el archivo de un reto | Usa un formato permitido y un archivo de hasta 5 MiB. Comprueba también que no se haya alcanzado la cuota de archivos del evento. |
| No puedo restaurar un backup | Usa el archivo `.dump` completo y deja a su lado el archivo `-assets.tar.gz` de la misma fecha. Asegúrate de tener suficiente espacio y de escribir `RESTORE` cuando el script lo solicite. |
| Un contenedor se reinicia repetidamente | Ejecuta `docker compose logs --tail=150 db migrate app caddy backup`, guarda el mensaje de error y busca la causa indicada antes de borrar/recrear datos. |

Para verificar que la aplicación y la base de datos están disponibles desde el servidor:

```sh
curl -fsS http://127.0.0.1:8000/health/ready
```

Si cambiaste el puerto HTTP, reemplaza `8000` por el que configuraste. Una respuesta `200` significa que la aplicación está lista.

## 13. Alcance y seguridad básica

LabCentral 2 gestiona cuentas, eventos, retos de preguntas, adjuntos y puntajes. **No ejecuta programas que suban los participantes, no crea máquinas vulnerables y no es una red aislada para atacar.** No pongas servicios de laboratorio vulnerables en el mismo servidor o red de gestión. Si organizas retos que requieren ejecución de código, usa infraestructura aparte y aislada por equipo.

Consejos para el día del evento:

- Mantén actualizado Linux y Docker, y conserva acceso administrativo al host.
- Usa HTTPS si participantes se conectarán desde redes que no controlas.
- No compartas `.env`, `SETUP_KEY`, códigos de equipos, credenciales ni archivos de respaldo públicamente.
- Revisa adjuntos antes de subirlos; los límites de extensión y tamaño no son un antivirus.
- Crea un respaldo antes de una actualización, una restauración o una sesión importante; descarga una copia fuera del servidor.
- Limita el acceso a puertos de administración del servidor y no publiques las interfaces de PostgreSQL o Redis.

El sistema se recupera de reinicios de contenedores y conserva base de datos/adjuntos en volúmenes persistentes. Es una instalación de un servidor y una base PostgreSQL: no proporciona failover de hardware ni recuperación punto en el tiempo. Si el servidor o su disco deja de funcionar, necesitarás un respaldo externo reciente.

---

LabCentral 2 · **Hecho por Sebastián Dinator** · [sebadinator.com](https://sebadinator.com)
