"use client";

import { useId, useState, type FormEvent } from "react";
import { COMMON_ORIGINS, CONTAINER_OPTIONS, OTHER_ORIGIN, UNLOCODE, WEEK_OPTIONS } from "@/lib/format";
import type { ContainerType } from "@/lib/types";
import { SearchIcon } from "./Icons";

export interface RouteFormValues {
  origin: string;
  destination: string;
  container: ContainerType;
  weeks: number;
}

type Variant = "pricing" | "schedules";

const SUBMIT_LABELS: Record<Variant, { idle: string; busy: string }> = {
  pricing: { idle: "Consultar y comparar", busy: "Consultando…" },
  schedules: { idle: "Buscar salidas", busy: "Buscando…" },
};

/**
 * Formulario de ruta compartido. En "pricing" pide el contenedor; en "schedules" pide
 * cuántas semanas hacia adelante mostrar.
 */
export function QueryForm({
  onSubmit,
  loading,
  variant = "pricing",
}: {
  onSubmit: (v: RouteFormValues) => void;
  loading: boolean;
  variant?: Variant;
}) {
  const uid = useId();
  const [originChoice, setOriginChoice] = useState("CNSHA");
  const [customOrigin, setCustomOrigin] = useState("");
  const [destination, setDestination] = useState("ECGYE");
  const [container, setContainer] = useState<ContainerType>("40HC");
  const [weeks, setWeeks] = useState(4);
  const [errors, setErrors] = useState<{ origin?: string; destination?: string }>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const origin = (originChoice === OTHER_ORIGIN ? customOrigin : originChoice).trim().toUpperCase();
    const dest = destination.trim().toUpperCase();
    const next: typeof errors = {};
    if (!UNLOCODE.test(origin) || !origin.startsWith("CN")) {
      next.origin = "Ingresa un puerto de China en formato UN/LOCODE, por ejemplo CNSHA.";
    }
    if (!UNLOCODE.test(dest)) next.destination = "Ingresa un destino en formato UN/LOCODE, por ejemplo ECGYE.";
    setErrors(next);
    if (Object.keys(next).length === 0) onSubmit({ origin, destination: dest, container, weeks });
  };

  const label = SUBMIT_LABELS[variant];

  return (
    <form className="card" onSubmit={handleSubmit} noValidate aria-label={variant === "pricing" ? "Consulta de tarifas" : "Búsqueda de salidas"}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${uid}-origin`}>Puerto de origen (China)</label>
          <select
            id={`${uid}-origin`}
            className="select"
            value={originChoice}
            onChange={(e) => setOriginChoice(e.target.value)}
          >
            {COMMON_ORIGINS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value={OTHER_ORIGIN}>Otro puerto (UN/LOCODE)…</option>
          </select>
          {originChoice === OTHER_ORIGIN && (
            <>
              <label htmlFor={`${uid}-custom`} className="sr-only">
                Código UN/LOCODE del puerto de origen
              </label>
              <input
                id={`${uid}-custom`}
                className="input"
                placeholder="Ej. CNXMN"
                maxLength={5}
                value={customOrigin}
                onChange={(e) => setCustomOrigin(e.target.value)}
                aria-invalid={Boolean(errors.origin)}
                aria-describedby={errors.origin ? `${uid}-origin-err` : undefined}
              />
            </>
          )}
          {errors.origin && (
            <p className="field__error" id={`${uid}-origin-err`}>
              {errors.origin}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor={`${uid}-dest`}>Destino (UN/LOCODE)</label>
          <input
            id={`${uid}-dest`}
            className="input"
            maxLength={5}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            aria-invalid={Boolean(errors.destination)}
            aria-describedby={errors.destination ? `${uid}-dest-err` : `${uid}-dest-hint`}
          />
          {errors.destination ? (
            <p className="field__error" id={`${uid}-dest-err`}>
              {errors.destination}
            </p>
          ) : (
            <p className="field__hint" id={`${uid}-dest-hint`}>
              ECGYE = Guayaquil
            </p>
          )}
        </div>

        {variant === "pricing" ? (
          <div className="field">
            <label htmlFor={`${uid}-cont`}>Contenedor</label>
            <select
              id={`${uid}-cont`}
              className="select"
              value={container}
              onChange={(e) => setContainer(e.target.value as ContainerType)}
            >
              {CONTAINER_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="field">
            <label htmlFor={`${uid}-weeks`}>Semanas a mostrar</label>
            <select id={`${uid}-weeks`} className="select" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              {WEEK_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  Próximas {w} semanas
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? <span className="spinner" aria-hidden="true" /> : <SearchIcon />}
            {loading ? label.busy : label.idle}
          </button>
        </div>
      </div>
    </form>
  );
}
