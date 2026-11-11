import { BadGatewayException, Injectable } from '@nestjs/common';
import type { RateQuery } from '../common/types.js';
import { RatesService, type FetchRatesResult } from '../rates/rates.service.js';
import { compareQuotes, type Comparison } from './compare.js';

export interface CompareResult extends FetchRatesResult {
  comparison: Comparison;
}

@Injectable()
export class CompareService {
  constructor(private readonly rates: RatesService) {}

  /** Consulta y compara. Con menos de 2 tarifas responde 502 con el detalle por naviera. */
  async compare(query: RateQuery): Promise<CompareResult> {
    const result = await this.rates.fetchRates(query);
    if (result.quotes.length < 2) {
      throw new BadGatewayException({
        statusCode: 502,
        message: `No hay suficientes tarifas para comparar (obtenidas: ${result.quotes.length}, mínimo: 2).`,
        errors: result.errors,
      });
    }
    return { ...result, comparison: compareQuotes(result.quotes) };
  }
}
