import type {
  Carrier,
  CarrierError,
  CompareResponse,
  HistoryResponse,
  PushResponse,
  RateQuery,
  SchedulesResponse,
  TrackingResponse,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
export const REQUEST_TIMEOUT_MS = 8000;

export type ApiErrorKind = "timeout" | "network" | "http";

/** Error centralizado del cliente: siempre trae un mensaje listo para mostrar en español. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number,
    readonly carrierErrors: CarrierError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
      signal: controller.signal,
    });
    if (!res.ok) throw await toHttpError(res);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(`La consulta tardó más de ${timeoutMs / 1000} segundos.`, "timeout");
    }
    throw new ApiError("No se pudo conectar con el servicio de tarifas. Revisa tu conexión o que el backend esté activo.", "network");
  } finally {
    clearTimeout(timer);
  }
}

async function toHttpError(res: Response): Promise<ApiError> {
  let body: { message?: string | string[]; errors?: CarrierError[] } = {};
  try {
    body = await res.json();
  } catch {
    // Respuesta sin JSON: se usa el mensaje genérico.
  }
  const detail = Array.isArray(body.message) ? body.message.join(" ") : body.message;
  const fallback: Record<number, string> = {
    400: "Los datos de la consulta no son válidos.",
    401: "El servicio exige una clave de acceso (x-api-key).",
    429: "Demasiadas consultas seguidas. Espera un momento e inténtalo de nuevo.",
    502: "Las navieras no devolvieron suficientes tarifas para comparar.",
  };
  return new ApiError(detail ?? fallback[res.status] ?? `El servicio respondió con error ${res.status}.`, "http", res.status, body.errors ?? []);
}

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  return qs.toString();
};

export const fetchCompare = (q: RateQuery) => request<CompareResponse>(`/api/compare?${toQueryString({ ...q })}`);

export const pushToStrategyko = (q: RateQuery) =>
  request<PushResponse>("/api/push", { method: "POST", body: JSON.stringify(q) });

export const fetchSchedules = (q: { origin: string; destination: string }, weeks: number) =>
  request<SchedulesResponse>(`/api/schedules?${toQueryString({ ...q, weeks })}`);

export const fetchTracking = (reference: string, carrier: Carrier) =>
  request<TrackingResponse>(`/api/tracking/${encodeURIComponent(reference.trim())}?${toQueryString({ carrier })}`);

export const fetchHistory = (page: number, pageSize = 10) =>
  request<HistoryResponse>(`/api/rates/history?${toQueryString({ page, pageSize })}`);
