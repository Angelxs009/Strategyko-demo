import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CARRIERS,
  CONTAINERS,
  type Carrier,
  type CarrierError,
  type ContainerType,
  type DataSource,
  type RateQuote,
  type Surcharge,
} from '../common/types.js';

// Modelos de RESPUESTA para Swagger. Implementan los tipos reales: si el código cambia y estos
// modelos no, TypeScript falla al compilar, y los tests de contrato comparan además las
// respuestas reales contra el esquema publicado.

export const CARRIER_ENUM = [...CARRIERS];
export const CONTAINER_ENUM = [...CONTAINERS];

export class SurchargeDto implements Surcharge {
  @ApiProperty({ example: 'BAF', description: 'Código del recargo' })
  code!: string;

  @ApiProperty({ example: 'Recargo por combustible (BAF)' })
  name!: string;

  @ApiProperty({ example: 421.43, description: 'Monto en USD' })
  amountUsd!: number;
}

export class RateQuoteDto implements RateQuote {
  @ApiProperty({ enum: CARRIER_ENUM, example: 'CMA_CGM' })
  carrier!: Carrier;

  @ApiProperty({ example: 'CNSHA', description: 'Puerto de origen (UN/LOCODE)' })
  origin!: string;

  @ApiProperty({ example: 'ECGYE', description: 'Puerto de destino (UN/LOCODE)' })
  destination!: string;

  @ApiProperty({ enum: CONTAINER_ENUM, example: '40HC' })
  container!: ContainerType;

  @ApiProperty({ example: 3321.69, description: 'Flete base en USD' })
  baseFreightUsd!: number;

  @ApiProperty({ type: [SurchargeDto] })
  surcharges!: SurchargeDto[];

  @ApiProperty({ example: 4077.77, description: 'Siempre es el flete base más la suma de los recargos (USD)' })
  totalUsd!: number;

  @ApiProperty({ example: 39, description: 'Días de tránsito' })
  transitDays!: number;

  @ApiProperty({ example: '2026-11-09', description: 'Inicio de vigencia (YYYY-MM-DD)' })
  validFrom!: string;

  @ApiProperty({ example: '2026-11-22', description: 'Fin de vigencia (YYYY-MM-DD)' })
  validTo!: string;

  @ApiProperty({ enum: ['USD'], example: 'USD' })
  currency!: 'USD';

  @ApiProperty({ enum: ['demo', 'live'], example: 'demo', description: '`demo` = dato simulado; `live` = dato real de la naviera' })
  source!: DataSource;
}

export class CarrierErrorDto implements CarrierError {
  @ApiProperty({ enum: CARRIER_ENUM, example: 'MAERSK' })
  carrier!: Carrier;

  @ApiProperty({ example: 'El contrato de la API live de Maersk no está verificado (pendiente: ...)' })
  message!: string;
}

export class RouteQueryDto {
  @ApiProperty({ example: 'CNSHA' })
  origin!: string;

  @ApiProperty({ example: 'ECGYE' })
  destination!: string;

  @ApiProperty({ enum: CONTAINER_ENUM, example: '40HC' })
  container!: ContainerType;
}

export class HealthDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ enum: ['demo', 'live'], example: 'demo', description: 'Modo de datos con el que corre el servicio' })
  mode!: 'demo' | 'live';

  @ApiProperty({ example: '2026-11-11T17:00:00.000Z' })
  timestamp!: string;
}

/** Formato de los errores 400, 401 y 429 (formato estándar de NestJS). */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['origin debe ser un puerto de China (empieza con CN).'],
    description: 'Un mensaje o una lista de mensajes de validación, siempre en español',
  })
  message!: string | string[];

  @ApiPropertyOptional({ example: 'Bad Request' })
  error?: string;
}

/** Formato de los errores 502: falló una dependencia (navieras o Strategyko). */
export class BadGatewayDto {
  @ApiProperty({ example: 502 })
  statusCode!: number;

  @ApiProperty({ example: 'No hay suficientes tarifas para comparar (obtenidas: 1, mínimo: 2).' })
  message!: string;

  @ApiPropertyOptional({ type: [CarrierErrorDto], description: 'Detalle del fallo por naviera, si aplica' })
  errors?: CarrierErrorDto[];

  @ApiPropertyOptional({ example: 500, description: 'Código HTTP que devolvió Strategyko, si aplica' })
  upstreamStatus?: number;

  @ApiPropertyOptional({ example: 'Bad Gateway' })
  error?: string;
}
