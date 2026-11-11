import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBadGatewayResponse, ApiBadRequestResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { BadGatewayDto, ErrorResponseDto } from '../api-models/common.models.js';
import { ApiCommonErrors } from '../api-models/decorators.js';
import { PushResultDto } from '../api-models/push.models.js';
import { RateQueryDto } from '../rates/dto/rate-query.dto.js';
import { StrategykoSyncService } from './strategyko-sync.service.js';

@ApiTags('strategyko')
@ApiSecurity('api-key')
@Controller('api/push')
export class StrategykoSyncController {
  constructor(private readonly sync: StrategykoSyncService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Enviar a Strategyko',
    description:
      'Consulta y compara las tarifas de la ruta, suma las próximas 4 semanas de salidas y envía el paquete versionado (`schemaVersion` 1.1) a `STRATEGYKO_URL` con `Authorization: Bearer`. ' +
      'Si `STRATEGYKO_URL` no está configurada hace un **dry-run**: no envía nada y devuelve lo que enviaría (`dryRun: true`, `delivered: false`). ' +
      'El contrato es una propuesta, pendiente de alinear con el backend real de Strategyko.',
  })
  @ApiAcceptedResponse({ type: PushResultDto, description: 'Paquete aceptado: enviado a Strategyko o, en dry-run, simulado.' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Cuerpo inválido: `origin` debe ser un UN/LOCODE de China, etc.',
    example: { statusCode: 400, message: ['origin debe ser un puerto de China (empieza con CN).'], error: 'Bad Request' },
  })
  @ApiBadGatewayResponse({
    type: BadGatewayDto,
    description: 'No hay suficientes tarifas para armar la comparación, o Strategyko respondió con error o no se pudo contactar.',
    example: { statusCode: 502, message: 'Strategyko respondió 500.', upstreamStatus: 500 },
  })
  @ApiCommonErrors()
  push(@Body() dto: RateQueryDto): Promise<PushResultDto> {
    return this.sync.push(dto);
  }
}
