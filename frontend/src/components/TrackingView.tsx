"use client";

import { useId, useState, type FormEvent } from "react";
import { fetchTracking } from "@/lib/api";
import { CARRIER_LABELS, STATUS_LABELS, TRACKING_CARRIERS, formatDate, formatDateWithDay } from "@/lib/format";
import type { Carrier, TrackingResponse, TrackingStatus } from "@/lib/types";
import { useRequest } from "@/lib/useRequest";
import { DemoBanner } from "./DemoBanner";
import { SearchIcon } from "./Icons";
import { EmptyState, ErrorState, ResultsSkeleton } from "./StateViews";

const STATUS_BADGE: Record<TrackingStatus, string> = {
  PENDING: "badge badge--demo",
  IN_TRANSIT: "badge badge--best",
  ARRIVED: "badge badge--live",
};

export function TrackingView() {
  const uid = useId();
  const [reference, setReference] = useState("");
  const [carrier, setCarrier] = useState<Carrier>("MAERSK");
  const [emptyError, setEmptyError] = useState(false);
  const { state, run, retry } = useRequest(fetchTracking);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (reference.trim() === "") {
      setEmptyError(true);
      return;
    }
    setEmptyError(false);
    void run(reference, carrier);
  };

  // Un 400 es un problema de la referencia: se muestra junto al campo, no como falla del servicio.
  const referenceError =
    emptyError ? "Ingresa un número de contenedor o un BL." : state.status === "error" && state.httpStatus === 400 ? state.message : null;
  const loading = state.status === "loading";

  return (
    <>
      <div className="page-title">
        <h1>Seguimiento de carga</h1>
        <p>Consulta el estado de un contenedor o de un BL, con su línea de tiempo de eventos y la llegada estimada.</p>
      </div>

      <form className="card" onSubmit={handleSubmit} noValidate aria-label="Consulta de seguimiento">
        <div className="form-grid form-grid--tracking">
          <div className="field">
            <label htmlFor={`${uid}-ref`}>Número de contenedor o BL</label>
            <input
              id={`${uid}-ref`}
              className="input"
              placeholder="Ej. CSQU3054383"
              value={reference}
              maxLength={30}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setReference(e.target.value)}
              aria-invalid={Boolean(referenceError)}
              aria-describedby={referenceError ? `${uid}-ref-err` : `${uid}-ref-hint`}
            />
            {referenceError ? (
              <p className="field__error" id={`${uid}-ref-err`}>
                {referenceError}
              </p>
            ) : (
              <p className="field__hint" id={`${uid}-ref-hint`}>
                Contenedor: 4 letras y 7 dígitos (se valida el dígito verificador). BL: 6 a 20 letras o números.
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor={`${uid}-carrier`}>Naviera</label>
            <select id={`${uid}-carrier`} className="select" value={carrier} onChange={(e) => setCarrier(e.target.value as Carrier)}>
              {TRACKING_CARRIERS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? <span className="spinner" aria-hidden="true" /> : <SearchIcon />}
              {loading ? "Consultando…" : "Rastrear"}
            </button>
          </div>
        </div>
      </form>

      {state.status === "idle" && (
        <div className="card">
          <EmptyState
            title="Aún no hay un seguimiento"
            message="Ingresa un número de contenedor o un BL, elige la naviera y pulsa «Rastrear»."
          />
        </div>
      )}
      {loading && <ResultsSkeleton />}
      {state.status === "error" && state.httpStatus !== 400 && (
        <div className="card">
          <ErrorState
            title="No se pudo obtener el seguimiento"
            message={state.message}
            carrierErrors={state.carrierErrors}
            onRetry={retry}
          />
        </div>
      )}
      {state.status === "ok" && <TrackingResults data={state.data} />}
    </>
  );
}

function TrackingResults({ data }: { data: TrackingResponse }) {
  const t = data.tracking;
  const done = t.events.filter((e) => e.completed).length;
  const originName = t.events[0]?.locationName ?? t.origin;
  const destName = t.events[t.events.length - 1]?.locationName ?? t.destination;

  return (
    <>
      <DemoBanner mode={data.mode} warning={data.warning} />

      <section aria-label="Resumen del seguimiento" className="stat-grid">
        <article className="stat">
          <h3 className="stat__label">Estado</h3>
          <p className="stat__value">
            <span className={STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</span>
          </p>
          <p className="stat__detail">
            {CARRIER_LABELS[t.carrier]} · {t.referenceType === "container" ? "Contenedor" : "BL"} {t.reference}
          </p>
          <p className="stat__n">
            Base: {done} de {t.events.length} eventos realizados
          </p>
        </article>
        <article className="stat">
          <h3 className="stat__label">Llegada estimada (ETA)</h3>
          <p className="stat__value">{formatDateWithDay(t.eta)}</p>
          <p className="stat__detail">En {destName}</p>
        </article>
        <article className="stat">
          <h3 className="stat__label">Ruta</h3>
          <p className="stat__value">
            {t.origin} → {t.destination}
          </p>
          <p className="stat__detail">
            {originName} a {destName}
          </p>
        </article>
        <article className="stat">
          <h3 className="stat__label">Buque</h3>
          <p className="stat__value truncate-block" title={t.vessel}>
            {t.vessel}
          </p>
          <p className="stat__detail">Viaje {t.voyage}</p>
        </article>
      </section>

      <section className="card" aria-labelledby="timeline-title">
        <div>
          <h2 className="card__title" id="timeline-title">
            Línea de tiempo
          </h2>
          <p className="card__sub">Del primer evento al último. «Previsto» significa que todavía no ocurre.</p>
        </div>
        <ol className="timeline">
          {t.events.map((e) => (
            <li key={e.code} className={`timeline__item ${e.completed ? "is-done" : "is-pending"}`}>
              <span className="timeline__dot" aria-hidden="true" />
              <div className="timeline__body">
                <p className="timeline__title">{e.description}</p>
                <p className="timeline__meta">
                  {e.locationName} ({e.location}) · {formatDate(e.date)}
                </p>
              </div>
              <span className={e.completed ? "badge badge--live" : "badge badge--neutral"}>{e.completed ? "Realizado" : "Previsto"}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
