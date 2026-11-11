import { CarrierResponseError } from '../carrier.adapter.js';
import type { Carrier, RateQuery, RateQuote, Surcharge } from '../../common/types.js';
import { computeTotal } from '../../common/types.js';

/** Datos ya extraídos de la respuesta de una naviera, antes de validar. */
export interface RawLiveRate {
  baseFreight: number;
  surcharges: Surcharge[];
  currency: string;
  transitDays: number;
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD
  declaredTotal?: number; // si la naviera informa un total, se contrasta
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validMoney = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/**
 * Convierte datos extraídos de una naviera a RateQuote (source = "live") validando todo.
 * Nunca convierte monedas ni "arregla" datos inválidos: ante la duda, lanza CarrierResponseError.
 */
export function buildLiveQuote(carrier: Carrier, query: RateQuery, raw: RawLiveRate): RateQuote {
  const fail = (reason: string): never => {
    throw new CarrierResponseError(`${carrier}: respuesta inválida (${reason}).`);
  };

  if (raw.currency !== 'USD') fail(`moneda ${raw.currency} no soportada; solo USD, no se convierte`);
  if (!validMoney(raw.baseFreight)) fail('flete base no es un monto válido');
  for (const s of raw.surcharges) {
    if (!s.code || !s.name) fail('recargo sin código o nombre');
    if (!validMoney(s.amountUsd)) fail(`recargo ${s.code} no es un monto válido`);
  }
  if (!Number.isInteger(raw.transitDays) || raw.transitDays <= 0) fail('días de tránsito inválidos');
  if (!ISO_DATE.test(raw.validFrom) || !ISO_DATE.test(raw.validTo)) fail('fechas de vigencia inválidas');
  if (raw.validFrom > raw.validTo) fail('la vigencia termina antes de empezar');

  const totalUsd = computeTotal(raw.baseFreight, raw.surcharges);
  if (raw.declaredTotal !== undefined && Math.abs(raw.declaredTotal - totalUsd) > 0.01) {
    fail(`el total informado (${raw.declaredTotal}) no coincide con flete + recargos (${totalUsd})`);
  }

  return {
    carrier,
    origin: query.origin,
    destination: query.destination,
    container: query.container,
    baseFreightUsd: raw.baseFreight,
    surcharges: raw.surcharges,
    totalUsd,
    transitDays: raw.transitDays,
    validFrom: raw.validFrom,
    validTo: raw.validTo,
    currency: 'USD',
    source: 'live',
  };
}
