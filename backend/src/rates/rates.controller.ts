import { Controller, Get, Query } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { HistoryQueryDto, RateQueryDto } from './dto/rate-query.dto.js';
import { RatesService } from './rates.service.js';

@ApiTags('rates')
@ApiSecurity('api-key')
@Controller('api/rates')
export class RatesController {
  constructor(private readonly rates: RatesService) {}

  @Get()
  async list(@Query() dto: RateQueryDto) {
    const { quotes, errors } = await this.rates.fetchRates(dto);
    return { query: dto, n: quotes.length, quotes, errors };
  }

  // Ruta estática: va antes de cualquier ruta con parámetros.
  @Get('history')
  history(@Query() dto: HistoryQueryDto) {
    return this.rates.history(dto);
  }
}
