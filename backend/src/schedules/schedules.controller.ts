import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '../api-models/common.models.js';
import { ApiCommonErrors } from '../api-models/decorators.js';
import { SchedulesResponseDto } from '../api-models/schedules-tracking.models.js';
import { ScheduleQueryDto } from './dto/schedule-query.dto.js';
import { SchedulesService } from './schedules.service.js';

@ApiTags('schedules')
@ApiSecurity('api-key')
@Controller('api/schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  @ApiOperation({
    summary: 'Próximas salidas',
    description:
      'Las próximas salidas de cada naviera para la ruta, de la más cercana a la más lejana, con buque, viaje, servicio, ETD, ETA y días de tránsito. ' +
      'Consulta las navieras en paralelo; si una falla, aparece en `errors` y las demás igual se devuelven. ' +
      'En modo demo los buques se llaman `DEMO ...` y los datos son simulados.',
  })
  @ApiOkResponse({ type: SchedulesResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Parámetros inválidos: `origin` de China obligatorio, `weeks` entre 1 y 8.',
    example: { statusCode: 400, message: ['weeks no puede superar 8.'], error: 'Bad Request' },
  })
  @ApiCommonErrors()
  get(@Query() dto: ScheduleQueryDto): Promise<SchedulesResponseDto> {
    return this.schedules.fetch(dto);
  }
}
