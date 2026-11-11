import type { ConfigService } from '@nestjs/config';
import type { RateQuery } from '../../common/types.js';
import {
  CarrierAuthError,
  CarrierContractUnverifiedError,
  CarrierNotConfiguredError,
  CarrierRequestError,
  CarrierResponseError,
  TransientCarrierError,
} from '../carrier.adapter.js';
import { CmaCgmLiveAdapter } from './cmacgm.adapter.js';
import { HapagLiveAdapter } from './hapag.adapter.js';
import { carrierRequestJson } from './http.js';
import { LiveCarrierAdapter, type LiveRequest } from './live-carrier.adapter.js';
import { MaerskLiveAdapter } from './maersk.adapter.js';
import { ClientCredentialsTokenProvider } from './oauth2.js';
import { buildLiveQuote, type RawLiveRate } from './rate-mapping.js';

// IMPORTANTE: todo lo de este archivo son EJEMPLOS de prueba. No representan el contrato real
// de ninguna naviera ni se hacen llamadas de red reales.

const query: RateQuery = { origin: 'CNSHA', destination: 'ECGYE', container: '40HC' };
const cfg = (env: Record<string, string>) => ({ get: (k: string) => env[k] }) as unknown as ConfigService;
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('carrierRequestJson (clasificación de errores)', () => {
  const call = () => carrierRequestJson('TEST', 'https://example.test/x');

  it('devuelve el JSON en respuestas 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({ ok: 1 })));
    await expect(call()).resolves.toEqual({ ok: 1 });
  });

  it.each([429, 500, 503])('%i es transitorio', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({}, status)));
    await expect(call()).rejects.toBeInstanceOf(TransientCarrierError);
  });

  it('un fallo de red es transitorio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(call()).rejects.toThrow(/error de red/);
    await expect(call()).rejects.toBeInstanceOf(TransientCarrierError);
  });

  it('un timeout es transitorio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('t', 'TimeoutError')));
    await expect(call()).rejects.toThrow(/tiempo de espera agotado/);
  });

  it.each([401, 403])('%i es error de autenticación, no transitorio', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({}, status)));
    const err = await call().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CarrierAuthError);
    expect(err).not.toBeInstanceOf(TransientCarrierError);
  });

  it('otros 4xx son CarrierRequestError con el status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({}, 422)));
    await expect(call()).rejects.toMatchObject({ name: 'CarrierRequestError', status: 422 });
    expect(await call().catch((e: unknown) => e)).toBeInstanceOf(CarrierRequestError);
  });

  it('un cuerpo que no es JSON es CarrierResponseError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));
    await expect(call()).rejects.toBeInstanceOf(CarrierResponseError);
  });
});

describe('ClientCredentialsTokenProvider', () => {
  const provider = (now: () => number) =>
    new ClientCredentialsTokenProvider(
      { carrier: 'TEST', tokenUrl: 'https://example.test/token', clientId: 'id', clientSecret: 'sec' },
      now,
    );

  it('pide el token con client_credentials y lo cachea hasta que vence', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonRes({ access_token: 'tok-1', expires_in: 3600 }));
    vi.stubGlobal('fetch', fetchMock);
    let t = 1_000_000;
    const p = provider(() => t);

    expect(await p.getToken()).toBe('tok-1');
    expect(await p.getToken()).toBe('tok-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain('grant_type=client_credentials');
    expect(body).toContain('client_id=id');

    t += 3600 * 1000; // vencido
    await p.getToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('consultas en paralelo comparten una sola petición de token', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonRes({ access_token: 'tok', expires_in: 60 }));
    vi.stubGlobal('fetch', fetchMock);
    const p = provider(() => 0);
    await Promise.all([p.getToken(), p.getToken(), p.getToken()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falla con un error claro si la respuesta no trae access_token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => jsonRes({ nope: true })));
    await expect(provider(() => 0).getToken()).rejects.toThrow(/no incluye access_token/);
  });
});

describe('buildLiveQuote (validación)', () => {
  const ok: RawLiveRate = {
    baseFreight: 3000,
    surcharges: [
      { code: 'BAF', name: 'Combustible', amountUsd: 400 },
      { code: 'THC', name: 'Terminal', amountUsd: 250.5 },
    ],
    currency: 'USD',
    transitDays: 33,
    validFrom: '2026-11-09',
    validTo: '2026-11-22',
  };

  it('construye un RateQuote live con total = base + recargos', () => {
    const q = buildLiveQuote('MAERSK', query, ok);
    expect(q.source).toBe('live');
    expect(q.totalUsd).toBe(3650.5);
    expect(q.origin).toBe('CNSHA');
  });

  it('acepta un total declarado coherente y rechaza uno que no coincide', () => {
    expect(() => buildLiveQuote('MAERSK', query, { ...ok, declaredTotal: 3650.5 })).not.toThrow();
    expect(() => buildLiveQuote('MAERSK', query, { ...ok, declaredTotal: 3700 })).toThrow(/no coincide/);
  });

  it.each([
    ['moneda distinta de USD (no se convierte)', { currency: 'EUR' }],
    ['flete base negativo', { baseFreight: -1 }],
    ['flete base NaN', { baseFreight: Number.NaN }],
    ['tránsito 0', { transitDays: 0 }],
    ['tránsito decimal', { transitDays: 33.5 }],
    ['fecha mal formada', { validFrom: '09/11/2026' }],
    ['vigencia invertida', { validFrom: '2026-12-01', validTo: '2026-11-01' }],
    ['recargo sin código', { surcharges: [{ code: '', name: 'x', amountUsd: 1 }] }],
    ['recargo con monto inválido', { surcharges: [{ code: 'X', name: 'x', amountUsd: -5 }] }],
  ] as [string, Partial<RawLiveRate>][])('rechaza: %s', (_label, patch) => {
    expect(() => buildLiveQuote('MAERSK', query, { ...ok, ...patch })).toThrow(CarrierResponseError);
  });
});

// Adaptador de PRUEBA con un formato de respuesta INVENTADO solo para ejercitar el pipeline.
class ExampleAdapter extends LiveCarrierAdapter {
  readonly carrier = 'MAERSK' as const;
  protected readonly envPrefix = 'EXAMPLE';
  protected buildRequest(q: RateQuery): LiveRequest {
    return { method: 'GET', path: 'rates', query: { from: q.origin, to: q.destination } };
  }
  protected parseResponse(raw: unknown): RawLiveRate {
    const r = raw as { base: number; fees: { c: string; n: string; v: number }[]; days: number; from: string; to: string };
    return {
      baseFreight: r.base,
      surcharges: r.fees.map((f) => ({ code: f.c, name: f.n, amountUsd: f.v })),
      currency: 'USD',
      transitDays: r.days,
      validFrom: r.from,
      validTo: r.to,
    };
  }
  protected apiKeyHeader() {
    return 'x-example-key';
  }
}

describe('LiveCarrierAdapter (pipeline completo con fixture de ejemplo)', () => {
  const env = {
    EXAMPLE_BASE_URL: 'https://example.test/api',
    EXAMPLE_TOKEN_URL: 'https://example.test/token',
    EXAMPLE_CLIENT_ID: 'id',
    EXAMPLE_CLIENT_SECRET: 'sec',
  };
  const example = { base: 3000, fees: [{ c: 'BAF', n: 'Combustible', v: 400 }], days: 33, from: '2026-11-09', to: '2026-11-22' };

  it('obtiene token, consulta con Bearer y devuelve una cotización live', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      String(url).includes('/token') ? jsonRes({ access_token: 'tok', expires_in: 3600 }) : jsonRes(example),
    );
    vi.stubGlobal('fetch', fetchMock);
    const q = await new ExampleAdapter(cfg(env)).getRate(query);

    expect(q).toMatchObject({ source: 'live', totalUsd: 3400, transitDays: 33, carrier: 'MAERSK' });
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('https://example.test/api/rates?from=CNSHA&to=ECGYE');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('con API key usa el header definido por el adaptador', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonRes(example));
    vi.stubGlobal('fetch', fetchMock);
    await new ExampleAdapter(cfg({ EXAMPLE_BASE_URL: env.EXAMPLE_BASE_URL, EXAMPLE_API_KEY: 'k' })).getRate(query);
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ 'x-example-key': 'k' });
  });

  it('si falta configuración lista las variables faltantes y no llama a la red', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const err = await new ExampleAdapter(cfg({})).getRate(query).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CarrierNotConfiguredError);
    expect((err as Error).message).toContain('no está configurado');
    expect((err as Error).message).toContain('EXAMPLE_BASE_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('una respuesta inválida de la naviera falla en vez de inventar datos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => jsonRes({ ...example, days: 0 })));
    await expect(new ExampleAdapter(cfg({ EXAMPLE_BASE_URL: env.EXAMPLE_BASE_URL, EXAMPLE_API_KEY: 'k' })).getRate(query)).rejects.toBeInstanceOf(
      CarrierResponseError,
    );
  });
});

describe('Adaptadores reales (contrato sin verificar)', () => {
  const full = (p: string) => ({
    [`${p}_BASE_URL`]: 'https://example.test',
    [`${p}_TOKEN_URL`]: 'https://example.test/token',
    [`${p}_CLIENT_ID`]: 'id',
    [`${p}_CLIENT_SECRET`]: 'sec',
  });

  it.each([
    ['Maersk', (c: ConfigService) => new MaerskLiveAdapter(c), 'MAERSK'],
    ['CMA CGM', (c: ConfigService) => new CmaCgmLiveAdapter(c), 'CMACGM'],
    ['Hapag-Lloyd', (c: ConfigService) => new HapagLiveAdapter(c), 'HAPAG'],
  ] as const)('%s: sin credenciales informa qué variables faltan', async (_n, make, prefix) => {
    const err = await make(cfg({})).getRate(query).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CarrierNotConfiguredError);
    expect((err as Error).message).toContain(`${prefix}_BASE_URL`);
  });

  it.each([
    ['Maersk', (c: ConfigService) => new MaerskLiveAdapter(c), 'MAERSK'],
    ['CMA CGM', (c: ConfigService) => new CmaCgmLiveAdapter(c), 'CMACGM'],
    ['Hapag-Lloyd', (c: ConfigService) => new HapagLiveAdapter(c), 'HAPAG'],
  ] as const)('%s: con credenciales pero sin contrato verificado, falla claro y sin llamar a la red', async (name, make, prefix) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const err = await make(cfg(full(prefix))).getRate(query).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CarrierContractUnverifiedError);
    expect((err as Error).message).toContain(name);
    expect((err as Error).message).toContain('TODO(angel)');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
