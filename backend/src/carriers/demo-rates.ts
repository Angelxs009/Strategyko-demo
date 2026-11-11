import type { Carrier, ContainerType, RateQuery, RateQuote, Surcharge } from '../common/types.js';
import { computeTotal, round2 } from '../common/types.js';

// ATENCIÓN: todo lo de este archivo es SIMULADO e ilustrativo. No son tarifas reales.

interface DemoProfile {
  baseFreight40: number; // USD por 40GP, ruta de referencia (Shanghái → Guayaquil)
  baf: number;
  thc: number;
  doc: number;
  seal: number;
  transitDays: number;
}

export const DEMO_PROFILES: Record<Carrier, DemoProfile> = {
  MAERSK: { baseFreight40: 3350, baf: 420, thc: 285, doc: 65, seal: 15, transitDays: 34 },
  CMA_CGM: { baseFreight40: 3050, baf: 390, thc: 270, doc: 55, seal: 12, transitDays: 38 },
  HAPAG_LLOYD: { baseFreight40: 3200, baf: 440, thc: 300, doc: 70, seal: 18, transitDays: 32 },
  MSC: { baseFreight40: 3100, baf: 400, thc: 280, doc: 60, seal: 14, transitDays: 36 },
};

// Factor de distancia/ruta frente a Shanghái.
const ORIGIN_FACTOR: Record<string, number> = {
  CNSHA: 1,
  CNNGB: 0.99,
  CNSZX: 1.04,
  CNQIN: 0.96,
  CNTAO: 0.96,
};

const CONTAINER_FACTOR: Record<ContainerType, number> = { '20GP': 0.55, '40GP': 1, '40HC': 1.05 };

/** Clave de semana ISO (año-semana) y lunes de esa semana en UTC. */
export function isoWeek(date: Date): { key: string; monday: Date } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // lunes = 1 ... domingo = 7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (dayNum - 1));
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { key: `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, monday };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG determinista (mulberry32). */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Genera una tarifa simulada, determinista dentro de la misma semana ISO.
 * Entre semanas varía poco (±4 % en flete y recargos, ±1 día de tránsito).
 */
export function buildDemoQuote(carrier: Carrier, query: RateQuery, now: Date): RateQuote {
  const profile = DEMO_PROFILES[carrier];
  const { key, monday } = isoWeek(now);
  const rand = seededRandom(hashString(`${carrier}|${query.origin}|${query.destination}|${query.container}|${key}`));
  const vary = () => 0.96 + rand() * 0.08;

  const scale = (ORIGIN_FACTOR[query.origin] ?? 1) * CONTAINER_FACTOR[query.container];
  const baseFreightUsd = round2(profile.baseFreight40 * scale * vary());
  const containerSurchargeFactor = query.container === '20GP' ? 0.6 : 1;

  const surcharges: Surcharge[] = [
    { code: 'BAF', name: 'Recargo por combustible (BAF)', amountUsd: round2(profile.baf * scale * vary()) },
    { code: 'THC', name: 'Manejo en terminal (THC)', amountUsd: round2(profile.thc * containerSurchargeFactor * vary()) },
    { code: 'DOC', name: 'Documentación (DOC)', amountUsd: round2(profile.doc * vary()) },
    { code: 'SEAL', name: 'Precinto (SEAL)', amountUsd: round2(profile.seal * vary()) },
  ];

  const transitDays = Math.max(1, profile.transitDays + Math.round((rand() - 0.5) * 2));
  const validTo = new Date(monday);
  validTo.setUTCDate(monday.getUTCDate() + 13);

  return {
    carrier,
    origin: query.origin,
    destination: query.destination,
    container: query.container,
    baseFreightUsd,
    surcharges,
    totalUsd: computeTotal(baseFreightUsd, surcharges),
    transitDays,
    validFrom: isoDate(monday),
    validTo: isoDate(validTo),
    currency: 'USD',
    source: 'demo',
  };
}
