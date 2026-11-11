import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBadGatewayResponse, ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { BadGatewayDto, ErrorResponseDto } from '../api-models/common.models.js';
import { ApiCommonErrors } from '../api-models/decorators.js';
import { TrackingResponseDto } from '../api-models/schedules-tracking.models.js';
import { TrackingQueryDto } from './dto/tracking-query.dto.js';
import { TrackingService } from './tracking.service.js';

@ApiTags('tracking')
@ApiSecurity('api-key')
@Controller('api/tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get(':reference')
  @ApiOperation({
    summary: 'Seguimiento de un contenedor o BL',
    description:
      'Devuelve el estado, el buque, la llegada estimada y la línea de tiempo de eventos de la referencia en la naviera indicada. ' +
      'La referencia puede ser un número de contenedor (4 letras y 7 dígitos; se valida el dígito verificador ISO 6346) o un BL de 6 a 20 caracteres alfanuméricos. ' +
      'La naviera es obligatoria: no se deduce de la referencia. En modo demo la línea de tiempo es simulada.',
  })
  @ApiParam({
    name: 'reference',
    example: 'CSQU3054383',
    description: 'Contenedor (ej. `CSQU3054383`) o BL (6 a 20 caracteres alfanuméricos)',
  })
  @ApiOkResponse({ type: TrackingResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Referencia inválida (por ejemplo, contenedor con dígito verificador incorrecto) o `carrier` ausente o desconocido.',
    example: {
      statusCode: 400,
      message: 'El número de contenedor CSQU3054384 tiene un dígito verificador inválido (ISO 6346).',
      error: 'Bad Request',
    },
  })
  @ApiBadGatewayResponse({
    type: BadGatewayDto,
    description: 'La naviera no pudo devolver el seguimiento (error, timeout o contrato live no verificado).',
    example: {
      statusCode: 502,
      message: 'No se pudo obtener el seguimiento de MAERSK: El contrato de la API live de Maersk no está verificado (pendiente: endpoint y respuesta de la API de Track & Trace).',
      errors: [{ carrier: 'MAERSK', message: 'El contrato de la API live de Maersk no está verificado (pendiente: endpoint y respuesta de la API de Track & Trace).' }],
    },
  })
  @ApiCommonErrors()
  get(@Param('reference') reference: string, @Query() query: TrackingQueryDto): Promise<TrackingResponseDto> {
    return this.tracking.track(reference, query.carrier);
  }
}
