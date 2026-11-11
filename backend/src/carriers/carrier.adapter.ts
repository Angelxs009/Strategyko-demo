import type { Carrier, RateQuery, RateQuote } from '../common/types.js';

/** Contrato común que implementa cada naviera. */
export interface CarrierAdapter {
  readonly carrier: Carrier;
  getRate(query: RateQuery, now?: Date): Promise<RateQuote>;
}

/** Error transitorio: se puede reintentar (5xx, timeout, 429). */
export class TransientCarrierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientCarrierError';
  }
}

/** La naviera no está configurada (faltan credenciales o un endpoint verificado). */
export class CarrierNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CarrierNotConfiguredError';
  }
}
