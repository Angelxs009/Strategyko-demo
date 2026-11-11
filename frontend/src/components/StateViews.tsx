import type { CarrierError } from "@/lib/types";
import { CARRIER_LABELS } from "@/lib/format";
import { AlertIcon, InboxIcon } from "./Icons";

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="state">
      <div className="state__icon">
        <InboxIcon size={24} />
      </div>
      <h3 className="state__title">{title}</h3>
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({
  title = "No se pudo completar la consulta",
  message,
  carrierErrors = [],
  onRetry,
}: {
  title?: string;
  message: string;
  carrierErrors?: CarrierError[];
  onRetry: () => void;
}) {
  return (
    <div className="state state--error" role="alert">
      <div className="state__icon">
        <AlertIcon size={24} />
      </div>
      <h3 className="state__title">{title}</h3>
      <p>{message}</p>
      {carrierErrors.length > 0 && (
        <ul aria-label="Detalle por naviera">
          {carrierErrors.map((e) => (
            <li key={e.carrier}>
              {CARRIER_LABELS[e.carrier]}: {e.message}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn--secondary" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

/** Esqueleto con la forma real de la vista de resultados. */
export function ResultsSkeleton() {
  return (
    <div className="stack" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Consultando tarifas de las navieras…</span>
      <div className="stat-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div className="stat" key={i}>
            <div className="skeleton" style={{ height: 12, width: "50%" }} />
            <div className="skeleton" style={{ height: 32, width: "70%" }} />
            <div className="skeleton" style={{ height: 16, width: "60%" }} />
          </div>
        ))}
      </div>
      <div className="card" aria-hidden="true">
        <div className="skeleton" style={{ height: 20, width: 200 }} />
        {[0, 1, 2].map((i) => (
          <div className="skeleton" key={i} style={{ height: 40 }} />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack" role="status" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton" key={i} style={{ height: 32 }} aria-hidden="true" />
      ))}
    </div>
  );
}
