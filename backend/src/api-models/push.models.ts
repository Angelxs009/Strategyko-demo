import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DataMode } from '../common/types.js';
import type { PushResult, StrategykoPayload } from '../strategyko-sync/strategyko-sync.service.js';
import { RateQuoteDto, RouteQueryDto } from './common.models.js';
import { ComparisonDto } from './compare.models.js';
import { DepartureDto } from './schedules-tracking.models.js';

export class PushPayloadDto implements StrategykoPayload {
  @ApiProperty({ example: '1.1', description: 'Versión del contrato. 1.1 agrega `schedules` (opcional) y es compatible con 1.0.' })
  schemaVersion!: string;

  @ApiProperty({ example: '2026-11-11T17:00:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ enum: ['strategyko-rates'], example: 'strategyko-rates' })
  origin!: 'strategyko-rates';

  @ApiProperty({ type: RouteQueryDto })
  query!: RouteQueryDto;

  @ApiProperty({ enum: ['demo', 'live', 'mixed'], example: 'demo' })
  dataMode!: DataMode;

  @ApiProperty({ type: [RateQuoteDto] })
  quotes!: RateQuoteDto[];

  @ApiProperty({ type: ComparisonDto })
  comparison!: ComparisonDto;

  @ApiPropertyOptional({ type: [DepartureDto], description: 'Próximas 4 semanas de salidas. Se omite si no se pudieron obtener.' })
  schedules?: DepartureDto[];
}

export class PushResultDto implements PushResult {
  @ApiProperty({ example: false, description: '`true` solo si Strategyko recibió el paquete' })
  delivered!: boolean;

  @ApiProperty({ example: true, description: '`true` = no hay `STRATEGYKO_URL` configurada y no se envió nada' })
  dryRun!: boolean;

  @ApiProperty({ type: Number, nullable: true, example: null, description: 'Código HTTP de Strategyko; `null` en dry-run' })
  status!: number | null;

  @ApiProperty({ example: 'Modo dry-run: STRATEGYKO_URL no está configurada, no se envió nada.' })
  message!: string;

  @ApiProperty({ type: PushPayloadDto, description: 'Lo que se envió (o se habría enviado)' })
  payload!: PushPayloadDto;
}
