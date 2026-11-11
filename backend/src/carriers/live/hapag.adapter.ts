import type { RateQuery } from '../../common/types.js';
import { CarrierContractUnverifiedError } from '../carrier.adapter.js';
import { LiveCarrierAdapter, type LiveRequest } from './live-carrier.adapter.js';
import type { RawLiveRate } from './rate-mapping.js';

/**
 * Hapag-Lloyd: API Portal (api-portal.hlag.com), productos "Quick Quotes" y "Quick Quotes Spot",
 * con registro en su Online Business Suite.
 *
 * Lo que se encontró (no verificado contra el portal):
 *  - Integradores (p. ej. Descartes, Cargofive) confirman conectividad API con Quick Quote y
 *    Quick Quote Spot, vinculada a la cuenta del cliente.
 *  - Un comunicado de 2021 indica que se solicita autorización en el portal, luego se suscribe a
 *    productos y hay sandbox. Puede estar desactualizado.
 *  - El portal respondió 403 a una consulta automatizada, así que no se pudo leer su documentación.
 *
 * TODO(angel): con una cuenta del portal, confirmar y completar:
 *  1. Proceso de autorización/suscripción vigente y método de autenticación (token URL, scope, key).
 *  2. Diferencia entre Quick Quotes y Quick Quotes Spot, y cuál usar para este caso.
 *  3. Endpoint, método y cuerpo de la cotización → buildRequest().
 *  4. Estructura de la respuesta (flete, recargos, tránsito, vigencia) → parseResponse().
 */
export class HapagLiveAdapter extends LiveCarrierAdapter {
  readonly carrier = 'HAPAG_LLOYD' as const;
  protected readonly envPrefix = 'HAPAG';

  protected buildRequest(_query: RateQuery): LiveRequest {
    throw new CarrierContractUnverifiedError('Hapag-Lloyd', 'endpoint, parámetros y autenticación de Quick Quotes');
  }

  protected parseResponse(_raw: unknown, _query: RateQuery): RawLiveRate {
    throw new CarrierContractUnverifiedError('Hapag-Lloyd', 'estructura de respuesta de Quick Quotes');
  }
}
