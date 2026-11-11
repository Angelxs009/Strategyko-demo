"use client";

import { useRef, type KeyboardEvent } from "react";

export type TabId = "pricing" | "schedules" | "tracking";

export const TABS: { id: TabId; label: string }[] = [
  { id: "pricing", label: "Tarifas" },
  { id: "schedules", label: "Próximas salidas" },
  { id: "tracking", label: "Seguimiento" },
];

export const tabId = (id: TabId) => `tab-${id}`;
export const panelId = (id: TabId) => `panel-${id}`;

/** Pestañas accesibles (patrón WAI-ARIA): flechas izquierda/derecha, Inicio y Fin. */
export function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const last = TABS.length - 1;
    const target =
      e.key === "ArrowRight" ? (index + 1) % TABS.length : e.key === "ArrowLeft" ? (index - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (target === null) return;
    e.preventDefault();
    const next = TABS[target].id;
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="tabbar">
      <div className="tabbar__inner" role="tablist" aria-label="Secciones">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={tabId(t.id)}
            aria-selected={active === t.id}
            aria-controls={panelId(t.id)}
            tabIndex={active === t.id ? 0 : -1}
            className="tab"
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
