import type { Carrier, ContainerType } from "./types";

export const CARRIER_LABELS: Record<Carrier, string> = {
  MAERSK: "Maersk",
  CMA_CGM: "CMA CGM",
  HAPAG_LLOYD: "Hapag-Lloyd",
  MSC: "MSC",
};

export const CONTAINER_OPTIONS: { value: ContainerType; label: string }[] = [
  { value: "20GP", label: "20' estándar (20GP)" },
  { value: "40GP", label: "40' estándar (40GP)" },
  { value: "40HC", label: "40' High Cube (40HC)" },
];

export const COMMON_ORIGINS: { value: string; label: string }[] = [
  { value: "CNSHA", label: "Shanghái (CNSHA)" },
  { value: "CNNGB", label: "Ningbo (CNNGB)" },
  { value: "CNSZX", label: "Shenzhen (CNSZX)" },
  { value: "CNTAO", label: "Qingdao (CNTAO)" },
];

export const OTHER_ORIGIN = "__other__";

const usd = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const pct = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const formatUsd = (n: number) => usd.format(n);
export const formatPct = (n: number) => `${pct.format(n)} %`;
export const formatDays = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** "2026-11-09" → "09/11/2026" (sin pasar por Date para evitar desfases de zona horaria). */
export const formatDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });

export const UNLOCODE = /^[A-Z]{2}[A-Z0-9]{3}$/;
