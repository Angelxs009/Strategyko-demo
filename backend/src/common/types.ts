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

// ---- Próximas salidas ----

export interface ScheduleQuery {
  origin: string;
  destination: string;
  weeks: number; // semanas hacia adelante (1 a 8)
}

export interface Departure {
  carrier: Carrier;
  origin: string;
  destination: string;
  vessel: string;
  voyage: string;
  service: string;
  etd: string; // salida estimada, YYYY-MM-DD
  eta: string; // llegada estimada, YYYY-MM-DD
  transitDays: number;
  source: DataSource;
}

// ---- Seguimiento ----

export type TrackingStatus = 'PENDING' | 'IN_TRANSIT' | 'ARRIVED';
export type ReferenceType = 'container' | 'bl';

export interface TrackingEvent {
  code: string; // GATE_IN, LOADED, DEPARTED, ARRIVED, DISCHARGED, GATE_OUT
  description: string;
  location: string; // UN/LOCODE
  locationName: string;
  date: string; // YYYY-MM-DD
  completed: boolean; // true = ya ocurrió; false = previsto
}

export interface TrackingResult {
  carrier: Carrier;
  reference: string;
  referenceType: ReferenceType;
  status: TrackingStatus;
  vessel: string;
  voyage: string;
  origin: string;
  destination: string;
  eta: string;
  events: TrackingEvent[];
  source: DataSource;
}

export interface CarrierError {
  carrier: Carrier;
  message: string;
}
