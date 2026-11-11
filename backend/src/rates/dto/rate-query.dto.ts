import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { CONTAINERS, type ContainerType } from '../../common/types.js';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const LOCODE = /^[A-Z]{2}[A-Z0-9]{3}$/;

export class RateQueryDto {
  @ApiProperty({ example: 'CNSHA', description: 'Puerto de origen (UN/LOCODE, debe ser de China)' })
  @Transform(upper)
  @Matches(LOCODE, { message: 'origin debe ser un código UN/LOCODE válido (ej. CNSHA).' })
  @Matches(/^CN/, { message: 'origin debe ser un puerto de China (empieza con CN).' })
  origin!: string;

  @ApiPropertyOptional({ example: 'ECGYE', default: 'ECGYE', description: 'Puerto de destino (UN/LOCODE). Por defecto Guayaquil.' })
  @Transform(upper)
  @IsOptional()
  @Matches(LOCODE, { message: 'destination debe ser un código UN/LOCODE válido (ej. ECGYE).' })
  destination: string = 'ECGYE';

  @ApiPropertyOptional({ enum: CONTAINERS, default: '40HC', description: 'Tipo de contenedor' })
  @Transform(upper)
  @IsOptional()
  @IsIn(CONTAINERS, { message: `container debe ser uno de: ${CONTAINERS.join(', ')}.` })
  container: ContainerType = '40HC';
}

export class HistoryQueryDto {
  @ApiPropertyOptional({ example: 'CNSHA', description: 'Filtrar por puerto de origen' })
  @Transform(upper)
  @IsOptional()
  @Matches(LOCODE, { message: 'origin debe ser un código UN/LOCODE válido.' })
  origin?: string;

  @ApiPropertyOptional({ example: 'ECGYE', description: 'Filtrar por puerto de destino' })
  @Transform(upper)
  @IsOptional()
  @Matches(LOCODE, { message: 'destination debe ser un código UN/LOCODE válido.' })
  destination?: string;

  @ApiPropertyOptional({ enum: CONTAINERS, description: 'Filtrar por tipo de contenedor' })
  @Transform(upper)
  @IsOptional()
  @IsIn(CONTAINERS, { message: `container debe ser uno de: ${CONTAINERS.join(', ')}.` })
  container?: ContainerType;

  @ApiPropertyOptional({ example: 'MAERSK', enum: ['MAERSK', 'CMA_CGM', 'HAPAG_LLOYD', 'MSC'], description: 'Filtrar por naviera' })
  @Transform(upper)
  @IsOptional()
  @IsIn(['MAERSK', 'CMA_CGM', 'HAPAG_LLOYD', 'MSC'], { message: 'carrier no es una naviera conocida.' })
  carrier?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Número de página' })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'page debe ser un entero.' })
  @Min(1, { message: 'page debe ser mayor o igual a 1.' })
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100, description: 'Registros por página (máximo 100)' })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'pageSize debe ser un entero.' })
  @Min(1, { message: 'pageSize debe ser mayor o igual a 1.' })
  @Max(100, { message: 'pageSize no puede superar 100.' })
  pageSize: number = 20;
}
