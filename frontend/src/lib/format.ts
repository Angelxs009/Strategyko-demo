import type { Carrier, ContainerType, TrackingStatus } from "./types";

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

export const WEEK_OPTIONS = [2, 4, 6, 8];

export const TRACKING_CARRIERS: { value: Carrier; label: string }[] = [
  { value: "MAERSK", label: "Maersk" },
  { value: "CMA_CGM", label: "CMA CGM" },
  { value: "HAPAG_LLOYD", label: "Hapag-Lloyd" },
];

export const STATUS_LABELS: Record<TrackingStatus, string> = {
  PENDING: "Pendiente de zarpe",
  IN_TRANSIT: "En tránsito",
  ARRIVED: "Llegó al destino",
};

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

/** "2026-11-12" → "jue 12/11/2026" (en UTC para evitar desfases de zona horaria). */
export const formatDateWithDay = (iso: string) => {
  const day = new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("es-EC", { weekday: "short", timeZone: "UTC" });
  return `${day.replace(".", "")} ${formatDate(iso)}`;
};

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });

export const UNLOCODE = /^[A-Z]{2}[A-Z0-9]{3}$/;
