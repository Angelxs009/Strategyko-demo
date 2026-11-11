import type { DataMode } from "@/lib/types";
import { AlertIcon } from "./Icons";

/** Aviso visible cuando algún dato es simulado: los datos demo nunca pasan por reales. */
export function DemoBanner({ mode, warning }: { mode: DataMode; warning?: string | null }) {
  if (mode === "live") return null;
  return (
    <div className="banner banner--warn" role="status">
      <AlertIcon size={20} />
      <div>
        <p className="banner__title">{mode === "mixed" ? "Datos mixtos: parte son simulados" : "Modo demo"}</p>
        <p>{warning ?? "Las tarifas mostradas son simuladas e ilustrativas. No son tarifas reales de las navieras."}</p>
      </div>
    </div>
  );
}

export function SourceBadge({ source }: { source: "demo" | "live" }) {
  return source === "demo" ? (
    <span className="badge badge--demo" title="Dato simulado, no es una tarifa real">
      Demo
    </span>
  ) : (
    <span className="badge badge--live">En vivo</span>
  );
}
