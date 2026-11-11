import { Module } from '@nestjs/common';
import { CarriersModule } from '../carriers/carriers.module.js';
import { RatesController } from './rates.controller.js';
import { RatesService } from './rates.service.js';

@Module({
  imports: [CarriersModule],
  controllers: [RatesController],
  providers: [RatesService],
  exports: [RatesService],
})
export class RatesModule {}
