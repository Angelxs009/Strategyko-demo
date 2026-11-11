import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { HealthDto } from '../api-models/common.models.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Estado del servicio',
    description: 'Indica que el servicio responde y en qué modo de datos corre (`demo` = simulado, `live` = real). No requiere API key.',
  })
  @ApiOkResponse({ type: HealthDto })
  check(): HealthDto {
    return {
      status: 'ok',
      mode: this.config.get<string>('RATES_MODE') === 'live' ? 'live' : 'demo',
      timestamp: new Date().toISOString(),
    };
  }
}
