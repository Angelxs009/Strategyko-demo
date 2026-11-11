import type { ConfigService } from '@nestjs/config';
import { BadGatewayException } from '@nestjs/common';
import { compareQuotes } from '../compare/compare.js';
import type { CompareService } from '../compare/compare.service.js';
import { DemoCarrierAdapter } from '../carriers/demo.adapter.js';
import type { SchedulesService } from '../schedules/schedules.service.js';
import { buildDemoDepartures } from '../carriers/demo-extras.js';
import type { RateQuery } from '../common/types.js';
import { SCHEMA_VERSION, StrategykoSyncService } from './strategyko-sync.service.js';

const query: RateQuery = { origin: 'CNSHA', destination: 'ECGYE', container: '40HC' };

async function build(env: Record<string, string>) {
  const quotes = await Promise.all((['MAERSK', 'CMA_CGM', 'HAPAG_LLOYD'] as const).map((c) => new DemoCarrierAdapter(c).getRate(query)));
  const compare = {
    compare: async () => ({ query, quotes, errors: [], comparison: compareQuotes(quotes) }),
  } as unknown as CompareService;
  const departures = (['MAERSK', 'CMA_CGM', 'HAPAG_LLOYD'] as const).flatMap((c) => buildDemoDepartures(c, { ...query, weeks: 2 }, new Date('2026-11-11T10:00:00Z')));
  const schedules = { fetch: async () => ({ departures, errors: [] }) } as unknown as SchedulesService;
  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  return new StrategykoSyncService(compare, schedules, config);
}

afterEach(() => vi.unstubAllGlobals());

describe('StrategykoSyncService.push', () => {
  it('sin STRATEGYKO_URL hace dry-run y no llama a la red', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await (await build({})).push(query);
    expect(r.dryRun).toBe(true);
    expect(r.delivered).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.payload.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.payload.origin).toBe('strategyko-rates');
    expect(r.payload.dataMode).toBe('demo');
    expect(r.payload.quotes).toHaveLength(3);
    expect(r.payload.comparison.n).toBe(3);
    expect(r.payload.schedules).toHaveLength(6);
  });

  it('con STRATEGYKO_URL envía el payload versionado con Bearer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const r = await (await build({ STRATEGYKO_URL: 'https://strategyko.test/rates', STRATEGYKO_API_KEY: 'k123' })).push(query);
    expect(r.delivered).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://strategyko.test/rates');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer k123');
    expect(JSON.parse(init.body).schemaVersion).toBe('1.1');
  });

  it('responde 502 si Strategyko devuelve error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect((await build({ STRATEGYKO_URL: 'https://strategyko.test' })).push(query)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('responde 502 si falla la red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect((await build({ STRATEGYKO_URL: 'https://strategyko.test' })).push(query)).rejects.toThrow(/No se pudo contactar/);
  });
});
