import type { ReferenceType } from './types.js';

// Valores de letras según ISO 6346: A=10, B=12... (se saltan los múltiplos de 11).
const LETTER_VALUES: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  let value = 10;
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (value % 11 === 0) value++;
    map[letter] = value++;
  }
  return map;
})();

/** Dígito verificador ISO 6346 a partir de las 10 primeras posiciones (4 letras + 6 dígitos). */
export function containerCheckDigit(first10: string): number {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = first10[i];
    const value = i < 4 ? LETTER_VALUES[ch] : Number(ch);
    sum += value * 2 ** i;
  }
  return (sum % 11) % 10;
}

export const CONTAINER_SHAPE = /^[A-Z]{4}\d{7}$/;
const BL_SHAPE = /^[A-Z0-9]{6,20}$/;

export function isValidContainerNumber(ref: string): boolean {
  return CONTAINER_SHAPE.test(ref) && containerCheckDigit(ref.slice(0, 10)) === Number(ref[10]);
}

export type ParsedReference = { ok: true; reference: string; type: ReferenceType } | { ok: false; message: string };

/**
 * Interpreta una referencia de seguimiento: número de contenedor (ISO 6346, con dígito
 * verificador) o BL (6 a 20 caracteres alfanuméricos).
 */
export function parseTrackingReference(raw: string): ParsedReference {
  const reference = raw.trim().toUpperCase();
  if (CONTAINER_SHAPE.test(reference)) {
    return isValidContainerNumber(reference)
      ? { ok: true, reference, type: 'container' }
      : { ok: false, message: `El número de contenedor ${reference} tiene un dígito verificador inválido (ISO 6346).` };
  }
  if (BL_SHAPE.test(reference)) return { ok: true, reference, type: 'bl' };
  return {
    ok: false,
    message: 'La referencia debe ser un número de contenedor (4 letras y 7 dígitos, ej. CSQU3054383) o un BL de 6 a 20 caracteres alfanuméricos.',
  };
}
