# Backend (NestJS + Prisma). Se usa para desplegar en Railway.
FROM node:24-slim
WORKDIR /app

# Se copia todo antes de instalar porque `postinstall` ejecuta `prisma generate`,
# que necesita prisma/schema.prisma y prisma.config.ts.
COPY . .
RUN npm ci && npm run build

ENV NODE_ENV=production
EXPOSE 4000

# Aplica las migraciones y arranca. Railway define PORT automaticamente.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
