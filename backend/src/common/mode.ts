import type { DataMode } from './types.js';

/** Aviso estándar cuando algún dato es simulado; null si todo es live. `subject` ya incluye el adjetivo concordado (ej. "Salidas simuladas"). */
export function demoWarning(mode: DataMode, subject: string): string | null {
  if (mode === 'live') return null;
  return `${subject} (modo demo): no son datos reales. No los uses para operar.`;
}
