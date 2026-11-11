import { DemoCarrierAdapter } from './demo.adapter.js';
import { isoWeek } from './demo-rates.js';
import { CARRIERS, computeTotal } from '../common/types.js';
import type { RateQuery } from '../common/types.js';

const query: RateQuery = { origin: 'CNSHA', destination: 'ECGYE', container: '40HC' };
const monday = new Date('2026-11-09T10:00:00Z');
const sunday = new Date('2026-11-15T23:00:00Z');
const nextWeek = new Date('2026-11-17T10:00:00Z');

describe('DemoCarrierAdapter', () => {
  it.each(CARRIERS)('%s: marca source = "demo" y cumple total = base + recargos', async (carrier) => {
    const q = await new DemoCarrierAdapter(carrier).getRate(query, monday);
    expect(q.source).toBe('demo');
    expect(q.carrier).toBe(carrier);
    expect(q.currency).toBe('USD');
    expect(q.totalUsd).toBe(computeTotal(q.baseFreightUsd, q.surcharges));
    expect(q.surcharges.map((s) => s.code)).toEqual(['BAF', 'THC', 'DOC', 'SEAL']);
  });

  it('es determinista dentro de la misma semana', async () => {
    const adapter = new DemoCarrierAdapter('MAERSK');
    expect(await adapter.getRate(query, monday)).toEqual(await adapter.getRate(query, sunday));
  });

  it('varía poco entre semanas (menos de 10 % en el total)', async () => {
    const adapter = new DemoCarrierAdapter('MAERSK');
    const a = await adapter.getRate(query, monday);
    const b = await adapter.getRate(query, nextWeek);
    expect(a.validFrom).not.toBe(b.validFrom);
    expect(Math.abs(a.totalUsd - b.totalUsd) / a.totalUsd).toBeLessThan(0.1);
  });

  it('las tres navieras principales tienen totales distintos', async () => {
    const totals = await Promise.all(
      (['MAERSK', 'CMA_CGM', 'HAPAG_LLOYD'] as const).map(
        async (c) => (await new DemoCarrierAdapter(c).getRate(query, monday)).totalUsd,
      ),
    );
    expect(new Set(totals).size).toBe(3);
  });

  it('20GP es más barato que 40HC', async () => {
    const adapter = new DemoCarrierAdapter('CMA_CGM');
    const small = await adapter.getRate({ ...query, container: '20GP' }, monday);
    const big = await adapter.getRate(query, monday);
    expect(small.totalUsd).toBeLessThan(big.totalUsd);
  });
});

describe('isoWeek', () => {
  it('devuelve el lunes y la clave de la semana', () => {
    expect(isoWeek(sunday).monday.toISOString().slice(0, 10)).toBe('2026-11-09');
    expect(isoWeek(sunday).key).toBe('2026-W46');
  });
});
