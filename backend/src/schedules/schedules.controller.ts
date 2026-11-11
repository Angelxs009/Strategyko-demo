import { Controller, Get, Query } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ScheduleQueryDto } from './dto/schedule-query.dto.js';
import { SchedulesService } from './schedules.service.js';

@ApiTags('schedules')
@ApiSecurity('api-key')
@Controller('api/schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  /** Próximas salidas de las navieras para una ruta, de la más cercana a la más lejana. */
  @Get()
  get(@Query() dto: ScheduleQueryDto) {
    return this.schedules.fetch(dto);
  }
}
