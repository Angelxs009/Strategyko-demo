// Tipos comunes del módulo de tarifas de navieras.

export const CARRIERS = ['MAERSK', 'CMA_CGM', 'HAPAG_LLOYD', 'MSC'] as const;
export type Carrier = (typeof CARRIERS)[number];

export const CONTAINERS = ['20GP', '40GP', '40HC'] as const;
export type ContainerType = (typeof CONTAINERS)[number];

export type DataSource = 'demo' | 'live';
export type DataMode = 'demo' | 'live' | 'mixed';

export interface Surcharge {
  code: string;
  name: string;
  amountUsd: number;
}

export interface RateQuery {
  origin: string; // UN/LOCODE, ej. CNSHA
  destination: string; // UN/LOCODE, ej. ECGYE
  container: ContainerType;
}

export interface RateQuote {
  carrier: Carrier;
  origin: string;
  destination: string;
  container: ContainerType;
  baseFreightUsd: number;
  surcharges: Surcharge[];
  totalUsd: number; // = baseFreightUsd + suma de recargos
  transitDays: number;
  validFrom: string; // fecha ISO (YYYY-MM-DD)
  validTo: string; // fecha ISO (YYYY-MM-DD)
  currency: 'USD';
  source: DataSource; // obligatorio en todo dato
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Calcula el total a partir de flete base y recargos (única fuente de verdad). */
export function computeTotal(baseFreightUsd: number, surcharges: Surcharge[]): number {
  return round2(surcharges.reduce((acc, s) => acc + s.amountUsd, baseFreightUsd));
}

/** Resumen de modo según el origen de los datos. */
export function resolveMode(sources: DataSource[]): DataMode {
  if (sources.length === 0) return 'demo';
  const hasDemo = sources.includes('demo');
  const hasLive = sources.includes('live');
  if (hasDemo && hasLive) return 'mixed';
  return hasLive ? 'live' : 'demo';
}
