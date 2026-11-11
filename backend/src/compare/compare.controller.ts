import { Controller, Get, Query } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { RateQueryDto } from '../rates/dto/rate-query.dto.js';
import { CompareService } from './compare.service.js';

@ApiTags('compare')
@ApiSecurity('api-key')
@Controller('api/compare')
export class CompareController {
  constructor(private readonly compare: CompareService) {}

  @Get()
  async get(@Query() dto: RateQueryDto) {
    const { query, quotes, errors, comparison } = await this.compare.compare(dto);
    return { query, quotes, errors, comparison };
  }
}
