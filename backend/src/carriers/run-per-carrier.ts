import { withRetry, withTimeout } from '../common/resilience.js';
import type { Carrier, CarrierError } from '../common/types.js';

export const CARRIER_TIMEOUT_MS = 8000;
export const CARRIER_RETRIES = 2;
export const CARRIER_RETRY_BASE_MS = 300;

export interface RunOptions {
  timeoutMs: number;
  retries: number;
  baseDelayMs: number;
}

export const DEFAULT_RUN_OPTIONS: RunOptions = {
  timeoutMs: CARRIER_TIMEOUT_MS,
  retries: CARRIER_RETRIES,
  baseDelayMs: CARRIER_RETRY_BASE_MS,
};

/**
 * Ejecuta `fn` para cada adaptador en paralelo con timeout y reintentos (solo errores transitorios).
 * Si uno falla, los demás siguen y el fallo se informa por naviera.
 */
export async function runPerCarrier<A extends { carrier: Carrier }, T>(
  adapters: A[],
  fn: (adapter: A) => Promise<T>,
  opts: RunOptions = DEFAULT_RUN_OPTIONS,
): Promise<{ values: T[]; errors: CarrierError[] }> {
  const settled = await Promise.allSettled(
    adapters.map((a) =>
      withRetry(() => withTimeout(fn(a), opts.timeoutMs), { retries: opts.retries, baseDelayMs: opts.baseDelayMs }),
    ),
  );
  const values: T[] = [];
  const errors: CarrierError[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') values.push(r.value);
    else errors.push({ carrier: adapters[i].carrier, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
  });
  return { values, errors };
}
