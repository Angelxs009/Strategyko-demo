import type { RateQuery } from '../../common/types.js';
import { CarrierContractUnverifiedError } from '../carrier.adapter.js';
import { LiveCarrierAdapter, type LiveRequest } from './live-carrier.adapter.js';
import type { RawLiveRate } from './rate-mapping.js';

/**
 * Maersk: Developer Portal (developer.maersk.com), API "Product Offers and Pricing"
 * (flete base + recargos) y API "Locations" (para resolver puertos).
 *
 * Lo que se encontró (no verificado contra el portal):
 *  - La documentación de Offers distingue consumidores: sitios de Maersk con JWT de ForgeRock e
 *    integraciones directas / plataformas de terceros con "consumer key"; hay endpoints que
 *    soportan uno u otro modelo.
 *  - El portal indica OAuth2 "client credentials" para los productos que lo requieren; no se pudo
 *    confirmar si Offers lo usa en producción.
 *  - Los hosts de documentación (SIT) no fueron accesibles al momento de escribir esto.
 *
 * TODO(angel): con una cuenta del portal, confirmar y completar:
 *  1. Modelo de autenticación de Offers en producción (consumer key vs OAuth2) y nombre exacto
 *     del header de la key → apiKeyHeader().
 *  2. Endpoint, método y cuerpo/parámetros de la cotización → buildRequest().
 *  3. Cómo resolver origen/destino (¿UN/LOCODE directo o geoId vía Locations?).
 *  4. Estructura de la respuesta: flete base, recargos, tránsito y vigencia → parseResponse().
 */
export class MaerskLiveAdapter extends LiveCarrierAdapter {
  readonly carrier = 'MAERSK' as const;
  protected readonly envPrefix = 'MAERSK';

  protected buildRequest(_query: RateQuery): LiveRequest {
    throw new CarrierContractUnverifiedError('Maersk', 'endpoint, parámetros y autenticación de Product Offers');
  }

  protected parseResponse(_raw: unknown, _query: RateQuery): RawLiveRate {
    throw new CarrierContractUnverifiedError('Maersk', 'estructura de respuesta de Product Offers');
  }
}
