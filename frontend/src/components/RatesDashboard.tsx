"use client";

import { useRef, useState } from "react";
import { ApiError, fetchCompare } from "@/lib/api";
import type { CarrierError, CompareResponse, RateQuery } from "@/lib/types";
import { CARRIER_LABELS } from "@/lib/format";
import { DemoBanner } from "./DemoBanner";
import { AlertIcon } from "./Icons";
import { HistoryTable } from "./HistoryTable";
import { PushPanel } from "./PushPanel";
import { QueryForm } from "./QueryForm";
import { BreakdownTable, InsightsPanel, RankingTable, SummaryCards } from "./Results";
import { EmptyState, ErrorState, ResultsSkeleton } from "./StateViews";

type CompareState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: CompareResponse }
  | { status: "error"; message: string; carrierErrors: CarrierError[] };

export function RatesDashboard() {
  const [state, setState] = useState<CompareState>({ status: "idle" });
  const [historyKey, setHistoryKey] = useState(0);
  const lastQuery = useRef<RateQuery | null>(null);
  const requestId = useRef(0);

  const run = async (query: RateQuery) => {
    lastQuery.current = query;
    const id = ++requestId.current;
    setState({ status: "loading" });
    try {
      const data = await fetchCompare(query);
      if (id !== requestId.current) return; // llegó una consulta más nueva
      setState({ status: "ok", data });
      setHistoryKey((k) => k + 1);
    } catch (err) {
      if (id !== requestId.current) return;
      const e = err instanceof ApiError ? err : null;
      setState({
        status: "error",
        message: e?.message ?? "Ocurrió un error inesperado.",
        carrierErrors: e?.carrierErrors ?? [],
      });
    }
  };

  const retry = () => {
    if (lastQuery.current) void run(lastQuery.current);
  };

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <div className="brand">
            <div className="brand__mark" aria-hidden="true">
              S
            </div>
            <div>
              <p className="brand__name">Strategyko</p>
              <p className="brand__module">Synapse · Precios y reglas</p>
            </div>
          </div>
          <p className="header-tag">Cargo Allianz</p>
        </div>
      </header>

      <main className="page" id="contenido">
        <div className="page-title">
          <h1>Comparativo de tarifas</h1>
          <p>Consulta tarifas de navieras desde China y compáralas por costo, tránsito y componentes.</p>
        </div>

        <QueryForm onSubmit={run} loading={state.status === "loading"} />

        {state.status === "idle" && (
          <div className="card">
            <EmptyState
              title="Aún no hay una comparación"
              message="Elige el puerto de origen, el destino y el contenedor, y pulsa «Consultar y comparar»."
            />
          </div>
        )}

        {state.status === "loading" && <ResultsSkeleton />}

        {state.status === "error" && (
          <div className="card">
            <ErrorState message={state.message} carrierErrors={state.carrierErrors} onRetry={retry} />
          </div>
        )}

        {state.status === "ok" && (
          <>
            <DemoBanner mode={state.data.comparison.mode} warning={state.data.comparison.warning} />
            {state.data.errors.length > 0 && (
              <div className="banner banner--warn" role="status">
                <AlertIcon size={20} />
                <div>
                  <p className="banner__title">Algunas navieras no respondieron</p>
                  <ul>
                    {state.data.errors.map((e) => (
                      <li key={e.carrier}>
                        {CARRIER_LABELS[e.carrier]}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <SummaryCards c={state.data.comparison} />
            <RankingTable c={state.data.comparison} />
            <BreakdownTable c={state.data.comparison} />
            <InsightsPanel insights={state.data.comparison.insights} />
            <PushPanel query={state.data.query} />
          </>
        )}

        <HistoryTable refreshKey={historyKey} />
      </main>
    </>
  );
}
