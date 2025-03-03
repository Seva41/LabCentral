# LabCentral

## Descripción

Este proyecto se compone de una aplicación Flask que proporciona una API para gestionar ejercicios y usuarios, y un frontend en Next.js que permite interactuar con la API. Cada ejercicio se ejecuta como un contenedor de Docker independiente, gestionado a través de la API de Docker.

## Requisitos Previos

1. Sistema operativo UNIX-Debian, recomendado **Ubuntu Server** (probado en versiones 20.04 o superior).
2. **Docker** y **Docker Compose** instalados.
   - Para instalar Docker en Ubuntu:
     ```bash
     sudo apt update
     sudo apt install -y docker.io
     sudo systemctl enable docker
     sudo systemctl start docker
     ```
   - Para instalar Docker Compose:
     ```bash
     sudo apt-get install -y docker-compose
     ```
3. Opcionalmente, **Git** si se desea clonar este repositorio directamente:
   ```bash
   sudo apt install -y git
   ```
4. **NPM** para instalar dependencias del frontend.
   ```bash
   sudo apt-get install -y npm
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
- **Docker**:
  - Cada ejercicio define un contenedor Docker independiente dentro de la carpeta `dockerfiles/` (Leer README correspondiente para más información).
  - El proyecto se orquesta con Docker Compose.

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

Regrese a la carpeta raíz si es necesario:

```bash
cd ..
```

### 3. Construir y Levantar los Contenedores

En la carpeta donde se encuentre el archivo `docker-compose.yml`, ejecute:

```bash
docker-compose up --build
```

Esto:

1. Construirá la imagen de Docker para el backend (Flask).
2. Construirá la imagen de Docker para el frontend (Next.js).
3. Iniciará los contenedores.

Cuando el proceso termine, deberá ver en la consola mensajes indicando que el backend se está ejecutando en `0.0.0.0:5000` y el frontend en `0.0.0.0:3000`.

> **Opcional**: Para ejecutar en segundo plano, use:
>
> ```bash
> docker-compose up --build -d
> ```

### 4. Acceder a la Aplicación

- **Frontend**: Abra un navegador y vaya a `http://<IP-SERVIDOR>:3000`.
- **Backend**: Sus endpoints REST estarán en `http://<IP-SERVIDOR>:5000`.

> Reemplace `<IP-SERVIDOR>` por la dirección IP pública o privada de su servidor.

### 5. Verificación de Servicios

- **Frontend (Next.js)**: Al ingresar a `http://<IP-SERVIDOR>:3000`, debería ver la pantalla de Inicio de Sesión. Desde ahí, puede iniciar sesión y acceder al dashboard.
- **Backend (Flask)**: Si realiza una llamada a `http://<IP-SERVIDOR>:5000/api/exercises`, debería obtener un JSON con la lista de ejercicios.

### 6. Detección de Errores Comunes

- **Faltan privilegios en Docker**: Asegúrese de usar `sudo` si su usuario no pertenece al grupo `docker`. Por ejemplo:
  ```bash
  sudo docker-compose up --build
  ```
- **Puertos en uso**: Si `5000` o `3000` ya están ocupados, modifíquelos en `docker-compose.yml`.
- **Permisos en Ubuntu**: Si su sistema no permite a Docker ejecutar contenedores, añada su usuario al grupo `docker`:
  ```bash
  sudo usermod -aG docker $USER
  ```
- **Faltan dependencias en NPM**: Recuerde ingresar a la carpeta del frontend y ejecutar:
  ```bash
  npm i
  ```
- **Faltan dependencias en Python**: Desde la carpeta raíz ejecutar:
  ```bash
  pip install -r requirements.txt --break-system-packages
  ```

## Uso de la Aplicación

1. **Iniciar Sesión**: Use las credenciales registradas para acceder.
2. **Panel (Dashboard)**: Verá la lista de ejercicios y un botón para iniciar cada ejercicio.
3. **Administración**: Si el usuario es administrador, podrá crear o eliminar ejercicios en el panel.

## Creación de un Usuario de Prueba

Para crear un usuario de prueba (por ejemplo, un administrador) en la base de datos:

1. Asegúrese de que el contenedor del backend esté corriendo (p.ej., `labcentral-backend`).
2. Abra una terminal en dicho contenedor:
   ```bash
   docker-compose exec app-backend bash
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

1. Llama a la API de Docker para crear o reutilizar un contenedor.
2. Expone el puerto definido en la base de datos (`exercise.port`) mediante un proxy interno.
3. Devuelve la URL para que el usuario acceda.
