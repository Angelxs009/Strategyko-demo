"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError } from "./api";
import type { CarrierError } from "./types";

export type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; message: string; httpStatus?: number; carrierErrors: CarrierError[] };

/**
 * Máquina de estados de una petición (inactivo, cargando, éxito, error) con:
 * - descarte de respuestas viejas si el usuario lanza otra consulta antes
 * - `retry()` que repite la última consulta (botón "Reintentar")
 */
export function useRequest<A extends unknown[], T>(fn: (...args: A) => Promise<T>, onSuccess?: (data: T) => void) {
  const [state, setState] = useState<RequestState<T>>({ status: "idle" });
  const lastArgs = useRef<A | null>(null);
  const requestId = useRef(0);

  const run = useCallback(
    async (...args: A) => {
      lastArgs.current = args;
      const id = ++requestId.current;
      setState({ status: "loading" });
      try {
        const data = await fn(...args);
        if (id !== requestId.current) return;
        setState({ status: "ok", data });
        onSuccess?.(data);
      } catch (err) {
        if (id !== requestId.current) return;
        const e = err instanceof ApiError ? err : null;
        setState({
          status: "error",
          message: e?.message ?? "Ocurrió un error inesperado.",
          httpStatus: e?.status,
          carrierErrors: e?.carrierErrors ?? [],
        });
      }
    },
    [fn, onSuccess],
  );

  const retry = useCallback(() => {
    if (lastArgs.current) void run(...lastArgs.current);
  }, [run]);

  return { state, run, retry };
}
