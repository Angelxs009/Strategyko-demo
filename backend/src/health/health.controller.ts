import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      mode: this.config.get<string>('RATES_MODE') === 'live' ? 'live' : 'demo',
      timestamp: new Date().toISOString(),
    };
  }
}
