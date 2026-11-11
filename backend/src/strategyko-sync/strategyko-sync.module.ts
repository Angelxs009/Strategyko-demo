import { Module } from '@nestjs/common';
import { CompareModule } from '../compare/compare.module.js';
import { StrategykoSyncController } from './strategyko-sync.controller.js';
import { StrategykoSyncService } from './strategyko-sync.service.js';

@Module({
  imports: [CompareModule],
  controllers: [StrategykoSyncController],
  providers: [StrategykoSyncService],
})
export class StrategykoSyncModule {}
