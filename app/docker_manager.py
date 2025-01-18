import docker
from docker.errors import NotFound, APIError

client = docker.from_env()

def start_exercise(docker_image, port):
    """
    Inicia un contenedor basado en la imagen de Docker especificada.
    Si un contenedor con el mismo nombre ya existe, lo detiene y lo reemplaza.

    Args:
        docker_image (str): Nombre de la imagen Docker.
        port (int): Puerto que se mapeará en el host.

    Returns:
        dict: Información sobre el contenedor iniciado.
    """
    container_name = f"exercise-{docker_image}-{port}"
    try:
        # Verifica si ya existe un contenedor con el mismo nombre
        existing_container = client.containers.get(container_name)
        if existing_container.status == "running":
            return {"message": f"Container {container_name} is already running", "url": f"http://localhost:{port}"}
        else:
            # Si el contenedor existe pero no está corriendo, lo elimina
            existing_container.remove(force=True)
    except NotFound:
        pass  # Si no existe el contenedor, continúa normalmente

    try:
        # Crea y ejecuta un nuevo contenedor
        container = client.containers.run(
            docker_image,
            detach=True,
            ports={'5000/tcp': port},
            name=container_name,
        )
        return {"message": f"Container {container_name} started successfully", "url": f"http://localhost:{port}"}
    except APIError as e:
        return {"error": f"Failed to start container: {str(e)}"}

def stop_exercise(container_name):
    """
    Detiene y elimina un contenedor basado en su nombre.

    Args:
        container_name (str): Nombre del contenedor.

    Returns:
        dict: Información sobre el contenedor detenido.
    """
    try:
        container = client.containers.get(container_name)
        container.stop()
        container.remove()
        return {"message": f"Container {container_name} stopped and removed successfully"}
    except NotFound:
        return {"error": f"Container {container_name} not found"}
    except APIError as e:
        return {"error": f"Failed to stop container: {str(e)}"}

def list_running_exercises():
    """
    Lista todos los contenedores activos.

    Returns:
        list: Nombres de los contenedores activos.
    """
    containers = client.containers.list()
    return [container.name for container in containers]
