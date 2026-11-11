import type { Carrier, Departure, ReferenceType, ScheduleQuery, TrackingResult } from '../../common/types.js';
import { CarrierContractUnverifiedError } from '../carrier.adapter.js';
import type { ScheduleAdapter, TrackingAdapter } from '../extras.adapter.js';

/**
 * Salidas y seguimiento en modo live: SIN contrato verificado.
 *
 * Lo que se encontró (no verificado contra los portales):
 *  - CMA CGM: un directorio de terceros lista en su portal APIs de Track & Trace (alineada con
 *    DCSA) y de Schedules.
 *  - Hapag-Lloyd: un comunicado de 2021 menciona APIs de horarios de navegación y de información
 *    de transporte (seguimiento).
 *  - Maersk: no se encontró información sobre estas APIs.
 *
 * TODO(angel): con una cuenta de cada portal, confirmar autenticación, endpoint y estructura de
 * respuesta, y reemplazar estas clases por adaptadores reales (como en live-carrier.adapter.ts).
 * Hasta entonces fallan con un error claro; nunca caen a demo ni inventan datos.
 */
export class UnverifiedLiveScheduleAdapter implements ScheduleAdapter {
  constructor(
    readonly carrier: Carrier,
    private readonly label: string,
  ) {}

  async getDepartures(_query: ScheduleQuery, _now?: Date): Promise<Departure[]> {
    throw new CarrierContractUnverifiedError(this.label, 'endpoint y respuesta de la API de Schedules');
  }
}

export class UnverifiedLiveTrackingAdapter implements TrackingAdapter {
  constructor(
    readonly carrier: Carrier,
    private readonly label: string,
  ) {}

  async track(_reference: string, _type: ReferenceType, _now?: Date): Promise<TrackingResult> {
    throw new CarrierContractUnverifiedError(this.label, 'endpoint y respuesta de la API de Track & Trace');
  }
}
