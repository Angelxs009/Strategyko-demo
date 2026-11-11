"use client";

import { useCallback, useState } from "react";
import { fetchCompare } from "@/lib/api";
import { useRequest } from "@/lib/useRequest";
import { CarrierErrorsBanner } from "./CarrierErrorsBanner";
import { DemoBanner } from "./DemoBanner";
import { HistoryTable } from "./HistoryTable";
import { PushPanel } from "./PushPanel";
import { QueryForm } from "./QueryForm";
import { BreakdownTable, InsightsPanel, RankingTable, SummaryCards } from "./Results";
import { SchedulesView } from "./SchedulesView";
import { EmptyState, ErrorState, ResultsSkeleton } from "./StateViews";
import { TabBar, TABS, panelId, tabId, type TabId } from "./TabBar";
import { TrackingView } from "./TrackingView";

/** Página principal: cabecera, pestañas y las tres secciones (tarifas, salidas y seguimiento). */
export function RatesDashboard() {
  const [tab, setTab] = useState<TabId>("pricing");

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

      <TabBar active={tab} onChange={setTab} />

      <main className="page" id="contenido">
        {/* Los paneles siguen montados al cambiar de pestaña para conservar sus resultados. */}
        {TABS.map((t) => (
          <div key={t.id} role="tabpanel" id={panelId(t.id)} aria-labelledby={tabId(t.id)} hidden={tab !== t.id} className="panel">
            {t.id === "pricing" && <PricingView />}
            {t.id === "schedules" && <SchedulesView />}
            {t.id === "tracking" && <TrackingView />}
          </div>
        ))}
      </main>
    </>
  );
}

function PricingView() {
  const [historyKey, setHistoryKey] = useState(0);
  const refreshHistory = useCallback(() => setHistoryKey((k) => k + 1), []);
  const { state, run, retry } = useRequest(fetchCompare, refreshHistory);

  return (
    <>
      <div className="page-title">
        <h1>Comparativo de tarifas</h1>
        <p>Consulta tarifas de navieras desde China y compáralas por costo, tránsito y componentes.</p>
      </div>

      <QueryForm
        loading={state.status === "loading"}
        onSubmit={(v) => run({ origin: v.origin, destination: v.destination, container: v.container })}
      />

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
          <CarrierErrorsBanner errors={state.data.errors} />
          <SummaryCards c={state.data.comparison} />
          <RankingTable c={state.data.comparison} />
          <BreakdownTable c={state.data.comparison} />
          <InsightsPanel insights={state.data.comparison.insights} />
          <PushPanel query={state.data.query} />
        </>
      )}

      <HistoryTable refreshKey={historyKey} />
    </>
  );
}
