import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

// Base de datos de prueba separada (strategyko_rates_test).
const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://strategyko:strategyko@localhost:55434/strategyko_rates_test';

async function makeApp(env: Record<string, string>): Promise<INestApplication> {
  Object.assign(process.env, { DATABASE_URL: TEST_DB, RATES_MODE: 'demo', DEV_TENANT_ID: 'tenant-a', STRATEGYKO_URL: '', SERVICE_API_KEY: '', ...env });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  setupApp(app);
  await app.init();
  return app;
}

describe('API (integración)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await makeApp({});
    prisma = app.get(PrismaService);
    await prisma.rateQuery.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde ok y el modo', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', mode: 'demo' });
  });

  it('GET /api/rates devuelve 3 tarifas demo y las guarda', async () => {
    const res = await request(app.getHttpServer()).get('/api/rates?origin=CNSHA').expect(200);
    expect(res.body.n).toBe(3);
    expect(res.body.errors).toEqual([]);
    expect(res.body.query).toMatchObject({ origin: 'CNSHA', destination: 'ECGYE', container: '40HC' });
    for (const q of res.body.quotes) {
      expect(q.source).toBe('demo');
      expect(q.totalUsd).toBeCloseTo(q.baseFreightUsd + q.surcharges.reduce((a: number, s: { amountUsd: number }) => a + s.amountUsd, 0), 2);
    }
    expect(await prisma.rateQuoteRecord.count({ where: { tenantId: 'tenant-a' } })).toBe(3);
  });

  it('GET /api/rates con parámetros inválidos responde 400 en español', async () => {
    const res = await request(app.getHttpServer()).get('/api/rates?origin=USLAX&container=45HC').expect(400);
    expect(JSON.stringify(res.body.message)).toContain('origin debe ser un puerto de China');
    expect(JSON.stringify(res.body.message)).toContain('container debe ser uno de');
    await request(app.getHttpServer()).get('/api/rates').expect(400);
  });

  it('GET /api/compare entrega ranking, balance, desglose e insights', async () => {
    const res = await request(app.getHttpServer()).get('/api/compare?origin=CNNGB&container=20GP').expect(200);
    const c = res.body.comparison;
    expect(c.mode).toBe('demo');
    expect(c.warning).toContain('simulados');
    expect(c.ranking).toHaveLength(3);
    expect(c.ranking[0].deltaUsd).toBe(0);
    expect(c.breakdown[0].code).toBe('BASE');
    expect(c.insights.length).toBeGreaterThan(2);
  });

  it('GET /api/rates/history pagina y filtra', async () => {
    const res = await request(app.getHttpServer()).get('/api/rates/history?carrier=MAERSK&pageSize=1').expect(200);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].carrier).toBe('MAERSK');
    expect(res.body.items[0].surcharges.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    await request(app.getHttpServer()).get('/api/rates/history?pageSize=1000').expect(400);
  });

  it('aísla datos entre tenants: el historial nunca devuelve filas de otro tenant', async () => {
    await prisma.rateQuery.create({
      data: {
        tenantId: 'tenant-b',
        origin: 'CNSHA',
        destination: 'ECGYE',
        container: '40HC',
        quotes: {
          create: [
            {
              tenantId: 'tenant-b',
              carrier: 'MAERSK',
              origin: 'CNSHA',
              destination: 'ECGYE',
              container: '40HC',
              baseFreightUsd: 1,
              totalUsd: 1,
              transitDays: 1,
              validFrom: new Date('2026-11-09'),
              validTo: new Date('2026-11-22'),
              source: 'demo',
            },
          ],
        },
      },
    });
    const res = await request(app.getHttpServer()).get('/api/rates/history?pageSize=100').expect(200);
    expect(res.body.items.some((i: { totalUsd: number }) => i.totalUsd === 1)).toBe(false);
    expect(await prisma.rateQuoteRecord.count({ where: { tenantId: 'tenant-b' } })).toBe(1);
  });

  it('POST /api/push hace dry-run con 202 sin STRATEGYKO_URL', async () => {
    const res = await request(app.getHttpServer()).post('/api/push').send({ origin: 'CNSHA' }).expect(202);
    expect(res.body).toMatchObject({ delivered: false, dryRun: true });
    expect(res.body.payload.schemaVersion).toBe('1.0');
    expect(res.body.payload.dataMode).toBe('demo');
    expect(res.body.payload.quotes).toHaveLength(3);
  });

  it('POST /api/push valida el cuerpo', async () => {
    await request(app.getHttpServer()).post('/api/push').send({ origin: 'USLAX' }).expect(400);
  });
});

describe('Protección por x-api-key', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await makeApp({ SERVICE_API_KEY: 'secreto-de-prueba' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health sigue abierto', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('/api exige la clave', async () => {
    await request(app.getHttpServer()).get('/api/rates?origin=CNSHA').expect(401);
    await request(app.getHttpServer()).get('/api/rates?origin=CNSHA').set('x-api-key', 'mala').expect(401);
    await request(app.getHttpServer()).get('/api/rates?origin=CNSHA').set('x-api-key', 'secreto-de-prueba').expect(200);
  });
});

describe('Modo live sin credenciales', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await makeApp({ RATES_MODE: 'live' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('no cae a demo: informa error por naviera y /compare responde 502', async () => {
    const rates = await request(app.getHttpServer()).get('/api/rates?origin=CNSHA').expect(200);
    expect(rates.body.quotes).toEqual([]);
    expect(rates.body.errors).toHaveLength(3);
    expect(rates.body.errors[0].message).toContain('no está configurado');
    const cmp = await request(app.getHttpServer()).get('/api/compare?origin=CNSHA').expect(502);
    expect(cmp.body.errors).toHaveLength(3);
  });
});
