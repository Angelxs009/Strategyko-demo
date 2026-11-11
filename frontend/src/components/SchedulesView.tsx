"use client";

import { fetchSchedules } from "@/lib/api";
import { CARRIER_LABELS, formatDateWithDay, formatDays } from "@/lib/format";
import type { SchedulesResponse } from "@/lib/types";
import { useRequest } from "@/lib/useRequest";
import { CarrierErrorsBanner } from "./CarrierErrorsBanner";
import { DemoBanner, SourceBadge } from "./DemoBanner";
import { QueryForm } from "./QueryForm";
import { EmptyState, ErrorState, ResultsSkeleton } from "./StateViews";

export function SchedulesView() {
  const { state, run, retry } = useRequest(fetchSchedules);

  return (
    <>
      <div className="page-title">
        <h1>Próximas salidas</h1>
        <p>Consulta las siguientes salidas de cada naviera para una ruta y compara cuándo zarpa y cuándo llega.</p>
      </div>

      <QueryForm
        variant="schedules"
        loading={state.status === "loading"}
        onSubmit={(v) => run({ origin: v.origin, destination: v.destination }, v.weeks)}
      />

      {state.status === "idle" && (
        <div className="card">
          <EmptyState
            title="Aún no hay una búsqueda"
            message="Elige el puerto de origen, el destino y cuántas semanas quieres ver, y pulsa «Buscar salidas»."
          />
        </div>
      )}
      {state.status === "loading" && <ResultsSkeleton />}
      {state.status === "error" && (
        <div className="card">
          <ErrorState message={state.message} carrierErrors={state.carrierErrors} onRetry={retry} />
        </div>
      )}
      {state.status === "ok" && <SchedulesResults data={state.data} />}
    </>
  );
}

function SchedulesResults({ data }: { data: SchedulesResponse }) {
  if (data.departures.length === 0) {
    return (
      <>
        <CarrierErrorsBanner errors={data.errors} />
        <div className="card">
          <EmptyState
            title="No hay salidas para mostrar"
            message="Ninguna naviera devolvió salidas para esta ruta. Prueba con otro puerto o vuelve a intentarlo más tarde."
          />
        </div>
      </>
    );
  }

  const next = data.departures[0];
  const fastest = data.departures.reduce((best, d) => (d.transitDays < best.transitDays ? d : best));
  const base = `Base: ${data.n} salidas`;

  return (
    <>
      <DemoBanner mode={data.mode} warning={data.warning} />
      <CarrierErrorsBanner errors={data.errors} />

      <section aria-label="Resumen de salidas" className="stat-grid stat-grid--3">
        <article className="stat">
          <h3 className="stat__label">Próxima salida</h3>
          <p className="stat__value">{formatDateWithDay(next.etd)}</p>
          <p className="stat__detail">
            {CARRIER_LABELS[next.carrier]} · {next.vessel}
          </p>
          <p className="stat__n">{base}</p>
        </article>
        <article className="stat">
          <h3 className="stat__label">Tránsito más corto</h3>
          <p className="stat__value">{formatDays(fastest.transitDays)}</p>
          <p className="stat__detail">
            {CARRIER_LABELS[fastest.carrier]} · sale {formatDateWithDay(fastest.etd)}
          </p>
          <p className="stat__n">{base}</p>
        </article>
        <article className="stat">
          <h3 className="stat__label">Salidas encontradas</h3>
          <p className="stat__value">{data.n}</p>
          <p className="stat__detail">
            En las próximas {data.query.weeks} semanas, de {new Set(data.departures.map((d) => d.carrier)).size} navieras
          </p>
          <p className="stat__n">{base}</p>
        </article>
      </section>

      <section className="card" aria-labelledby="departures-title">
        <div>
          <h2 className="card__title" id="departures-title">
            Calendario de salidas
          </h2>
          <p className="card__sub">De la más cercana a la más lejana. ETD = salida estimada, ETA = llegada estimada.</p>
        </div>
        <div className="table-scroll">
          <table className="table">
            <caption className="sr-only">Próximas salidas por naviera, con buque, fechas y tránsito</caption>
            <thead>
              <tr>
                <th scope="col">Salida (ETD)</th>
                <th scope="col">Naviera</th>
                <th scope="col">Buque / viaje</th>
                <th scope="col">Servicio</th>
                <th scope="col">Llegada (ETA)</th>
                <th scope="col" className="num">
                  Tránsito
                </th>
                <th scope="col">Origen del dato</th>
              </tr>
            </thead>
            <tbody>
              {data.departures.map((d, i) => (
                <tr key={`${d.carrier}-${d.etd}`}>
                  <th scope="row">
                    {formatDateWithDay(d.etd)} {i === 0 && <span className="badge badge--best">Próxima</span>}
                  </th>
                  <td>{CARRIER_LABELS[d.carrier]}</td>
                  <td>
                    <span className="truncate" title={`${d.vessel} · viaje ${d.voyage}`}>
                      {d.vessel} <span className="muted">· {d.voyage}</span>
                    </span>
                  </td>
                  <td>{d.service}</td>
                  <td>{formatDateWithDay(d.eta)}</td>
                  <td className="num">{formatDays(d.transitDays)}</td>
                  <td>
                    <SourceBadge source={d.source} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
