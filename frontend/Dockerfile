# Frontend (Next.js). Se usa para desplegar en Railway.
FROM node:24-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_API_URL se incrusta al compilar: debe ser la direccion publica del backend.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# `next start` usa la variable PORT que define Railway.
CMD ["npm", "run", "start"]
