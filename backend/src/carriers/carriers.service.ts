import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Carrier } from '../common/types.js';
import type { CarrierAdapter } from './carrier.adapter.js';
import { DemoCarrierAdapter } from './demo.adapter.js';
import { DemoScheduleAdapter, DemoTrackingAdapter } from './demo-extras.adapter.js';
import type { ScheduleAdapter, TrackingAdapter } from './extras.adapter.js';
import { CmaCgmLiveAdapter } from './live/cmacgm.adapter.js';
import { HapagLiveAdapter } from './live/hapag.adapter.js';
import { UnverifiedLiveScheduleAdapter, UnverifiedLiveTrackingAdapter } from './live/live-extras.adapter.js';
import { MaerskLiveAdapter } from './live/maersk.adapter.js';

/** Navieras activas en esta entrega (MSC queda fuera por ahora). */
export const ACTIVE_CARRIERS: Carrier[] = ['MAERSK', 'CMA_CGM', 'HAPAG_LLOYD'];

const LABELS: Record<string, string> = { MAERSK: 'Maersk', CMA_CGM: 'CMA CGM', HAPAG_LLOYD: 'Hapag-Lloyd' };

type Mode = 'demo' | 'live';

@Injectable()
export class CarriersService {
  private cachedRates: { mode: Mode; adapters: CarrierAdapter[] } | null = null;

  constructor(private readonly config: ConfigService) {}

  get mode(): Mode {
    return this.config.get<string>('RATES_MODE') === 'live' ? 'live' : 'demo';
  }

  /** Los adaptadores de tarifas se crean una vez por modo para conservar el caché de tokens OAuth2. */
  adapters(): CarrierAdapter[] {
    const mode = this.mode;
    if (this.cachedRates?.mode !== mode) {
      const adapters: CarrierAdapter[] =
        mode === 'live'
          ? [new MaerskLiveAdapter(this.config), new CmaCgmLiveAdapter(this.config), new HapagLiveAdapter(this.config)]
          : ACTIVE_CARRIERS.map((c) => new DemoCarrierAdapter(c));
      this.cachedRates = { mode, adapters };
    }
    return this.cachedRates.adapters;
  }

  scheduleAdapters(): ScheduleAdapter[] {
    return ACTIVE_CARRIERS.map((c) =>
      this.mode === 'live' ? new UnverifiedLiveScheduleAdapter(c, LABELS[c]) : new DemoScheduleAdapter(c),
    );
  }

  trackingAdapter(carrier: Carrier): TrackingAdapter {
    return this.mode === 'live'
      ? new UnverifiedLiveTrackingAdapter(carrier, LABELS[carrier] ?? carrier)
      : new DemoTrackingAdapter(carrier);
  }
}
