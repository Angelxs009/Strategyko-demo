import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Comparison } from '../compare/compare.js';
import { CompareService } from '../compare/compare.service.js';
import type { DataMode, RateQuery, RateQuote } from '../common/types.js';

export const SCHEMA_VERSION = '1.0';

/** Contrato PROPUESTO: pendiente de alinear con el backend real de Strategyko. */
export interface StrategykoPayload {
  schemaVersion: string;
  generatedAt: string;
  origin: 'strategyko-rates';
  query: RateQuery;
  dataMode: DataMode;
  quotes: RateQuote[];
  comparison: Comparison;
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
    private readonly config: ConfigService,
  ) {}

  buildPayload(query: RateQuery, quotes: RateQuote[], comparison: Comparison): StrategykoPayload {
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      origin: 'strategyko-rates',
      query,
      dataMode: comparison.mode,
      quotes,
      comparison,
    };
  }

  async push(query: RateQuery): Promise<PushResult> {
    const { quotes, comparison } = await this.compare.compare(query);
    const payload = this.buildPayload(query, quotes, comparison);

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
