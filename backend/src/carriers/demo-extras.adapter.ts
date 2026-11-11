import type { Carrier, Departure, ReferenceType, ScheduleQuery, TrackingResult } from '../common/types.js';
import { buildDemoDepartures, buildDemoTracking } from './demo-extras.js';
import type { ScheduleAdapter, TrackingAdapter } from './extras.adapter.js';

/** Salidas simuladas (source = "demo"). */
export class DemoScheduleAdapter implements ScheduleAdapter {
  constructor(readonly carrier: Carrier) {}

  async getDepartures(query: ScheduleQuery, now: Date = new Date()): Promise<Departure[]> {
    return buildDemoDepartures(this.carrier, query, now);
  }
}

/** Seguimiento simulado (source = "demo"). */
export class DemoTrackingAdapter implements TrackingAdapter {
  constructor(readonly carrier: Carrier) {}

  async track(reference: string, type: ReferenceType, now: Date = new Date()): Promise<TrackingResult> {
    return buildDemoTracking(this.carrier, reference, type, now);
  }
}
