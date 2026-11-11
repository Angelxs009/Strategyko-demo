import { ApiProperty } from '@nestjs/swagger';
import type {
  Carrier,
  DataMode,
  DataSource,
  Departure,
  ReferenceType,
  TrackingEvent,
  TrackingResult,
  TrackingStatus,
} from '../common/types.js';
import { CARRIER_ENUM, CarrierErrorDto } from './common.models.js';

export class DepartureDto implements Departure {
  @ApiProperty({ enum: CARRIER_ENUM, example: 'MAERSK' })
  carrier!: Carrier;

  @ApiProperty({ example: 'CNSHA' })
  origin!: string;

  @ApiProperty({ example: 'ECGYE' })
  destination!: string;

  @ApiProperty({ example: 'DEMO AURORA', description: 'En modo demo el nombre siempre empieza con `DEMO`' })
  vessel!: string;

  @ApiProperty({ example: '4626E' })
  voyage!: string;

  @ApiProperty({ example: 'DEMO-PAC-A' })
  service!: string;

  @ApiProperty({ example: '2026-11-12', description: 'Salida estimada (YYYY-MM-DD)' })
  etd!: string;

  @ApiProperty({ example: '2026-12-16', description: 'Llegada estimada (YYYY-MM-DD)' })
  eta!: string;

  @ApiProperty({ example: 34, description: 'Días entre la salida y la llegada' })
  transitDays!: number;

  @ApiProperty({ enum: ['demo', 'live'], example: 'demo' })
  source!: DataSource;
}

export class ScheduleQueryEchoDto {
  @ApiProperty({ example: 'CNSHA' })
  origin!: string;

  @ApiProperty({ example: 'ECGYE' })
  destination!: string;

  @ApiProperty({ example: 4 })
  weeks!: number;
}

export class SchedulesResponseDto {
  @ApiProperty({ type: ScheduleQueryEchoDto })
  query!: ScheduleQueryEchoDto;

  @ApiProperty({ example: 12, description: 'Cantidad de salidas devueltas' })
  n!: number;

  @ApiProperty({ enum: ['demo', 'live', 'mixed'], example: 'demo' })
  mode!: DataMode;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Salidas simuladas (modo demo): no son datos reales. No los uses para operar.',
    description: 'Aviso cuando algún dato es simulado; `null` si todo es real',
  })
  warning!: string | null;

  @ApiProperty({ type: [DepartureDto], description: 'De la salida más cercana a la más lejana' })
  departures!: DepartureDto[];

  @ApiProperty({ type: [CarrierErrorDto], description: 'Navieras que fallaron. Vacío si todas respondieron.' })
  errors!: CarrierErrorDto[];
}

export class TrackingEventDto implements TrackingEvent {
  @ApiProperty({ example: 'DEPARTED', description: 'GATE_IN, LOADED, DEPARTED, ARRIVED, DISCHARGED o GATE_OUT' })
  code!: string;

  @ApiProperty({ example: 'Zarpe del buque' })
  description!: string;

  @ApiProperty({ example: 'CNSHA', description: 'UN/LOCODE del lugar' })
  location!: string;

  @ApiProperty({ example: 'Shanghái' })
  locationName!: string;

  @ApiProperty({ example: '2026-11-04', description: 'Fecha del evento (YYYY-MM-DD)' })
  date!: string;

  @ApiProperty({ example: true, description: '`true` = ya ocurrió; `false` = previsto' })
  completed!: boolean;
}

export class TrackingResultDto implements TrackingResult {
  @ApiProperty({ enum: CARRIER_ENUM, example: 'MAERSK' })
  carrier!: Carrier;

  @ApiProperty({ example: 'CSQU3054383' })
  reference!: string;

  @ApiProperty({ enum: ['container', 'bl'], example: 'container' })
  referenceType!: ReferenceType;

  @ApiProperty({
    enum: ['PENDING', 'IN_TRANSIT', 'ARRIVED'],
    example: 'IN_TRANSIT',
    description: '`PENDING` = aún no zarpa; `IN_TRANSIT` = en tránsito; `ARRIVED` = llegó al destino',
  })
  status!: TrackingStatus;

  @ApiProperty({ example: 'DEMO AURORA' })
  vessel!: string;

  @ApiProperty({ example: '4626E' })
  voyage!: string;

  @ApiProperty({ example: 'CNSHA' })
  origin!: string;

  @ApiProperty({ example: 'ECGYE' })
  destination!: string;

  @ApiProperty({ example: '2026-12-16', description: 'Llegada estimada (YYYY-MM-DD)' })
  eta!: string;

  @ApiProperty({ type: [TrackingEventDto], description: 'En orden cronológico' })
  events!: TrackingEventDto[];

  @ApiProperty({ enum: ['demo', 'live'], example: 'demo' })
  source!: DataSource;
}

export class TrackingResponseDto {
  @ApiProperty({ enum: ['demo', 'live', 'mixed'], example: 'demo' })
  mode!: DataMode;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Seguimiento y eventos simulados (modo demo): no son datos reales. No los uses para operar.',
    description: 'Aviso cuando el dato es simulado; `null` si es real',
  })
  warning!: string | null;

  @ApiProperty({ type: TrackingResultDto })
  tracking!: TrackingResultDto;
}
