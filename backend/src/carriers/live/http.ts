import {
  CarrierAuthError,
  CarrierRequestError,
  CarrierResponseError,
  TransientCarrierError,
} from '../carrier.adapter.js';

export const DEFAULT_HTTP_TIMEOUT_MS = 8000;

/**
 * Hace una petición JSON a una naviera y clasifica los errores:
 * - red caída, timeout, 429 y 5xx → TransientCarrierError (se reintenta)
 * - 401/403 → CarrierAuthError (no se reintenta)
 * - otros 4xx → CarrierRequestError
 * - cuerpo que no es JSON → CarrierResponseError
 */
export async function carrierRequestJson(
  carrier: string,
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new TransientCarrierError(
      timedOut ? `${carrier}: tiempo de espera agotado (${timeoutMs} ms)` : `${carrier}: error de red (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  if (res.status === 429 || res.status >= 500) {
    throw new TransientCarrierError(`${carrier}: respondió ${res.status} (error transitorio)`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new CarrierAuthError(`${carrier}: credenciales rechazadas (${res.status}). Revisa las variables de entorno.`);
  }
  if (!res.ok) {
    throw new CarrierRequestError(`${carrier}: la solicitud fue rechazada (${res.status}).`, res.status);
  }
  try {
    return await res.json();
  } catch {
    throw new CarrierResponseError(`${carrier}: la respuesta no es JSON válido.`);
  }
}
