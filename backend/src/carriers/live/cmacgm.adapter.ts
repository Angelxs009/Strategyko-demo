import type { RateQuery } from '../../common/types.js';
import { CarrierContractUnverifiedError } from '../carrier.adapter.js';
import { LiveCarrierAdapter, type LiveRequest } from './live-carrier.adapter.js';
import type { RawLiveRate } from './rate-mapping.js';

/**
 * CMA CGM: portal api-portal.cma-cgm.com, "Quotation API" (cotización spot con desglose de
 * recargos; según un directorio de terceros, también contratos de servicio de EE. UU.).
 *
 * Lo que se encontró (no verificado contra el portal):
 *  - El portal existe, pero su página es un shell de JavaScript sin documentación visible sin
 *    sesión, y no se encontró endpoint, esquema ni método de autenticación.
 *  - Una integradora de terceros indicó que, por ahora, no podía acceder a las tarifas spot de
 *    CMA CGM por API: el acceso a spot podría estar limitado a ciertas cuentas.
 *
 * TODO(angel): con una cuenta del portal, confirmar y completar:
 *  1. ¿Tu cuenta tiene acceso a Quotation spot? Pedirlo a CMA CGM si no.
 *  2. Método de autenticación y su configuración (token URL, scope, header de API key).
 *  3. Endpoint, método y cuerpo de la cotización → buildRequest().
 *  4. Estructura de la respuesta (flete, recargos, tránsito, vigencia) → parseResponse().
 */
export class CmaCgmLiveAdapter extends LiveCarrierAdapter {
  readonly carrier = 'CMA_CGM' as const;
  protected readonly envPrefix = 'CMACGM';

  protected buildRequest(_query: RateQuery): LiveRequest {
    throw new CarrierContractUnverifiedError('CMA CGM', 'endpoint, parámetros y autenticación de la Quotation API');
  }

  protected parseResponse(_raw: unknown, _query: RateQuery): RawLiveRate {
    throw new CarrierContractUnverifiedError('CMA CGM', 'estructura de respuesta de la Quotation API');
  }
}
