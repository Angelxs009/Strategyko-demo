import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Carrier } from '../common/types.js';
import type { CarrierAdapter } from './carrier.adapter.js';
import { DemoCarrierAdapter } from './demo.adapter.js';
import { CmaCgmLiveAdapter } from './live/cmacgm.adapter.js';
import { HapagLiveAdapter } from './live/hapag.adapter.js';
import { MaerskLiveAdapter } from './live/maersk.adapter.js';

/** Navieras activas en esta entrega (MSC queda fuera por ahora). */
export const ACTIVE_CARRIERS: Carrier[] = ['MAERSK', 'CMA_CGM', 'HAPAG_LLOYD'];

@Injectable()
export class CarriersService {
  private cached: { mode: 'demo' | 'live'; adapters: CarrierAdapter[] } | null = null;

  constructor(private readonly config: ConfigService) {}

  get mode(): 'demo' | 'live' {
    return this.config.get<string>('RATES_MODE') === 'live' ? 'live' : 'demo';
  }

  /** Los adaptadores se crean una vez por modo para conservar el caché de tokens OAuth2. */
  adapters(): CarrierAdapter[] {
    const mode = this.mode;
    if (this.cached?.mode !== mode) {
      const adapters: CarrierAdapter[] =
        mode === 'live'
          ? [new MaerskLiveAdapter(this.config), new CmaCgmLiveAdapter(this.config), new HapagLiveAdapter(this.config)]
          : ACTIVE_CARRIERS.map((c) => new DemoCarrierAdapter(c));
      this.cached = { mode, adapters };
    }
    return this.cached.adapters;
  }
}
