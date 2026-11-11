import type { Carrier, DataMode, RateQuote } from '../common/types.js';
import { resolveMode, round2 } from '../common/types.js';

export const CARRIER_LABELS: Record<Carrier, string> = {
  MAERSK: 'Maersk',
  CMA_CGM: 'CMA CGM',
  HAPAG_LLOYD: 'Hapag-Lloyd',
  MSC: 'MSC',
};

export const COST_WEIGHT = 0.7;
export const TRANSIT_WEIGHT = 0.3;

export interface RankingEntry {
  rank: number;
  carrier: Carrier;
  totalUsd: number;
  deltaUsd: number; // frente a la más barata
  deltaPct: number;
  transitDays: number;
  usdPerTransitDay: number;
  balanceScore: number; // menor es mejor
  validFrom: string;
  validTo: string;
  source: RateQuote['source'];
}

export interface BreakdownRow {
  code: string; // 'BASE' para el flete base
  name: string;
  byCarrier: Partial<Record<Carrier, number>>;
}

export interface Comparison {
  mode: DataMode;
  warning: string | null;
  n: number; // número de tarifas comparadas
  cheapest: Carrier;
  fastest: Carrier;
  bestBalance: Carrier;
  ranking: RankingEntry[];
  spread: { usd: number; pct: number };
  averageUsd: number;
  breakdown: BreakdownRow[];
  insights: string[];
}

export class NotEnoughQuotesError extends Error {
  constructor(readonly available: number) {
    super(`Se necesitan al menos 2 tarifas para comparar (disponibles: ${available}).`);
    this.name = 'NotEnoughQuotesError';
  }
}

const normalize = (v: number, min: number, max: number) => (max === min ? 0 : (v - min) / (max - min));

/** Compara tarifas de distintas navieras. Requiere al menos 2. */
export function compareQuotes(quotes: RateQuote[]): Comparison {
  if (quotes.length < 2) throw new NotEnoughQuotesError(quotes.length);

  const totals = quotes.map((q) => q.totalUsd);
  const transits = quotes.map((q) => q.transitDays);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);
  const minTransit = Math.min(...transits);
  const maxTransit = Math.max(...transits);

  const scored = quotes.map((q) => ({
    q,
    balanceScore: round2(
      COST_WEIGHT * normalize(q.totalUsd, minTotal, maxTotal) +
        TRANSIT_WEIGHT * normalize(q.transitDays, minTransit, maxTransit),
    ),
  }));

  const ranking: RankingEntry[] = [...scored]
    .sort((a, b) => a.q.totalUsd - b.q.totalUsd || a.q.transitDays - b.q.transitDays)
    .map(({ q, balanceScore }, i) => ({
      rank: i + 1,
      carrier: q.carrier,
      totalUsd: q.totalUsd,
      deltaUsd: round2(q.totalUsd - minTotal),
      deltaPct: round2(((q.totalUsd - minTotal) / minTotal) * 100),
      transitDays: q.transitDays,
      usdPerTransitDay: round2(q.totalUsd / q.transitDays),
      balanceScore,
      validFrom: q.validFrom,
      validTo: q.validTo,
      source: q.source,
    }));

  const cheapest = ranking[0].carrier;
  const fastestQuote = [...quotes].sort((a, b) => a.transitDays - b.transitDays || a.totalUsd - b.totalUsd)[0];
  const bestBalance = [...scored].sort((a, b) => a.balanceScore - b.balanceScore || a.q.totalUsd - b.q.totalUsd)[0].q
    .carrier;

  const mode = resolveMode(quotes.map((q) => q.source));
  const spreadUsd = round2(maxTotal - minTotal);
  const averageUsd = round2(totals.reduce((a, b) => a + b, 0) / totals.length);

  const comparison: Comparison = {
    mode,
    warning: mode === 'live' ? null : 'Datos simulados (modo demo): no son tarifas reales. No los uses para cotizar.',
    n: quotes.length,
    cheapest,
    fastest: fastestQuote.carrier,
    bestBalance,
    ranking,
    spread: { usd: spreadUsd, pct: round2((spreadUsd / minTotal) * 100) },
    averageUsd,
    breakdown: buildBreakdown(quotes),
    insights: [],
  };
  comparison.insights = buildInsights(comparison, quotes);
  return comparison;
}

function buildBreakdown(quotes: RateQuote[]): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  rows.set('BASE', { code: 'BASE', name: 'Flete base', byCarrier: {} });
  for (const q of quotes) {
    rows.get('BASE')!.byCarrier[q.carrier] = q.baseFreightUsd;
    for (const s of q.surcharges) {
      if (!rows.has(s.code)) rows.set(s.code, { code: s.code, name: s.name, byCarrier: {} });
      rows.get(s.code)!.byCarrier[q.carrier] = s.amountUsd;
    }
  }
  return [...rows.values()];
}

function buildInsights(c: Comparison, quotes: RateQuote[]): string[] {
  const label = (k: Carrier) => CARRIER_LABELS[k];
  const byCarrier = new Map(quotes.map((q) => [q.carrier, q]));
  const cheapest = byCarrier.get(c.cheapest)!;
  const fastest = byCarrier.get(c.fastest)!;
  const out: string[] = [];

  if (c.cheapest === c.fastest) {
    out.push(`${label(c.cheapest)} es a la vez la más económica (USD ${cheapest.totalUsd}) y la más rápida (${cheapest.transitDays} días).`);
  } else {
    const days = cheapest.transitDays - fastest.transitDays;
    const extra = round2(fastest.totalUsd - cheapest.totalUsd);
    out.push(`${label(c.cheapest)} es la más económica (USD ${cheapest.totalUsd}).`);
    out.push(
      `${label(c.fastest)} es la más rápida y llega ${days} ${days === 1 ? 'día' : 'días'} antes, pero cuesta USD ${extra} más.`,
    );
  }
  out.push(`${label(c.bestBalance)} ofrece el mejor equilibrio entre costo (70 %) y tránsito (30 %).`);
  out.push(`La dispersión entre la más cara y la más barata es de USD ${c.spread.usd} (${c.spread.pct} %).`);

  // Componente con mayor diferencia entre navieras.
  let widest: { name: string; gap: number } | null = null;
  for (const row of c.breakdown) {
    const values = Object.values(row.byCarrier) as number[];
    if (values.length < 2) continue;
    const gap = round2(Math.max(...values) - Math.min(...values));
    if (!widest || gap > widest.gap) widest = { name: row.name, gap };
  }
  if (widest && widest.gap > 0) {
    out.push(`El componente que más difiere entre navieras es «${widest.name}» (USD ${widest.gap} de diferencia).`);
  }
  if (c.warning) out.push(c.warning);
  return out;
}
