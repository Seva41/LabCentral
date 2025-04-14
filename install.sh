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
#   • Mostrar una barra de progreso durante la instalación.

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
    echo "Por favor, ejecute este script como root."
    exit 1
fi

###########################################################
#              LOGO DE LABCENTRAL EN ASCII                #
###########################################################
cat << "EOF"
 _             _      _____               _                _ 
| |           | |    /  __ \             | |              | |
| |      __ _ | |__  | /  \/  ___  _ __  | |_  _ __  __ _ | |
| |     / _` || '_ \ | |     / _ \| '_ \ | __|| '__|/ _` || |
| |____| (_| || |_) || \__/\|  __/| | | || |_ | |  | (_| || |
\_____/ \__,_||_.__/  \____/ \___||_| |_| \__||_|   \__,_||_|
                                                             
                                                                                         
EOF
echo ""

# Variables globales de la instalación
APP_DIR="$(pwd)"                                  # Raíz del repositorio
ENV_FILE="$APP_DIR/.env"                           # Archivo de variables para el backend
FRONT_ENV_FILE="$APP_DIR/labselector/.env.local"   # Archivo de variables para el frontend
SYSTEMD_SERVICE="/etc/systemd/system/labcentral.service"  # Archivo del servicio systemd
DC_FILE="$APP_DIR/docker-compose.prod.yml"         # Archivo de docker-compose para producción

# Variables para barra de progreso (7 pasos definidos)
total_steps=7
current_step=0

# Función que imprime la barra de progreso
print_progress_bar() {
    local progress=$1
    local total=$2
    local percent=$(( progress * 100 / total ))
    local bar_width=50
    local filled=$(( percent * bar_width / 100 ))
    local empty=$(( bar_width - filled ))
    # Construir la barra con caracteres '#' para llenado y espacios para lo restante.
    local bar
    bar=$(printf "%0.s#" $(seq 1 $filled))
    local spaces
    spaces=$(printf "%0.s " $(seq 1 $empty))
    printf "\rProgreso: [%s%s] %3d%%" "$bar" "$spaces" "$percent"
}

# Función para actualizar la barra de progreso con un mensaje de paso
update_progress() {
    current_step=$(( current_step + 1 ))
    print_progress_bar "$current_step" "$total_steps"
    echo "  - $1"
}

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
    update_progress "Usuario admin configurado."
}

configure_backend_env() {
    echo "Detectando direcciones IP del servidor para configurar CORS..."
    ips=$(hostname -I | xargs)  # Obtiene las IP(s) en una línea
    echo "Direcciones IP detectadas: $ips"
    # Añadir la variable CORS_ALLOWED_IPS al archivo .env
    echo "CORS_ALLOWED_IPS=$ips" >> "$ENV_FILE"
    update_progress "Variables del backend configuradas (CORS_ALLOWED_IPS)."
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

    # Actualizar docker-compose.prod.yml:
    # Reemplazar en la sección de build.args:
    sed -i -E "s|(NEXT_PUBLIC_API_URL:)[[:space:]]*http://[0-9.]+:5001|\1 http://$frontend_ip:5001|g" "$DC_FILE"
    # Reemplazar en la sección de environment:
    sed -i -E "s|(-[[:space:]]*NEXT_PUBLIC_API_URL=)http://[0-9.]+:5001|\1http://$frontend_ip:5001|g" "$DC_FILE"
    update_progress "API URL del frontend configurado y actualizado en docker-compose."
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
    update_progress "Servicio systemd creado y habilitado."
}

install_app() {
    echo "Iniciando instalación de LabCentral..."
    # Paso 1: Actualizar el repositorio
    echo "Actualizando el repositorio (git pull)..."
    git pull
    update_progress "Repositorio actualizado."

    # Paso 2: Verificar dependencias
    check_dependencies
    update_progress "Dependencias verificadas."

    # Paso 3: Configurar el usuario admin (archivo .env)
    configure_admin

    # Paso 4: Configurar variables del backend (CORS_ALLOWED_IPS)
    configure_backend_env

    # Paso 5: Configurar el API URL para el Frontend y actualizar docker-compose
    configure_frontend_api_url

    # Paso 6: Crear el servicio systemd
    create_systemd_service

    # Paso 7: Iniciar LabCentral con docker compose (modo detached)
    cd "$APP_DIR"
    echo "Iniciando LabCentral con docker compose..."
    docker compose -f docker-compose.prod.yml up --build -d
    update_progress "LabCentral iniciado."
    echo -e "\nInstalación completada."
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
