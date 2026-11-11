import { Injectable } from '@nestjs/common';
import { CarriersService } from '../carriers/carriers.service.js';
import { DEFAULT_RUN_OPTIONS, runPerCarrier } from '../carriers/run-per-carrier.js';
import { demoWarning } from '../common/mode.js';
import type { CarrierError, DataMode, Departure, ScheduleQuery } from '../common/types.js';
import { resolveMode } from '../common/types.js';

export interface SchedulesResult {
  query: ScheduleQuery;
  n: number;
  mode: DataMode;
  warning: string | null;
  departures: Departure[];
  errors: CarrierError[];
}

@Injectable()
export class SchedulesService {
  /** Ajustables para que los tests no esperen el backoff real. */
  timeoutMs = DEFAULT_RUN_OPTIONS.timeoutMs;
  retryBaseDelayMs = DEFAULT_RUN_OPTIONS.baseDelayMs;

  constructor(private readonly carriers: CarriersService) {}

  /** Próximas salidas de todas las navieras, ordenadas por fecha. Si una falla, las demás siguen. */
  async fetch(query: ScheduleQuery, now?: Date): Promise<SchedulesResult> {
    const { values, errors } = await runPerCarrier(
      this.carriers.scheduleAdapters(),
      (a) => a.getDepartures(query, now),
      { timeoutMs: this.timeoutMs, retries: DEFAULT_RUN_OPTIONS.retries, baseDelayMs: this.retryBaseDelayMs },
    );
    const departures = values.flat().sort((a, b) => a.etd.localeCompare(b.etd) || a.carrier.localeCompare(b.carrier));
    const mode = resolveMode(departures.map((d) => d.source));
    return { query, n: departures.length, mode, warning: demoWarning(mode, 'Salidas'), departures, errors };
  }
}
