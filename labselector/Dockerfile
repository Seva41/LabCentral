# Dockerfile (Frontend - labselector)
FROM node:18

# Crear el directorio de trabajo dentro del contenedor
WORKDIR /frontend

# Copiar archivos de configuración y dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto donde correrá Next.js
EXPOSE 3000

# Comando para iniciar Next.js
CMD ["npm", "run", "dev"]