import { ApiProperty } from '@nestjs/swagger';
import type { Carrier, ContainerType, DataSource } from '../common/types.js';
import { CARRIER_ENUM, CONTAINER_ENUM, CarrierErrorDto, RateQuoteDto, RouteQueryDto, SurchargeDto } from './common.models.js';

export class RatesResponseDto {
  @ApiProperty({ type: RouteQueryDto, description: 'Consulta tal como se interpretó (con los valores por defecto aplicados)' })
  query!: RouteQueryDto;

  @ApiProperty({ example: 3, description: 'Cantidad de tarifas obtenidas' })
  n!: number;

  @ApiProperty({ type: [RateQuoteDto] })
  quotes!: RateQuoteDto[];

  @ApiProperty({ type: [CarrierErrorDto], description: 'Navieras que fallaron. Vacío si todas respondieron.' })
  errors!: CarrierErrorDto[];
}

export class HistoryItemDto {
  @ApiProperty({ example: '0b8e6a52-2a4f-4d0d-9f0e-1d6c2c7a9d11' })
  id!: string;

  @ApiProperty({ enum: CARRIER_ENUM, example: 'MAERSK' })
  carrier!: Carrier;

  @ApiProperty({ example: 'CNSHA' })
  origin!: string;

  @ApiProperty({ example: 'ECGYE' })
  destination!: string;

  @ApiProperty({ enum: CONTAINER_ENUM, example: '40HC' })
  container!: ContainerType;

  @ApiProperty({ example: 3559.07 })
  baseFreightUsd!: number;

  @ApiProperty({ example: 4369.67 })
  totalUsd!: number;

  @ApiProperty({ example: 34 })
  transitDays!: number;

  @ApiProperty({ example: '2026-11-09' })
  validFrom!: string;

  @ApiProperty({ example: '2026-11-22' })
  validTo!: string;

  @ApiProperty({ enum: ['demo', 'live'], example: 'demo' })
  source!: DataSource;

  @ApiProperty({ example: '2026-11-11T17:34:14.000Z', description: 'Cuándo se consultó la tarifa' })
  fetchedAt!: string;

  @ApiProperty({ type: [SurchargeDto] })
  surcharges!: SurchargeDto[];
}

export class HistoryResponseDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 9, description: 'Total de registros que cumplen los filtros' })
  total!: number;

  @ApiProperty({ type: [HistoryItemDto], description: 'De la consulta más reciente a la más antigua' })
  items!: HistoryItemDto[];
}
