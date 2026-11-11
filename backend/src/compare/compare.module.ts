import { Module } from '@nestjs/common';
import { RatesModule } from '../rates/rates.module.js';
import { CompareController } from './compare.controller.js';
import { CompareService } from './compare.service.js';

@Module({
  imports: [RatesModule],
  controllers: [CompareController],
  providers: [CompareService],
  exports: [CompareService],
})
export class CompareModule {}
