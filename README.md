# LabCentral

## Índice

- [LabCentral](#labcentral)
  - [Descripción](#descripción)
  - [Requisitos Previos](#requisitos-previos)
  - [Estructura del Proyecto](#estructura-del-proyecto)
  - [Instrucciones de Despliegue](#instrucciones-de-despliegue)
    - [1. Clonar el Repositorio](#1-clonar-el-repositorio)
    - [2. Instalar Dependencias del Frontend](#2-instalar-dependencias-del-frontend)
    - [3. Construir y Levantar los Contenedores](#3-construir-y-levantar-los-contenedores)
    - [4. Acceder a la Aplicación](#4-acceder-a-la-aplicación)
    - [5. Verificación de Servicios](#5-verificación-de-servicios)
  - [Detección de Errores Comunes](#detección-de-errores-comunes)
  - [Migración de la Base de Datos](#migración-de-la-base-de-datos)
  - [Uso de la Aplicación](#uso-de-la-aplicación)
  - [Creación de un Usuario de Prueba](#creación-de-un-usuario-de-prueba)
  - [Ejecución de Ejercicios con Docker](#ejecución-de-ejercicios-con-docker)


## Descripción

LabCentral es un sistema para gestionar ejercicios y usuarios a través de una API desarrollada en Flask y un frontend en Next.js y Tailwind. La aplicación permite:

- **Gestión de ejercicios**: Cada ejercicio se ejecuta en un contenedor Docker independiente, lo que permite aislar y administrar entornos de ejecución.
- **Autenticación y administración**: Endpoints para registro, login, solicitud y restablecimiento de contraseñas, así como funciones de administración (crear/eliminar ejercicios).
- **Proxy de peticiones**: Redirección de solicitudes a los contenedores de ejercicios mediante un endpoint proxy.
- **Cuestionarios por ejercicio**: Incluye un sistema de cuestionario, preguntas y puntajes por usuario, incorporando preguntas de alternativas y de desarrollo.

La comunicación entre el frontend y el backend se realiza mediante llamadas a endpoints REST, y la orquestación de los contenedores se gestiona mediante Docker Compose.

## Requisitos Previos

1. **Sistema Operativo**  

   Se recomienda utilizar un sistema UNIX-Debian, idealmente **Ubuntu Server** (probado en versiones 20.04 o superior).

2. **Docker** y **Docker Compose**  
   - **Instalación de Docker en Ubuntu**:
     
     Para otros Sistemas Operativos seguir la [guía oficial de Docker](https://docs.docker.com/engine/install/).
     
      ```bash
      # Agregar la llave GPG oficial de Docker:
      sudo apt update
      sudo apt install ca-certificates curl
      sudo install -m 0755 -d /etc/apt/keyrings
      sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
      sudo chmod a+r /etc/apt/keyrings/docker.asc
      
      # Agregar el repositorio a Apt sources:
      echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
        $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      sudo apt update

      # Instalar Docker
      sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ```
   - **Probar la Instalación de Docker**:
     ```bash
     sudo docker run hello-world
     ```
     
3. Opcionalmente, **Git** si se desea clonar este repositorio directamente:
   ```bash
   sudo apt install -y git
   ```
   
4. **NPM** para instalar dependencias del frontend.
   ```bash
   sudo apt install -y npm
   ```

## Estructura del Proyecto

El proyecto se compone principalmente de:

- **Backend (Flask)**:
  - Carpeta con los archivos `__init__.py`, `models.py`, `auth.py`, `exercise.py`, etc.
  - Gestiona la lógica de negocio y expone rutas REST.
  - Utiliza una base de datos SQLite por defecto.
- **Frontend (Next.js)**:
  - Carpeta con los archivos de páginas como `login.js`, `signup.js`, `dashboard.js`, etc.
  - Proporciona la interfaz de usuario.
  - Estilos y configuración mediante Tailwind CSS (con archivos como `tailwind.config.ts` y `globals.css`).
- **Docker**:
  - Cada ejercicio define un contenedor Docker independiente dentro de la carpeta `dockerfiles/` (Leer README correspondiente para más información).
  - El proyecto se orquesta con Docker Compose para levantar el backend y el frontend en contenedores.

## Instrucciones de Despliegue

A continuación, se describen los pasos para lanzar toda la aplicación (frontend + backend) en contenedores Docker usando Docker Compose. Se asume que ya tiene Docker y Docker Compose instalados.

### 1. Clonar el Repositorio

Si no lo ha descargado de otra manera:

```bash
git clone https://github.com/SoC-UAI/LabCentral.git
cd labcentral
```

### 2. Instalar Dependencias del Frontend

En caso de que sea necesario, ingresar a la carpeta de frontend (ajuste la ruta según corresponda) y ejecutar:

```bash
cd labselector
npm i
```

Esto instalará todas las dependencias requeridas por el proyecto Next.js.

Luego, regrese a la carpeta raíz:

```bash
cd ..
```

### 3. Construir y Levantar los Contenedores

Si se va a trabajar en un entorno de desarrollo, no es necesario hacer cambios a la estructura de archivos.
En el caso de que se utilice un entorno de producción, entonces deberá renombrar el composer:
- El archivo `docker-compose.yml` debe ser renombrado a `docker-compose.dev.yml`.
- El archivo `docker-compose.prod.yml` debe ser renombrado a `docker-compose.yml`.

En la carpeta donde se encuentre el archivo `docker-compose.yml`, ejecute:

```bash
docker compose up --build
```

Esto:

1. Construirá la imagen de Docker para el backend (Flask).
2. Construirá la imagen de Docker para el frontend (Next.js).
3. Iniciará los contenedores.

Cuando el proceso termine, deberá ver en la consola mensajes indicando que el backend se está ejecutando en `<IP-SERVIDOR>:5001` y el frontend en `<IP-SERVIDOR>:3000`.

> **Opcional**: Para ejecutar en segundo plano, use:
>
> ```bash
> docker compose up --build -d
> ```

### 4. Acceder a la Aplicación

- **Frontend**: Abra un navegador y vaya a `http://<IP-SERVIDOR>:3000`.
- **Backend**: Sus endpoints REST estarán en `http://<IP-SERVIDOR>:5001`.

> Reemplace `<IP-SERVIDOR>` por la dirección IP pública o privada de su servidor.

### 5. Verificación de Servicios

- **Frontend (Next.js)**: Al ingresar a `http://<IP-SERVIDOR>:3000`, debería ver la pantalla de Inicio de Sesión. Desde ahí, puede iniciar sesión y acceder al dashboard.
- **Backend (Flask)**: Si realiza una llamada a `http://<IP-SERVIDOR>:5001/api/exercises`, debería obtener un JSON con la lista de ejercicios.

## Detección de Errores Comunes

- **Faltan privilegios en Docker**: Asegúrese de usar `sudo` si su usuario no pertenece al grupo `docker`. Por ejemplo:
  ```bash
  sudo docker compose up --build
  ```
- **Puertos en uso**: Si `5001` o `3000` ya están ocupados, modifíquelos en `docker-compose.yml`.
- **Permisos en Ubuntu**: Si su sistema no permite a Docker ejecutar contenedores, añada su usuario al grupo `docker`:
  ```bash
  sudo usermod -aG docker $USER
  ```
  Luego, cierre sesión y vuelva a hacer login.
  
- **Faltan dependencias en NPM**: Recuerde ingresar a la carpeta del frontend y ejecutar:
  ```bash
  npm i
  ```
- **Faltan dependencias en Python**: Desde la carpeta raíz ejecutar:
  ```bash
  pip install -r requirements.txt --break-system-packages
  ```

## Migración de la Base de Datos
Cuando realice cambios en los modelos y necesite actualizar el esquema de la base de datos, use Flask-Migrate. Ejecute los siguientes comandos desde el contenedor del backend o en su entorno virtual:

  1. Instalar dependencias:
  ```bash
  pip install -r requirements.txt --break-system-packages
  ```
  2. Desde la carpeta raíz, inicializar el directorio de migraciones (solo la primera vez):
  ```bash
  export FLASK_APP=app
  flask db init
  ```
  3. Cerciorarse de tener los permisos de escritura necesarios:
  ```bash
  sudo chown <USUARIO>:<USUARIO> instance/app.db
  sudo chmod 664 instance/app.db
  sudo chown <USUARIO>:<USUARIO> instance
  sudo chmod 775 instance
  ```
  Reemplaza `<USUARIO>` con el nombre de usuario del sistema.
  
  3. Generar una nueva migración (detecta los cambios en los modelos):
  ```bash
  flask db migrate -m "Descripción de los cambios"
  ```
  4. Aplicar las migraciones a la base de datos:
  ```bash
  flask db upgrade
  ```
  5. (Opcional) Para revertir una migración:
  ```bash
  flask db downgrade
  ```
## Uso de la Aplicación

1. **Iniciar Sesión**: Use las credenciales registradas para acceder.
2. **Panel (Dashboard)**: Verá la lista de ejercicios y un botón para ver el detalle de cada ejercicio, donde podrá iniciarlo, detenerlo o responder sus preguntas asociadas.
3. **Administración**: Si el usuario es administrador, podrá crear o eliminar ejercicios en el panel, restablecer contraseñas de usuarios, o agregar nuevos.

## Creación de un Usuario de Prueba

Para crear un usuario de prueba (por ejemplo, un administrador) en la base de datos:

1. Asegúrese de que el contenedor del backend esté corriendo (p.ej., `labcentral-backend`).
2. Abra una terminal en dicho contenedor:
   ```bash
   docker-compose exec backend bash
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

## Ejecución de Ejercicios con Docker

Cada ejercicio se lanza como un contenedor Docker independiente, basado en la imagen definida en la base de datos. Al hacer clic en **Start Exercise**, el backend:

1. Inicio del Ejercicio:
   - El usuario solicita iniciar un ejercicio (a través de la interfaz o llamando al endpoint `/api/exercise/<id>/start`).
   - El backend construye la imagen (usando la ruta especificada en `dockerfile_path`) y lanza el contenedor en la red `lab_app_net`.
   - Se utiliza un nombre de contenedor con formato `user-<user_id>-exercise-<exercise_id>` para identificar el contenedor.
2. Acceso mediante Proxy:
   - El endpoint `/api/exercise/<id>/proxy` se encarga de redirigir las peticiones al contenedor, utilizando su IP interna y el puerto configurado (por defecto, 5000 dentro del contenedor).
3. Detención del Ejercicio:
   - El endpoint `/api/exercise/<id>/stop` detiene y elimina el contenedor asociado.
4. Carga de Ejercicios vía ZIP:
   - Para facilitar la adición de nuevos ejercicios, el endpoint `/api/exercise_with_zip` permite subir un archivo ZIP que contenga el Dockerfile y otros archivos necesarios.
   - El ZIP se descomprime en la carpeta `dockerfiles/<slug>` y se crea el registro en la base de datos.
