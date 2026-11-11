import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '../api-models/common.models.js';
import { ApiCommonErrors } from '../api-models/decorators.js';
import { HistoryResponseDto, RatesResponseDto } from '../api-models/rates.models.js';
import { HistoryQueryDto, RateQueryDto } from './dto/rate-query.dto.js';
import { RatesService } from './rates.service.js';

@ApiTags('rates')
@ApiSecurity('api-key')
@Controller('api/rates')
export class RatesController {
  constructor(private readonly rates: RatesService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar tarifas de las navieras',
    description:
      'Consulta Maersk, CMA CGM y Hapag-Lloyd **en paralelo** (8 s de timeout y hasta 2 reintentos ante errores transitorios), ' +
      'guarda lo obtenido en el historial y devuelve las tarifas normalizadas. ' +
      'Si una naviera falla, las demás igual responden y el fallo aparece en `errors`. ' +
      'En modo demo las tarifas son simuladas (`source: "demo"`).',
  })
  @ApiOkResponse({ type: RatesResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Parámetros inválidos: `origin` debe ser un UN/LOCODE de China, etc.',
    example: { statusCode: 400, message: ['origin debe ser un puerto de China (empieza con CN).'], error: 'Bad Request' },
  })
  @ApiCommonErrors()
  async list(@Query() dto: RateQueryDto): Promise<RatesResponseDto> {
    const { quotes, errors } = await this.rates.fetchRates(dto);
    return { query: dto, n: quotes.length, quotes, errors };
  }

  // Ruta estática: va antes de cualquier ruta con parámetros.
  @Get('history')
  @ApiOperation({
    summary: 'Historial de tarifas consultadas',
    description: 'Tarifas guardadas, de la más reciente a la más antigua, con filtros opcionales y paginación. Solo devuelve datos del tenant actual.',
  })
  @ApiOkResponse({ type: HistoryResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Filtros o paginación inválidos (por ejemplo `pageSize` mayor a 100).',
    example: { statusCode: 400, message: ['pageSize no puede superar 100.'], error: 'Bad Request' },
  })
  @ApiCommonErrors()
  history(@Query() dto: HistoryQueryDto): Promise<HistoryResponseDto> {
    return this.rates.history(dto);
  }
}
