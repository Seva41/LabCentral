# Ejercicios

En esta carpeta, deben incluirse los ejercicios que la aplicación listará en su dashboard.

Cada ejercicio deberá ir en su propia carpeta, que llevará el nombre interno del ejercicio a tratar en el código. Dentro de esta subcarpeta, deberá ir la aplicación a lanzar, en formato Dockerfile, junto a todos los archivos que requiera para su funcionamiento.

Luego, en el backend, deberá añadirse a `exercises.json`, en formato:

```json
{
    "title": "CTF 2",
    "description": "Test curso",
    "dockerfile_path": "dockerfiles/ctf2",
    "port": 8004
  }
```

## Ejemplo

Si tengo un ejercicio llamado "SQL Injection" y otro llamado "CTF 1", la estructura será:
```
/dockerfiles/sql_injection/Dockerfile
/dockerfiles/ctf1/Dockerfile
```
y el contenido de `exercises.json` será:

```json
[
  {
    "title": "SQL Inyection",
    "description": "Descripción de ejercicio de inyección SQL",
    "dockerfile_path": "dockerfiles/sql_injection",
    "port": 8004
  }
  {
    "title": "CTF 1",
    "description": "Descripción de CTF 1",
    "dockerfile_path": "dockerfiles/ctf1",
    "port": 8005
  }
]
```