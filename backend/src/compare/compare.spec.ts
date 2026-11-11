import { compareQuotes, NotEnoughQuotesError } from './compare.js';
import type { RateQuote } from '../common/types.js';

// Fixtures de ejemplo (no son tarifas reales).
const make = (carrier: RateQuote['carrier'], base: number, thc: number, transitDays: number, source: RateQuote['source'] = 'demo'): RateQuote => ({
  carrier,
  origin: 'CNSHA',
  destination: 'ECGYE',
  container: '40HC',
  baseFreightUsd: base,
  surcharges: [
    { code: 'THC', name: 'Manejo en terminal (THC)', amountUsd: thc },
    { code: 'DOC', name: 'Documentación (DOC)', amountUsd: 50 },
  ],
  totalUsd: base + thc + 50,
  transitDays,
  validFrom: '2026-11-09',
  validTo: '2026-11-22',
  currency: 'USD',
  source,
});

const maersk = make('MAERSK', 3000, 300, 34); // 3350
const cma = make('CMA_CGM', 2800, 250, 38); // 3100 (más barata)
const hapag = make('HAPAG_LLOYD', 3100, 350, 30); // 3500 (más rápida)

describe('compareQuotes', () => {
  const c = compareQuotes([maersk, cma, hapag]);

  it('ordena el ranking por total ascendente con deltas frente a la más barata', () => {
    expect(c.ranking.map((r) => r.carrier)).toEqual(['CMA_CGM', 'MAERSK', 'HAPAG_LLOYD']);
    expect(c.ranking.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(c.ranking[0].deltaUsd).toBe(0);
    expect(c.ranking[1].deltaUsd).toBe(250);
    expect(c.ranking[1].deltaPct).toBe(8.06);
    expect(c.ranking[2].deltaUsd).toBe(400);
  });

  it('identifica la más económica y la más rápida', () => {
    expect(c.cheapest).toBe('CMA_CGM');
    expect(c.fastest).toBe('HAPAG_LLOYD');
    expect(c.n).toBe(3);
  });

  it('calcula el balance 70/30 (menor es mejor)', () => {
    // CMA: costo 0 → 0*0.7 + tránsito (38-30)/8=1 → 0.3
    // MAERSK: costo 250/400=0.625 → 0.4375 + tránsito 0.5 → 0.15 = 0.5875 ≈ 0.59
    // HAPAG: costo 1 → 0.7 + tránsito 0 = 0.7
    const score = Object.fromEntries(c.ranking.map((r) => [r.carrier, r.balanceScore]));
    expect(score.CMA_CGM).toBe(0.3);
    expect(score.MAERSK).toBe(0.59);
    expect(score.HAPAG_LLOYD).toBe(0.7);
    expect(c.bestBalance).toBe('CMA_CGM');
  });

  it('calcula dispersión, promedio y USD por día de tránsito', () => {
    expect(c.spread).toEqual({ usd: 400, pct: 12.9 });
    expect(c.averageUsd).toBe(3316.67);
    expect(c.ranking[0].usdPerTransitDay).toBe(81.58);
  });

  it('desglosa flete base y cada recargo por naviera', () => {
    const base = c.breakdown.find((r) => r.code === 'BASE')!;
    expect(base.byCarrier).toEqual({ MAERSK: 3000, CMA_CGM: 2800, HAPAG_LLOYD: 3100 });
    const thc = c.breakdown.find((r) => r.code === 'THC')!;
    expect(thc.byCarrier.HAPAG_LLOYD).toBe(350);
    expect(c.breakdown.map((r) => r.code)).toEqual(['BASE', 'THC', 'DOC']);
  });

  it('genera insights en español', () => {
    expect(c.insights[0]).toContain('CMA CGM es la más económica');
    expect(c.insights.some((i) => i.includes('Hapag-Lloyd es la más rápida') && i.includes('8 días antes'))).toBe(true);
  });

  it('avisa explícitamente cuando los datos son demo', () => {
    expect(c.mode).toBe('demo');
    expect(c.warning).toContain('simulados');
  });

  it('modo mixed si hay datos demo y live; live sin aviso', () => {
    expect(compareQuotes([maersk, make('CMA_CGM', 2800, 250, 38, 'live')]).mode).toBe('mixed');
    const live = compareQuotes([make('MAERSK', 3000, 300, 34, 'live'), make('CMA_CGM', 2800, 250, 38, 'live')]);
    expect(live.mode).toBe('live');
    expect(live.warning).toBeNull();
  });

  it('con una sola tarifa lanza NotEnoughQuotesError', () => {
    expect(() => compareQuotes([maersk])).toThrow(NotEnoughQuotesError);
    expect(() => compareQuotes([])).toThrow(/al menos 2/);
  });

  it('si el costo y el tránsito empatan, el balance es 0 sin dividir por cero', () => {
    const a = make('MAERSK', 3000, 300, 34);
    const b = make('CMA_CGM', 3000, 300, 34);
    const r = compareQuotes([a, b]);
    expect(r.ranking.every((x) => x.balanceScore === 0)).toBe(true);
    expect(r.spread.usd).toBe(0);
  });
});
