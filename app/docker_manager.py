import docker

def create_user_container(user_id):
    client = docker.from_env()
    container_name = f"user_{user_id}_exercise"
    container = client.containers.run(
        "kalilinux/kali-rolling",
        name=container_name,
        detach=True,
        network_mode="bridge",
        auto_remove=True
    )
    return container