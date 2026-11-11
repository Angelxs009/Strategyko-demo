import type { DataMode } from './types.js';

/** Aviso estándar cuando algún dato es simulado; null si todo es live. */
export function demoWarning(mode: DataMode, subject: string): string | null {
  if (mode === 'live') return null;
  return `${subject} simulados (modo demo): no son datos reales. No los uses para operar.`;
}
