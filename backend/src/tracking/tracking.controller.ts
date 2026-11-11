import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { TrackingQueryDto } from './dto/tracking-query.dto.js';
import { TrackingService } from './tracking.service.js';

@ApiTags('tracking')
@ApiSecurity('api-key')
@Controller('api/tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  /** Seguimiento de un contenedor (ISO 6346) o de un BL en la naviera indicada. */
  @Get(':reference')
  @ApiParam({ name: 'reference', example: 'CSQU3054383', description: 'Contenedor (4 letras + 7 dígitos con dígito verificador) o BL (6 a 20 alfanuméricos)' })
  get(@Param('reference') reference: string, @Query() query: TrackingQueryDto) {
    return this.tracking.track(reference, query.carrier);
  }
}
