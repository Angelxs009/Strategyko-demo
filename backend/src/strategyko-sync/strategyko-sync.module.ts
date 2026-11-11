import { Module } from '@nestjs/common';
import { CompareModule } from '../compare/compare.module.js';
import { SchedulesModule } from '../schedules/schedules.module.js';
import { StrategykoSyncController } from './strategyko-sync.controller.js';
import { StrategykoSyncService } from './strategyko-sync.service.js';

@Module({
  imports: [CompareModule, SchedulesModule],
  controllers: [StrategykoSyncController],
  providers: [StrategykoSyncService],
})
export class StrategykoSyncModule {}
