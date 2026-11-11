import type { Carrier, Departure, ScheduleQuery, TrackingResult, ReferenceType } from '../common/types.js';

/** Próximas salidas de una naviera. */
export interface ScheduleAdapter {
  readonly carrier: Carrier;
  getDepartures(query: ScheduleQuery, now?: Date): Promise<Departure[]>;
}

/** Seguimiento de una referencia (contenedor o BL) en una naviera. */
export interface TrackingAdapter {
  readonly carrier: Carrier;
  track(reference: string, type: ReferenceType, now?: Date): Promise<TrackingResult>;
}
