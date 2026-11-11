import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

/** Configuración común de la app (la usan main.ts y los tests de integración). */
export function setupApp(app: INestApplication): void {
  app.use(helmet());
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Strategyko Rates')
    .setDescription('Tarifas de navieras desde China y análisis comparativo (pieza de Synapse).')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
}
