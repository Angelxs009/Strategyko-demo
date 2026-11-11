import type { Carrier, RateQuery, RateQuote } from '../common/types.js';
import type { CarrierAdapter } from './carrier.adapter.js';
import { buildDemoQuote } from './demo-rates.js';

/** Adaptador simulado: devuelve tarifas ilustrativas marcadas source = "demo". */
export class DemoCarrierAdapter implements CarrierAdapter {
  constructor(readonly carrier: Carrier) {}

  async getRate(query: RateQuery, now: Date = new Date()): Promise<RateQuote> {
    return buildDemoQuote(this.carrier, query, now);
  }
}
