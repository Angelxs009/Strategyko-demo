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

const DESCRIPTION = `
API de **tarifas, próximas salidas y seguimiento** de navieras con origen en China (pieza de *Synapse* para Strategyko).

### Modo de datos
Hoy el servicio corre en **modo demo**: tarifas, salidas y seguimiento son **simulados** y vienen marcados con \`source: "demo"\`
(los buques se llaman \`DEMO ...\`). Cuando algún dato es simulado, las respuestas traen \`mode\` y un \`warning\` explícito.
El modo \`live\` requiere credenciales de cada naviera y aún no tiene contratos verificados.

### Cómo probar
1. Abre un endpoint y pulsa **Try it out**. Los campos traen ejemplos válidos (\`origin\` = \`CNSHA\`).
2. Si el servicio tiene \`SERVICE_API_KEY\`, pulsa **Authorize** e ingresa la clave una sola vez.
3. Para seguimiento usa el contenedor de ejemplo \`CSQU3054383\` (es válido según ISO 6346).

### Errores
Todos los errores traen \`statusCode\` y \`message\` en español: **400** validación, **401** clave inválida, **429** límite de 60 solicitudes por minuto, **502** falló una dependencia (navieras o Strategyko).
Si una naviera falla, las demás siguen y el fallo se informa por naviera en \`errors\`.
`;

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Strategyko Rates API')
    .setDescription(DESCRIPTION)
    .setVersion('1.1')
    .addServer(`http://localhost:${process.env.PORT ?? 4000}`, 'Local')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header', description: 'Solo si el servicio define `SERVICE_API_KEY`' }, 'api-key')
    .addTag('rates', 'Tarifas de las navieras, normalizadas, y su historial')
    .addTag('compare', 'Análisis comparativo de tarifas: ranking, equilibrio, dispersión, desglose e insights')
    .addTag('schedules', 'Próximas salidas de las navieras para una ruta')
    .addTag('tracking', 'Seguimiento de un contenedor o BL')
    .addTag('strategyko', 'Envío del paquete a Strategyko (dry-run si no hay URL configurada)')
    .addTag('health', 'Estado del servicio')
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config), {
    customSiteTitle: 'Strategyko Rates API',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, defaultModelsExpandDepth: 1 },
  });
}
