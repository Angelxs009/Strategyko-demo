import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Comparison } from '../compare/compare.js';
import { CompareService } from '../compare/compare.service.js';
import type { DataMode, Departure, RateQuery, RateQuote } from '../common/types.js';
import { resolveMode } from '../common/types.js';
import { SchedulesService } from '../schedules/schedules.service.js';

// 1.1: agrega `schedules` (opcional). Los consumidores de 1.0 siguen funcionando.
export const SCHEMA_VERSION = '1.1';
export const SCHEDULE_WEEKS = 4;

/** Contrato PROPUESTO: pendiente de alinear con el backend real de Strategyko. */
export interface StrategykoPayload {
  schemaVersion: string;
  generatedAt: string;
  origin: 'strategyko-rates';
  query: RateQuery;
  dataMode: DataMode;
  quotes: RateQuote[];
  comparison: Comparison;
  /** Próximas salidas de la ruta; se omite si no se pudieron obtener. */
  schedules?: Departure[];
}

export interface PushResult {
  delivered: boolean;
  dryRun: boolean;
  status: number | null;
  message: string;
  payload: StrategykoPayload;
}

@Injectable()
export class StrategykoSyncService {
  private readonly logger = new Logger(StrategykoSyncService.name);

  constructor(
    private readonly compare: CompareService,
    private readonly schedules: SchedulesService,
    private readonly config: ConfigService,
  ) {}

  buildPayload(query: RateQuery, quotes: RateQuote[], comparison: Comparison, departures: Departure[] = []): StrategykoPayload {
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      origin: 'strategyko-rates',
      query,
      dataMode: resolveMode([...quotes.map((q) => q.source), ...departures.map((d) => d.source)]),
      quotes,
      comparison,
      ...(departures.length > 0 && { schedules: departures }),
    };
  }

  async push(query: RateQuery): Promise<PushResult> {
    const { quotes, comparison } = await this.compare.compare(query);
    const { departures } = await this.schedules.fetch({ ...query, weeks: SCHEDULE_WEEKS });
    const payload = this.buildPayload(query, quotes, comparison, departures);

    const url = this.config.get<string>('STRATEGYKO_URL');
    if (!url) {
      return {
        delivered: false,
        dryRun: true,
        status: null,
        message: 'Modo dry-run: STRATEGYKO_URL no está configurada, no se envió nada.',
        payload,
      };
    }

    const apiKey = this.config.get<string>('STRATEGYKO_API_KEY') ?? '';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        throw new BadGatewayException({
          statusCode: 502,
          message: `Strategyko respondió ${res.status}.`,
          upstreamStatus: res.status,
        });
      }
      return { delivered: true, dryRun: false, status: res.status, message: 'Enviado a Strategyko.', payload };
    } catch (err) {
      if (err instanceof BadGatewayException) throw err;
      this.logger.error(`Fallo al enviar a Strategyko: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadGatewayException('No se pudo contactar a Strategyko (red o tiempo de espera).');
    }
  }
}
