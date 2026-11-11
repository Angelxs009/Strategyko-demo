import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Carrier, RateQuery, RateQuote } from '../common/types.js';
import { CarrierNotConfiguredError, type CarrierAdapter } from './carrier.adapter.js';
import { DemoCarrierAdapter } from './demo.adapter.js';

/** Navieras activas en esta entrega (MSC queda fuera por ahora). */
export const ACTIVE_CARRIERS: Carrier[] = ['MAERSK', 'CMA_CGM', 'HAPAG_LLOYD'];

/** Adaptador live aún sin implementar: falla con un error claro, nunca cae a demo. */
class NotConfiguredAdapter implements CarrierAdapter {
  constructor(readonly carrier: Carrier) {}

  async getRate(_query: RateQuery, _now?: Date): Promise<RateQuote> {
    throw new CarrierNotConfiguredError(
      `El adaptador live de ${this.carrier} no está configurado (faltan credenciales o endpoint verificado).`,
    );
  }
}

@Injectable()
export class CarriersService {
  constructor(private readonly config: ConfigService) {}

  get mode(): 'demo' | 'live' {
    return this.config.get<string>('RATES_MODE') === 'live' ? 'live' : 'demo';
  }

  adapters(): CarrierAdapter[] {
    return ACTIVE_CARRIERS.map((c) => (this.mode === 'live' ? new NotConfiguredAdapter(c) : new DemoCarrierAdapter(c)));
  }
}
