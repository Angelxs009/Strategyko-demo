import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { CarriersService } from '../carriers/carriers.service.js';
import { DEFAULT_RUN_OPTIONS } from '../carriers/run-per-carrier.js';
import { withRetry, withTimeout } from '../common/resilience.js';
import { demoWarning } from '../common/mode.js';
import { parseTrackingReference } from '../common/tracking-reference.js';
import type { Carrier, DataMode, TrackingResult } from '../common/types.js';
import { resolveMode } from '../common/types.js';

export interface TrackingResponse {
  mode: DataMode;
  warning: string | null;
  tracking: TrackingResult;
}

@Injectable()
export class TrackingService {
  /** Ajustables para que los tests no esperen el backoff real. */
  timeoutMs = DEFAULT_RUN_OPTIONS.timeoutMs;
  retryBaseDelayMs = DEFAULT_RUN_OPTIONS.baseDelayMs;

  constructor(private readonly carriers: CarriersService) {}

  async track(rawReference: string, carrier: Carrier, now?: Date): Promise<TrackingResponse> {
    const parsed = parseTrackingReference(rawReference);
    if (!parsed.ok) throw new BadRequestException(parsed.message);

    const adapter = this.carriers.trackingAdapter(carrier);
    try {
      const tracking = await withRetry(() => withTimeout(adapter.track(parsed.reference, parsed.type, now), this.timeoutMs), {
        retries: DEFAULT_RUN_OPTIONS.retries,
        baseDelayMs: this.retryBaseDelayMs,
      });
      const mode = resolveMode([tracking.source]);
      return { mode, warning: demoWarning(mode, 'Seguimiento y eventos'), tracking };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadGatewayException({
        statusCode: 502,
        message: `No se pudo obtener el seguimiento de ${carrier}: ${message}`,
        errors: [{ carrier, message }],
      });
    }
  }
}
