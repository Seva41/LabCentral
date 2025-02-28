import docker
from docker.errors import NotFound, APIError, BuildError

client = docker.from_env()

def build_and_start_exercise(dockerfile_path, image_tag, port):
    """
    Construye una imagen a partir de un Dockerfile local y
    lanza un contenedor basado en esa imagen.

    Args:
        dockerfile_path (str): Ruta del Dockerfile o carpeta donde se ubica.
        image_tag (str): Tag único para la imagen.
        port (int): Puerto que se mapeará en el host.

    Returns:
        dict: Información sobre la creación de contenedor y su URL o un mensaje de error.
    """
    container_name = f"exercise-{image_tag}-{port}"

    # 1. Verifica si ya existe un contenedor con ese nombre
    try:
        existing_container = client.containers.get(container_name)
        if existing_container.status == "running":
            return {
                "message": f"Container {container_name} is already running",
                "url": f"http://localhost:{port}"
            }
        else:
            existing_container.remove(force=True)
    except NotFound:
        pass  # No existía el contenedor, podemos continuar

    # 2. Construye la imagen desde dockerfile_path
    try:
        # Si tu Dockerfile no se llama "Dockerfile", podrías usar:
        # client.images.build(path=dockerfile_path, dockerfile='MiDockerfile', tag=image_tag)
        client.images.build(path=dockerfile_path, tag=image_tag)
    except (APIError, BuildError) as e:
        return {"error": f"Failed to build image: {str(e)}"}

    # 3. Lanza el contenedor
    try:
        container = client.containers.run(
            image_tag,
            detach=True,
            ports={'5000/tcp': port},  # Mapea 5000 del contenedor a 'port' del host
            name=container_name,
        )
        return {
            "message": f"Container {container_name} started successfully",
            "url": f"http://localhost:{port}"
        }
    except APIError as e:
        return {"error": f"Failed to start container: {str(e)}"}


def start_exercise(docker_image, port):
    """
    Inicia un contenedor basado en una imagen Docker ya existente.
    Si un contenedor con el mismo nombre existe, lo detiene y reemplaza.

    Args:
        docker_image (str): Nombre/tag de la imagen Docker preexistente.
        port (int): Puerto que se mapeará en el host.

    Returns:
        dict: Información sobre el contenedor iniciado o mensaje de error.
    """
    container_name = f"exercise-{docker_image}-{port}"

    # Verifica si ya existe un contenedor con ese nombre
    try:
        existing_container = client.containers.get(container_name)
        if existing_container.status == "running":
            return {
                "message": f"Container {container_name} is already running",
                "url": f"http://localhost:{port}"
            }
        else:
            existing_container.remove(force=True)
    except NotFound:
        pass

    # Lanza el contenedor con la imagen indicada
    try:
        container = client.containers.run(
            docker_image,
            detach=True,
            ports={'5000/tcp': None},
            name=container_name,
        )
        print("Container status:", container.status)
        return {
            "message": f"Container {container_name} started successfully",
            "url": f"http://localhost:{port}"
        }
    except APIError as e:
        return {"error": f"Failed to start container: {str(e)}"}


def stop_exercise(container_name):
    """
    Detiene y elimina un contenedor basado en su nombre.

    Args:
        container_name (str): Nombre del contenedor.

    Returns:
        dict: Mensaje de éxito o error.
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
    Lista los nombres de todos los contenedores en estado "running".

    Returns:
        list: Nombres de los contenedores activos.
    """
    containers = client.containers.list()
    return [container.name for container in containers]
