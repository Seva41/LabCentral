#!/bin/bash
# Script de instalación automática para LabCentral en producción.
# Se asume que este script está en la raíz del repositorio, el cual incluye:
#   - docker-compose.prod.yml (para producción)
#   - labselector/.env.local (archivo de entorno para el frontend)
#
# Requisitos:
#   • Actualizar el repositorio (git pull)
#   • Verificar/instalar dependencias: Docker (con "docker compose") y git.
#   • Configurar siempre el usuario admin (correo y contraseña) en .env.
#   • Detectar las IP(s) del servidor y guardarlas en .env como CORS_ALLOWED_IPS.
#   • Actualizar el API URL del Frontend en labselector/.env.local y en docker-compose.prod.yml.
#   • Crear un servicio systemd que ejecute "docker compose -f docker-compose.prod.yml up --build" para iniciar LabCentral.
#   • Soportar actualización y desinstalación.

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
    echo "Por favor, ejecute este script como root."
    exit 1
fi

# Directorio de la aplicación: se asume la raíz del repositorio
APP_DIR="$(pwd)"
# Archivo de variables de entorno para el backend
ENV_FILE="$APP_DIR/.env"
# Archivo de variables para el frontend (Next.js)
FRONT_ENV_FILE="$APP_DIR/labselector/.env.local"
# Servicio systemd
SYSTEMD_SERVICE="/etc/systemd/system/labcentral.service"
# Archivo docker-compose de producción
DC_FILE="$APP_DIR/docker-compose.prod.yml"

check_dependencies() {
    echo "Verificando dependencias..."
    apt-get update

    # Verificar e instalar Docker
    if ! command -v docker &> /dev/null; then
        echo "Docker no está instalado. Instalando Docker..."
        apt-get install -y apt-transport-https ca-certificates curl software-properties-common
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
        add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
        apt-get update
        apt-get install -y docker-ce docker-ce-cli containerd.io
    else
        echo "Docker está instalado."
    fi

    # Verificar el comando "docker compose" (integrado)
    if ! docker compose version &> /dev/null; then
        echo "El comando 'docker compose' no se encuentra disponible."
        echo "Asegúrese de tener una versión de Docker que incluya 'docker compose'."
        exit 1
    else
        echo "'docker compose' está disponible."
    fi

    # Verificar que git esté instalado
    if ! command -v git &> /dev/null; then
        echo "git no está instalado. Instalando git..."
        apt-get install -y git
    else
        echo "git está instalado."
    fi
}

configure_admin() {
    echo "Configuración del usuario admin:"
    read -p "Ingrese el correo del admin: " admin_email
    read -s -p "Ingrese la contraseña del admin: " admin_pass
    echo ""
    # Se sobrescribe el archivo .env para el backend
    cat <<EOF > "$ENV_FILE"
ADMIN_EMAIL=$admin_email
ADMIN_PASSWORD=$admin_pass
EOF
    echo "Datos del admin guardados en $ENV_FILE."
}

configure_backend_env() {
    echo "Detectando direcciones IP del servidor para configurar CORS..."
    ips=$(hostname -I | xargs)  # Obtiene las IP(s) en una línea
    echo "Direcciones IP detectadas: $ips"
    # Se añaden al archivo .env la variable CORS_ALLOWED_IPS
    echo "CORS_ALLOWED_IPS=$ips" >> "$ENV_FILE"
}

configure_frontend_api_url() {
    echo "Configuración del API URL para el Frontend (labselector):"
    read -p "Ingrese la IP (sin puerto) para el API del Frontend (ej: 10.0.1.100): " frontend_ip
    new_url="http://$frontend_ip:5001"
    echo "Se usará NEXT_PUBLIC_API_URL=$new_url"

    # Actualizar (o crear) el archivo .env.local en labselector
    mkdir -p "$APP_DIR/labselector"
    echo "NEXT_PUBLIC_API_URL=$new_url" > "$FRONT_ENV_FILE"
    echo "Archivo $FRONT_ENV_FILE actualizado."

    # Actualizar docker-compose.prod.yml: tanto en los build args como en las variables de entorno,
    # se reemplaza el valor anterior por el nuevo.
    # Se asume que en el archivo docker-compose.prod.yml aparece NEXT_PUBLIC_API_URL en dos lugares.
    # Actualizamos la línea en la sección de build.args:
    sed -i -E "s|(NEXT_PUBLIC_API_URL:)[[:space:]]*http://[0-9.]+:5001|\1 http://$frontend_ip:5001|g" "$DC_FILE"
    # Actualizamos la línea en la sección de environment:
    sed -i -E "s|(-[[:space:]]*NEXT_PUBLIC_API_URL=)http://[0-9.]+:5001|\1http://$frontend_ip:5001|g" "$DC_FILE"
    echo "Actualizado NEXT_PUBLIC_API_URL en $DC_FILE."
}

create_systemd_service() {
    echo "Creando servicio systemd para LabCentral..."
    cat <<EOF > "$SYSTEMD_SERVICE"
[Unit]
Description=LabCentral Service using Docker Compose (Production)
Requires=docker.service
After=docker.service

[Service]
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/env docker compose -f docker-compose.prod.yml up --build
ExecStop=/usr/bin/env docker compose -f docker-compose.prod.yml down
Restart=always
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable labcentral.service
    echo "Servicio systemd 'labcentral.service' creado y habilitado."
}

install_app() {
    echo "Actualizando el repositorio (git pull)..."
    git pull

    echo "Instalando LabCentral en producción..."
    check_dependencies

    # Configurar el entorno del backend
    echo "Creando archivo de variables para el backend ($ENV_FILE)..."
    > "$ENV_FILE"
    configure_admin
    configure_backend_env

    # Configurar el API URL del frontend y actualizar docker-compose.prod.yml
    configure_frontend_api_url

    create_systemd_service

    # Arrancar LabCentral usando docker compose (detached)
    cd "$APP_DIR"
    echo "Iniciando LabCentral..."
    docker compose -f docker-compose.prod.yml up --build -d
    echo "LabCentral se ha iniciado y está configurado para arrancar con el sistema."
}

update_app() {
    echo "Actualizando LabCentral..."
    cd "$APP_DIR"
    echo "Ejecutando git pull para actualizar el repositorio..."
    git pull
    echo "Actualizando contenedores con docker compose..."
    docker compose -f docker-compose.prod.yml pull
    docker compose -f docker-compose.prod.yml up --build -d
    echo "LabCentral ha sido actualizado e iniciado."
}

uninstall_app() {
    echo "Deteniendo LabCentral..."
    systemctl stop labcentral.service
    cd "$APP_DIR"
    docker compose -f docker-compose.prod.yml down
    echo "Eliminando el servicio systemd..."
    systemctl disable labcentral.service
    rm -f "$SYSTEMD_SERVICE"
    systemctl daemon-reload
    echo "LabCentral se ha desinstalado correctamente."
}

usage() {
    echo "Uso: $0 {install|update|uninstall}"
    exit 1
}

# Evaluar el parámetro recibido
if [ $# -ne 1 ]; then
    usage
fi

case "$1" in
    install)
        install_app
        ;;
    update)
        update_app
        ;;
    uninstall)
        uninstall_app
        ;;
    *)
        usage
        ;;
esac
