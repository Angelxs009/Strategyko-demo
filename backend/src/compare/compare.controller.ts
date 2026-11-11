import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadGatewayResponse, ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { BadGatewayDto, ErrorResponseDto } from '../api-models/common.models.js';
import { CompareResponseDto } from '../api-models/compare.models.js';
import { ApiCommonErrors } from '../api-models/decorators.js';
import { RateQueryDto } from '../rates/dto/rate-query.dto.js';
import { CompareService } from './compare.service.js';

@ApiTags('compare')
@ApiSecurity('api-key')
@Controller('api/compare')
export class CompareController {
  constructor(private readonly compare: CompareService) {}

  @Get()
  @ApiOperation({
    summary: 'Comparar tarifas',
    description:
      'Consulta las navieras y compara: ranking por costo total con diferencia frente a la más barata, ' +
      'más económica, más rápida, mejor equilibrio (70 % costo y 30 % tránsito), dispersión, desglose por componente e insights en español. ' +
      'Necesita al menos 2 tarifas. Si `comparison.mode` no es `live`, `comparison.warning` avisa que hay datos simulados.',
  })
  @ApiOkResponse({ type: CompareResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Parámetros inválidos: `origin` debe ser un UN/LOCODE de China, etc.',
    example: { statusCode: 400, message: ['container debe ser uno de: 20GP, 40GP, 40HC.'], error: 'Bad Request' },
  })
  @ApiBadGatewayResponse({
    type: BadGatewayDto,
    description: 'Menos de 2 navieras respondieron, así que no se puede comparar. `errors` detalla el fallo de cada una.',
    example: {
      statusCode: 502,
      message: 'No hay suficientes tarifas para comparar (obtenidas: 1, mínimo: 2).',
      errors: [{ carrier: 'MAERSK', message: 'Maersk no está configurado para modo live. Faltan variables de entorno: MAERSK_BASE_URL.' }],
    },
  })
  @ApiCommonErrors()
  async get(@Query() dto: RateQueryDto): Promise<CompareResponseDto> {
    const { query, quotes, errors, comparison } = await this.compare.compare(dto);
    return { query, quotes, errors, comparison };
  }
}
