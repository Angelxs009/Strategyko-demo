import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp, setupSwagger } from '../src/setup-app.js';

// Tests de CONTRATO: lo que Swagger publica debe ser exactamente lo que la API hace.

const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://strategyko:strategyko@localhost:55434/strategyko_rates_test';
const TENANT = 'tenant-contract';
const ERROR_SCHEMA = { $ref: '#/components/schemas/ErrorResponseDto' };
const BAD_GATEWAY_SCHEMA = { $ref: '#/components/schemas/BadGatewayDto' };

async function makeApp(env: Record<string, string>): Promise<INestApplication> {
  Object.assign(process.env, { DATABASE_URL: TEST_DB, RATES_MODE: 'demo', DEV_TENANT_ID: TENANT, STRATEGYKO_URL: '', SERVICE_API_KEY: '', ...env });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  setupApp(app);
  setupSwagger(app);
  await app.init();
  return app;
}

// ---- Validador mínimo de OpenAPI 3 ----

interface Schema {
  $ref?: string;
  type?: string;
  enum?: unknown[];
  nullable?: boolean;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  additionalProperties?: Schema | boolean;
  oneOf?: Schema[];
}
interface Operation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: { name: string; in: string; required?: boolean }[];
  responses: Record<string, { content?: Record<string, { schema: Schema; example?: unknown }> }>;
}
interface OpenApiDoc {
  info: { title: string; description?: string; version: string };
  tags?: { name: string; description?: string }[];
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
}

const ROOT = '$';

function validate(schema: Schema, value: unknown, doc: OpenApiDoc, path: string, errors: string[]): void {
  const s = schema.$ref ? doc.components.schemas[schema.$ref.split('/').pop()!] : schema;
  if (!s) {
    errors.push(`${path}: esquema no encontrado (${schema.$ref})`);
    return;
  }
  if (value === null) {
    if (!s.nullable) errors.push(`${path}: es null pero el esquema no lo permite`);
    return;
  }
  if (s.oneOf) {
    const ok = s.oneOf.some((o) => {
      const e: string[] = [];
      validate(o, value, doc, path, e);
      return e.length === 0;
    });
    if (!ok) errors.push(`${path}: no coincide con ninguna opción de oneOf`);
    return;
  }
  if (s.enum && !s.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} no está en el enum ${JSON.stringify(s.enum)}`);

  switch (s.type) {
    case 'string':
      if (typeof value !== 'string') errors.push(`${path}: debería ser string y es ${typeof value}`);
      break;
    case 'number':
    case 'integer':
      if (typeof value !== 'number') errors.push(`${path}: debería ser número y es ${typeof value}`);
      else if (s.type === 'integer' && !Number.isInteger(value)) errors.push(`${path}: debería ser entero`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`${path}: debería ser boolean y es ${typeof value}`);
      break;
    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`${path}: debería ser un arreglo`);
        break;
      }
      value.forEach((item, i) => s.items && validate(s.items, item, doc, `${path}[${i}]`, errors));
      break;
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${path}: debería ser un objeto`);
        break;
      }
      const obj = value as Record<string, unknown>;
      for (const key of s.required ?? []) {
        if (obj[key] === undefined) errors.push(`${path}.${key}: falta, y el esquema lo marca como obligatorio`);
      }
      for (const [key, v] of Object.entries(obj)) {
        const prop = s.properties?.[key];
        if (prop) validate(prop, v, doc, `${path}.${key}`, errors);
        else if (s.additionalProperties && typeof s.additionalProperties === 'object') validate(s.additionalProperties, v, doc, `${path}.${key}`, errors);
        else if (s.properties) errors.push(`${path}.${key}: la API lo devuelve pero NO está documentado`);
      }
      break;
    }
  }
}

describe('OpenAPI: el contrato publicado', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let doc: OpenApiDoc;

  const responseSchema = (path: string, method: string, status: string): Schema => {
    const schema = doc.paths[path]?.[method]?.responses[status]?.content?.['application/json']?.schema;
    if (!schema) throw new Error(`${method.toUpperCase()} ${path} no documenta la respuesta ${status}`);
    return schema;
  };

  const expectConforms = (schema: Schema, body: unknown, label: string) => {
    const errors: string[] = [];
    validate(schema, body, doc, ROOT, errors);
    expect(errors, `${label}\n${errors.join('\n')}`).toEqual([]);
  };

  beforeAll(async () => {
    app = await makeApp({});
    prisma = app.get(PrismaService);
    await prisma.rateQuery.deleteMany({ where: { tenantId: TENANT } });
    doc = (await request(app.getHttpServer()).get('/api/docs-json').expect(200)).body as OpenApiDoc;
  });

  afterAll(async () => {
    await prisma.rateQuery.deleteMany({ where: { tenantId: TENANT } });
    await app.close();
  });

  describe('documentación', () => {
    const operations = () => Object.entries(doc.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, op]) => ({ path, method, op })));
    const apiOperations = () => operations().filter((o) => o.path.startsWith('/api'));
    const errorCodes = (op: Operation) => Object.keys(op.responses).filter((c) => c.startsWith('4') || c.startsWith('5'));

    it('documenta exactamente los 7 endpoints esperados', () => {
      expect(operations().map((o) => `${o.method.toUpperCase()} ${o.path}`).sort()).toEqual(
        [
          'GET /api/compare',
          'GET /api/rates',
          'GET /api/rates/history',
          'GET /api/schedules',
          'GET /api/tracking/{reference}',
          'GET /health',
          'POST /api/push',
        ].sort(),
      );
    });

    it('la cabecera describe la API (título, versión, descripción y tags)', () => {
      expect(doc.info.title).toBe('Strategyko Rates API');
      expect(doc.info.version).toBe('1.1');
      expect(doc.info.description).toContain('modo demo');
      for (const t of doc.tags ?? []) expect(t.description, `tag ${t.name}`).toBeTruthy();
      expect((doc.tags ?? []).map((t) => t.name).sort()).toEqual(['compare', 'health', 'rates', 'schedules', 'strategyko', 'tracking']);
    });

    it('cada operación tiene resumen, descripción, tag y una respuesta de éxito con esquema', () => {
      for (const { path, method, op } of operations()) {
        const label = `${method.toUpperCase()} ${path}`;
        expect(op.summary, `${label} sin resumen`).toBeTruthy();
        expect(op.description, `${label} sin descripción`).toBeTruthy();
        expect(op.tags?.length, `${label} sin tag`).toBeGreaterThan(0);
        const success = Object.keys(op.responses).find((c) => c.startsWith('2'));
        expect(success, `${label} sin respuesta 2xx`).toBeTruthy();
        expect(op.responses[success!].content?.['application/json']?.schema, `${label} sin esquema de éxito`).toBeTruthy();
      }
    });

    it('las rutas /api documentan 400, 401 y 429; compare, tracking y push además 502', () => {
      for (const { path, method, op } of apiOperations()) {
        const label = `${method.toUpperCase()} ${path}`;
        for (const code of ['400', '401', '429']) expect(op.responses[code], `${label} no documenta ${code}`).toBeDefined();
      }
      for (const key of ['/api/compare', '/api/tracking/{reference}', '/api/push']) {
        const method = key === '/api/push' ? 'post' : 'get';
        expect(doc.paths[key][method].responses['502'], `${key} no documenta 502`).toBeDefined();
      }
    });

    it('los errores documentados tienen esquema', () => {
      for (const { path, method, op } of apiOperations()) {
        for (const code of errorCodes(op)) {
          expect(op.responses[code].content?.['application/json']?.schema, `${method.toUpperCase()} ${path} ${code}`).toBeTruthy();
        }
      }
    });

    it('cada ejemplo de error coincide con su código HTTP y con su esquema', () => {
      for (const { path, method, op } of apiOperations()) {
        for (const code of errorCodes(op)) {
          const label = `${method.toUpperCase()} ${path} ${code}`;
          const media = op.responses[code].content?.['application/json'];
          const example = media?.example as { statusCode?: number } | undefined;
          expect(example, `${label} sin ejemplo`).toBeDefined();
          expect(example!.statusCode, `${label}: el ejemplo trae otro statusCode`).toBe(Number(code));
          const errors: string[] = [];
          validate(media!.schema, example, doc, ROOT, errors);
          expect(errors, `${label}: el ejemplo no cumple su propio esquema\n${errors.join('\n')}`).toEqual([]);
        }
      }
    });

    it('los parámetros obligatorios están marcados', () => {
      const required = (path: string) => (doc.paths[path].get.parameters ?? []).filter((p) => p.required).map((p) => p.name).sort();
      expect(required('/api/rates')).toEqual(['origin']);
      expect(required('/api/compare')).toEqual(['origin']);
      expect(required('/api/schedules')).toEqual(['origin']);
      expect(required('/api/tracking/{reference}')).toEqual(['carrier', 'reference']);
      expect(required('/api/rates/history')).toEqual([]);
    });
  });

  describe('las respuestas reales coinciden con el esquema', () => {
    it('GET /health', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expectConforms(responseSchema('/health', 'get', '200'), res.body, 'GET /health');
    });

    it('GET /api/rates', async () => {
      const res = await request(app.getHttpServer()).get('/api/rates?origin=CNSHA').expect(200);
      expect(res.body.quotes).toHaveLength(3);
      expectConforms(responseSchema('/api/rates', 'get', '200'), res.body, 'GET /api/rates');
    });

    it('GET /api/rates/history', async () => {
      const res = await request(app.getHttpServer()).get('/api/rates/history?pageSize=5').expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expectConforms(responseSchema('/api/rates/history', 'get', '200'), res.body, 'GET /api/rates/history');
    });

    it('GET /api/compare', async () => {
      const res = await request(app.getHttpServer()).get('/api/compare?origin=CNNGB&container=20GP').expect(200);
      expectConforms(responseSchema('/api/compare', 'get', '200'), res.body, 'GET /api/compare');
    });

    it('GET /api/schedules', async () => {
      const res = await request(app.getHttpServer()).get('/api/schedules?origin=CNSHA&weeks=2').expect(200);
      expect(res.body.departures.length).toBeGreaterThan(0);
      expectConforms(responseSchema('/api/schedules', 'get', '200'), res.body, 'GET /api/schedules');
    });

    it('GET /api/tracking/{reference}: contenedor y BL', async () => {
      const container = await request(app.getHttpServer()).get('/api/tracking/CSQU3054383?carrier=MAERSK').expect(200);
      expectConforms(responseSchema('/api/tracking/{reference}', 'get', '200'), container.body, 'tracking contenedor');
      const bl = await request(app.getHttpServer()).get('/api/tracking/MSCU12345678?carrier=HAPAG_LLOYD').expect(200);
      expect(bl.body.tracking.referenceType).toBe('bl');
      expectConforms(responseSchema('/api/tracking/{reference}', 'get', '200'), bl.body, 'tracking BL');
    });

    it('POST /api/push (dry-run)', async () => {
      const res = await request(app.getHttpServer()).post('/api/push').send({ origin: 'CNSHA' }).expect(202);
      expect(res.body.dryRun).toBe(true);
      expect(res.body.payload.schedules.length).toBeGreaterThan(0);
      expectConforms(responseSchema('/api/push', 'post', '202'), res.body, 'POST /api/push');
    });
  });

  describe('los errores reales coinciden con el esquema documentado', () => {
    it('400: validación (mensajes en español)', async () => {
      const cases = [
        '/api/rates',
        '/api/rates?origin=USLAX',
        '/api/compare?origin=CNSHA&container=45HC',
        '/api/schedules?origin=CNSHA&weeks=99',
        '/api/rates/history?pageSize=1000',
        '/api/tracking/CSQU3054384?carrier=MAERSK',
        '/api/tracking/CSQU3054383',
      ];
      for (const url of cases) {
        const res = await request(app.getHttpServer()).get(url).expect(400);
        expectConforms(ERROR_SCHEMA, res.body, `400 ${url}`);
      }
      const push = await request(app.getHttpServer()).post('/api/push').send({ origin: 'USLAX' }).expect(400);
      expectConforms(ERROR_SCHEMA, push.body, '400 push');
    });

    it('401: clave inválida cuando SERVICE_API_KEY está activa', async () => {
      const secured = await makeApp({ SERVICE_API_KEY: 'clave-de-contrato' });
      try {
        const res = await request(secured.getHttpServer()).get('/api/rates?origin=CNSHA').expect(401);
        expectConforms(ERROR_SCHEMA, res.body, '401');
        await request(secured.getHttpServer()).get('/health').expect(200);
      } finally {
        await secured.close();
      }
    });

    it('429: supera el límite de 60 solicitudes por minuto', async () => {
      const limited = await makeApp({});
      try {
        for (let i = 0; i < 60; i++) await request(limited.getHttpServer()).get('/health').expect(200);
        const res = await request(limited.getHttpServer()).get('/health').expect(429);
        expectConforms(ERROR_SCHEMA, res.body, '429');
        expect(res.body.statusCode).toBe(429);
      } finally {
        await limited.close();
      }
    });

    it('502: modo live sin contratos verificados (compare, tracking y push)', async () => {
      const live = await makeApp({ RATES_MODE: 'live' });
      try {
        const compare = await request(live.getHttpServer()).get('/api/compare?origin=CNSHA').expect(502);
        expectConforms(BAD_GATEWAY_SCHEMA, compare.body, '502 compare');
        expect(compare.body.errors).toHaveLength(3);
        const tracking = await request(live.getHttpServer()).get('/api/tracking/CSQU3054383?carrier=CMA_CGM').expect(502);
        expectConforms(BAD_GATEWAY_SCHEMA, tracking.body, '502 tracking');
        const push = await request(live.getHttpServer()).post('/api/push').send({ origin: 'CNSHA' }).expect(502);
        expectConforms(BAD_GATEWAY_SCHEMA, push.body, '502 push');
      } finally {
        await live.close();
      }
    });
  });

  describe('el validador de contrato detecta desvíos', () => {
    it('señala campos no documentados, faltantes y de tipo incorrecto', () => {
      const schema: Schema = { type: 'object', required: ['a', 'b'], properties: { a: { type: 'string' }, b: { type: 'number' } } };
      const run = (value: unknown) => {
        const errors: string[] = [];
        validate(schema, value, doc, ROOT, errors);
        return errors;
      };
      expect(run({ a: 'x', b: 1 })).toEqual([]);
      expect(run({ a: 'x', b: 1, extra: true }).join()).toContain('NO está documentado');
      expect(run({ a: 'x' }).join()).toContain('$.b: falta');
      expect(run({ a: 5, b: 1 }).join()).toContain('debería ser string');
    });
  });
});
