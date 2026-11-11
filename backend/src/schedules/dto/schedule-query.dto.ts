import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const LOCODE = /^[A-Z]{2}[A-Z0-9]{3}$/;

export class ScheduleQueryDto {
  @ApiProperty({ example: 'CNSHA', description: 'Puerto de origen (UN/LOCODE, debe ser de China)' })
  @Transform(upper)
  @Matches(LOCODE, { message: 'origin debe ser un código UN/LOCODE válido (ej. CNSHA).' })
  @Matches(/^CN/, { message: 'origin debe ser un puerto de China (empieza con CN).' })
  origin!: string;

  @ApiPropertyOptional({ example: 'ECGYE', default: 'ECGYE' })
  @Transform(upper)
  @IsOptional()
  @Matches(LOCODE, { message: 'destination debe ser un código UN/LOCODE válido (ej. ECGYE).' })
  destination: string = 'ECGYE';

  @ApiPropertyOptional({ default: 4, minimum: 1, maximum: 8, description: 'Semanas hacia adelante' })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'weeks debe ser un entero.' })
  @Min(1, { message: 'weeks debe ser mayor o igual a 1.' })
  @Max(8, { message: 'weeks no puede superar 8.' })
  weeks: number = 4;
}
