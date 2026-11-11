import { ApiProperty } from '@nestjs/swagger';
import type { BreakdownRow, Comparison, RankingEntry } from '../compare/compare.js';
import type { Carrier, DataMode, DataSource } from '../common/types.js';
import { CARRIER_ENUM, CarrierErrorDto, RateQuoteDto, RouteQueryDto } from './common.models.js';

export class RankingEntryDto implements RankingEntry {
  @ApiProperty({ example: 1 })
  rank!: number;

  @ApiProperty({ enum: CARRIER_ENUM, example: 'CMA_CGM' })
  carrier!: Carrier;

  @ApiProperty({ example: 4077.77 })
  totalUsd!: number;

  @ApiProperty({ example: 0, description: 'Diferencia en USD frente a la más barata' })
  deltaUsd!: number;

  @ApiProperty({ example: 0, description: 'Diferencia en % frente a la más barata' })
  deltaPct!: number;

  @ApiProperty({ example: 39 })
  transitDays!: number;

  @ApiProperty({ example: 104.56, description: 'USD por día de tránsito' })
  usdPerTransitDay!: number;

  @ApiProperty({ example: 0.3, description: 'Puntaje de equilibrio: 70 % costo y 30 % tránsito, normalizados. Menor es mejor.' })
  balanceScore!: number;

  @ApiProperty({ example: '2026-11-09' })
  validFrom!: string;

  @ApiProperty({ example: '2026-11-22' })
  validTo!: string;

  @ApiProperty({ enum: ['demo', 'live'], example: 'demo' })
  source!: DataSource;
}

export class BreakdownRowDto implements BreakdownRow {
  @ApiProperty({ example: 'BASE', description: '`BASE` es el flete base; el resto son códigos de recargo' })
  code!: string;

  @ApiProperty({ example: 'Flete base' })
  name!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { MAERSK: 3559.07, CMA_CGM: 3321.69, HAPAG_LLOYD: 3486.15 },
    description: 'Monto en USD por naviera',
  })
  byCarrier!: Partial<Record<Carrier, number>>;
}

export class SpreadDto {
  @ApiProperty({ example: 291.9, description: 'Máximo menos mínimo, en USD' })
  usd!: number;

  @ApiProperty({ example: 7.16, description: 'Dispersión en % sobre la más barata' })
  pct!: number;
}

export class ComparisonDto implements Comparison {
  @ApiProperty({ enum: ['demo', 'live', 'mixed'], example: 'demo' })
  mode!: DataMode;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Datos simulados (modo demo): no son tarifas reales. No los uses para cotizar.',
    description: 'Aviso cuando algún dato es simulado; `null` si todo es real',
  })
  warning!: string | null;

  @ApiProperty({ example: 3, description: 'Cantidad de tarifas comparadas (mínimo 2)' })
  n!: number;

  @ApiProperty({ enum: CARRIER_ENUM, example: 'CMA_CGM', description: 'Más económica' })
  cheapest!: Carrier;

  @ApiProperty({ enum: CARRIER_ENUM, example: 'HAPAG_LLOYD', description: 'Más rápida' })
  fastest!: Carrier;

  @ApiProperty({ enum: CARRIER_ENUM, example: 'CMA_CGM', description: 'Mejor equilibrio costo/tránsito' })
  bestBalance!: Carrier;

  @ApiProperty({ type: [RankingEntryDto], description: 'Ordenado por costo total ascendente' })
  ranking!: RankingEntryDto[];

  @ApiProperty({ type: SpreadDto })
  spread!: SpreadDto;

  @ApiProperty({ example: 4268.81, description: 'Promedio del total en USD' })
  averageUsd!: number;

  @ApiProperty({ type: [BreakdownRowDto], description: 'Flete base y cada recargo, por naviera' })
  breakdown!: BreakdownRowDto[];

  @ApiProperty({
    type: [String],
    example: ['CMA CGM es la más económica (USD 4077.77).', 'Hapag-Lloyd es la más rápida y llega 7 días antes, pero cuesta USD 281.23 más.'],
    description: 'Lectura del análisis en español',
  })
  insights!: string[];
}

export class CompareResponseDto {
  @ApiProperty({ type: RouteQueryDto })
  query!: RouteQueryDto;

  @ApiProperty({ type: [RateQuoteDto] })
  quotes!: RateQuoteDto[];

  @ApiProperty({ type: [CarrierErrorDto], description: 'Navieras que fallaron. Vacío si todas respondieron.' })
  errors!: CarrierErrorDto[];

  @ApiProperty({ type: ComparisonDto })
  comparison!: ComparisonDto;
}
