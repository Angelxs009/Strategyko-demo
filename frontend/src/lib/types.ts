// Tipos del contrato del backend (strategyko-rates/backend).

export type Carrier = "MAERSK" | "CMA_CGM" | "HAPAG_LLOYD" | "MSC";
export type ContainerType = "20GP" | "40GP" | "40HC";
export type DataSource = "demo" | "live";
export type DataMode = "demo" | "live" | "mixed";

export interface RateQuery {
  origin: string;
  destination: string;
  container: ContainerType;
}

export interface Surcharge {
  code: string;
  name: string;
  amountUsd: number;
}

export interface RateQuote {
  carrier: Carrier;
  origin: string;
  destination: string;
  container: ContainerType;
  baseFreightUsd: number;
  surcharges: Surcharge[];
  totalUsd: number;
  transitDays: number;
  validFrom: string;
  validTo: string;
  currency: "USD";
  source: DataSource;
}

export interface CarrierError {
  carrier: Carrier;
  message: string;
}

export interface RankingEntry {
  rank: number;
  carrier: Carrier;
  totalUsd: number;
  deltaUsd: number;
  deltaPct: number;
  transitDays: number;
  usdPerTransitDay: number;
  balanceScore: number;
  validFrom: string;
  validTo: string;
  source: DataSource;
}

export interface BreakdownRow {
  code: string;
  name: string;
  byCarrier: Partial<Record<Carrier, number>>;
}

export interface Comparison {
  mode: DataMode;
  warning: string | null;
  n: number;
  cheapest: Carrier;
  fastest: Carrier;
  bestBalance: Carrier;
  ranking: RankingEntry[];
  spread: { usd: number; pct: number };
  averageUsd: number;
  breakdown: BreakdownRow[];
  insights: string[];
}

export interface CompareResponse {
  query: RateQuery;
  quotes: RateQuote[];
  errors: CarrierError[];
  comparison: Comparison;
}

export interface PushResponse {
  delivered: boolean;
  dryRun: boolean;
  status: number | null;
  message: string;
  payload: { schemaVersion: string; dataMode: DataMode; quotes: RateQuote[] };
}

export interface HistoryItem {
  id: string;
  carrier: Carrier;
  origin: string;
  destination: string;
  container: ContainerType;
  baseFreightUsd: number;
  totalUsd: number;
  transitDays: number;
  validFrom: string;
  validTo: string;
  source: DataSource;
  fetchedAt: string;
  surcharges: Surcharge[];
}

export interface HistoryResponse {
  page: number;
  pageSize: number;
  total: number;
  items: HistoryItem[];
}
