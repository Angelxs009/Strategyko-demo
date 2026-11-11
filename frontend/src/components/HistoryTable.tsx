"use client";

import { useEffect, useState } from "react";
import { ApiError, fetchHistory } from "@/lib/api";
import { CARRIER_LABELS, formatDate, formatDateTime, formatDays, formatUsd } from "@/lib/format";
import type { HistoryResponse } from "@/lib/types";
import { SourceBadge } from "./DemoBanner";
import { EmptyState, ErrorState, TableSkeleton } from "./StateViews";

const PAGE_SIZE = 10;

type HistoryResult =
  | { key: string; status: "ok"; data: HistoryResponse }
  | { key: string; status: "error"; message: string };

/** `refreshKey` cambia cuando hay una consulta nueva, para volver a la primera página y recargar. */
export function HistoryTable({ refreshKey }: { refreshKey: number }) {
  const [pageState, setPageState] = useState({ page: 1, forKey: refreshKey });
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<HistoryResult | null>(null);

  const page = pageState.forKey === refreshKey ? pageState.page : 1;
  const setPage = (update: (p: number) => number) => setPageState({ page: update(page), forKey: refreshKey });

  // El estado de carga se deriva: el resultado guardado debe corresponder a la petición actual.
  const requestKey = `${page}:${refreshKey}:${attempt}`;
  const state: { status: "loading" } | HistoryResult = result?.key === requestKey ? result : { status: "loading" };

  useEffect(() => {
    let cancelled = false;
    fetchHistory(page, PAGE_SIZE)
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, status: "ok", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof ApiError ? err.message : "No se pudo cargar el historial.";
          setResult({ key: requestKey, status: "error", message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, requestKey]);

  const totalPages = state.status === "ok" ? Math.max(1, Math.ceil(state.data.total / state.data.pageSize)) : 1;

  return (
    <section className="card" aria-labelledby="history-title">
      <div>
        <h2 className="card__title" id="history-title">
          Historial de consultas
        </h2>
        <p className="card__sub">Tarifas guardadas, de la más reciente a la más antigua.</p>
      </div>

      {state.status === "loading" && <TableSkeleton />}
      {state.status === "error" && (
        <ErrorState title="No se pudo cargar el historial" message={state.message} onRetry={() => setAttempt((a) => a + 1)} />
      )}
      {state.status === "ok" && state.data.items.length === 0 && (
        <EmptyState title="Aún no hay consultas guardadas" message="Cuando consultes tarifas, quedarán registradas aquí con su vigencia." />
      )}
      {state.status === "ok" && state.data.items.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="table">
              <caption className="sr-only">Historial de tarifas consultadas</caption>
              <thead>
                <tr>
                  <th scope="col">Consultada</th>
                  <th scope="col">Naviera</th>
                  <th scope="col">Ruta</th>
                  <th scope="col">Contenedor</th>
                  <th scope="col" className="num">
                    Total
                  </th>
                  <th scope="col" className="num">
                    Tránsito
                  </th>
                  <th scope="col">Vigencia</th>
                  <th scope="col">Dato</th>
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((i) => (
                  <tr key={i.id}>
                    <td>{formatDateTime(i.fetchedAt)}</td>
                    <th scope="row">{CARRIER_LABELS[i.carrier]}</th>
                    <td>
                      <span className="truncate" title={`${i.origin} → ${i.destination}`}>
                        {i.origin} → {i.destination}
                      </span>
                    </td>
                    <td>{i.container}</td>
                    <td className="num">{formatUsd(i.totalUsd)}</td>
                    <td className="num">{formatDays(i.transitDays)}</td>
                    <td>
                      {formatDate(i.validFrom)} – {formatDate(i.validTo)}
                    </td>
                    <td>
                      <SourceBadge source={i.source} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pager" aria-label="Paginación del historial">
            <p className="pager__info">
              Página {state.data.page} de {totalPages} · {state.data.total} registros
            </p>
            <div className="pager__buttons">
              <button type="button" className="btn btn--secondary btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </nav>
        </>
      )}
    </section>
  );
}
