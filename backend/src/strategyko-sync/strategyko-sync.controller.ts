import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { RateQueryDto } from '../rates/dto/rate-query.dto.js';
import { StrategykoSyncService } from './strategyko-sync.service.js';

@ApiTags('strategyko')
@ApiSecurity('api-key')
@Controller('api/push')
export class StrategykoSyncController {
  constructor(private readonly sync: StrategykoSyncService) {}

  /** Envía tarifas + comparación a Strategyko; dry-run si no hay STRATEGYKO_URL. */
  @Post()
  @HttpCode(202)
  push(@Body() dto: RateQueryDto) {
    return this.sync.push(dto);
  }
}
