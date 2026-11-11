import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';

const CARRIERS_WITH_TRACKING = ['MAERSK', 'CMA_CGM', 'HAPAG_LLOYD'] as const;
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class TrackingQueryDto {
  @ApiProperty({ enum: CARRIERS_WITH_TRACKING, example: 'MAERSK', description: 'Naviera a la que se consulta el seguimiento' })
  @Transform(upper)
  @IsIn(CARRIERS_WITH_TRACKING, { message: `carrier es obligatorio y debe ser uno de: ${CARRIERS_WITH_TRACKING.join(', ')}.` })
  carrier!: (typeof CARRIERS_WITH_TRACKING)[number];
}
