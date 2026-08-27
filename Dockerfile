FROM node:18-slim

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm install --production

# Copiar código fuente y datos
COPY config/ ./config/
COPY data/ ./data/
COPY src/ ./src/

# El bot no es un servidor web, corre como proceso
CMD ["node", "src/index.js", "--all"]
