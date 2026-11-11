import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp, setupSwagger } from './setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  setupSwagger(app);
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
