import { TransientCarrierError } from '../carriers/carrier.adapter.js';

export class TimeoutError extends TransientCarrierError {
  constructor(ms: number) {
    super(`Tiempo de espera agotado (${ms} ms)`);
    this.name = 'TimeoutError';
  }
}

/** Rechaza con TimeoutError si la promesa no resuelve dentro de `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface RetryOptions {
  retries: number; // reintentos adicionales al primer intento
  baseDelayMs: number; // backoff exponencial: base * 2^intento
}

/** Reintenta solo ante errores transitorios (5xx, timeout, 429). */
export async function withRetry<T>(fn: () => Promise<T>, { retries, baseDelayMs }: RetryOptions): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof TransientCarrierError) || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
      attempt++;
    }
  }
}
