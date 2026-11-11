import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ApiKeyGuard } from './common/api-key.guard.js';
import { CompareModule } from './compare/compare.module.js';
import { HealthModule } from './health/health.module.js';
import { TrackingModule } from './tracking/tracking.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RatesModule } from './rates/rates.module.js';
import { SchedulesModule } from './schedules/schedules.module.js';
import { StrategykoSyncModule } from './strategyko-sync/strategyko-sync.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    HealthModule,
    RatesModule,
    CompareModule,
    SchedulesModule,
    TrackingModule,
    StrategykoSyncModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
})
export class AppModule {}
