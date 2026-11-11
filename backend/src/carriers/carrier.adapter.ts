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

/** Credenciales rechazadas (401/403). No es transitorio: no se reintenta. */
export class CarrierAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CarrierAuthError';
  }
}

/** La naviera rechazó la solicitud (4xx distinto de 401/403/429). */
export class CarrierRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CarrierRequestError';
  }
}

/** La respuesta de la naviera no es válida o no se puede convertir a RateQuote. */
export class CarrierResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CarrierResponseError';
  }
}

/** El contrato de la API de la naviera aún no está verificado: no se inventan datos. */
export class CarrierContractUnverifiedError extends CarrierNotConfiguredError {
  constructor(carrier: string, pending: string) {
    super(
      `El contrato de la API live de ${carrier} no está verificado (pendiente: ${pending}). ` +
        'Revisa la documentación oficial del portal e implementa el TODO(angel) del adaptador.',
    );
    this.name = 'CarrierContractUnverifiedError';
  }
}
