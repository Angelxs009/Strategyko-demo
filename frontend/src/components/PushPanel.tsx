"use client";

import { useState } from "react";
import { ApiError, pushToStrategyko } from "@/lib/api";
import type { PushResponse, RateQuery } from "@/lib/types";
import { CheckIcon, InfoIcon, AlertIcon, SendIcon } from "./Icons";

type PushState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "done"; result: PushResponse }
  | { status: "error"; message: string };

export function PushPanel({ query }: { query: RateQuery }) {
  const [state, setState] = useState<PushState>({ status: "idle" });

  const send = async () => {
    setState({ status: "sending" });
    try {
      setState({ status: "done", result: await pushToStrategyko(query) });
    } catch (err) {
      setState({ status: "error", message: err instanceof ApiError ? err.message : "No se pudo enviar a Strategyko." });
    }
  };

  const sending = state.status === "sending";

  return (
    <section className="card" aria-labelledby="push-title">
      <div className="push-row">
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 className="card__title" id="push-title">
            Enviar a Strategyko
          </h2>
          <p className="card__sub">Envía las tarifas y la comparación para el análisis en Synapse.</p>
        </div>
        <button type="button" className="btn btn--secondary" onClick={send} disabled={sending}>
          {sending ? <span className="spinner" aria-hidden="true" /> : <SendIcon />}
          {sending ? "Enviando…" : "Enviar a Strategyko"}
        </button>
      </div>

      <div aria-live="polite">
        {state.status === "done" && (
          <div className={`banner ${state.result.delivered ? "banner--ok" : "banner--info"}`}>
            {state.result.delivered ? <CheckIcon size={20} /> : <InfoIcon size={20} />}
            <div className="stack" style={{ gap: 8 }}>
              <div>
                <p className="banner__title">{state.result.delivered ? "Entregado a Strategyko" : "Simulación de envío (dry-run)"}</p>
                <p>
                  {state.result.delivered
                    ? `Strategyko respondió ${state.result.status}.`
                    : "No se envió nada: aún no hay una URL de Strategyko configurada. Este es el contenido que se enviaría."}
                </p>
              </div>
              <details className="details">
                <summary>Ver contenido enviado ({state.result.payload.quotes.length} tarifas)</summary>
                <pre>{JSON.stringify(state.result.payload, null, 2)}</pre>
              </details>
            </div>
          </div>
        )}
        {state.status === "error" && (
          <div className="banner banner--error" role="alert">
            <AlertIcon size={20} />
            <div>
              <p className="banner__title">No se pudo enviar</p>
              <p>{state.message}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
