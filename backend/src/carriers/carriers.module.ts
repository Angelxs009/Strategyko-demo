import { Module } from '@nestjs/common';
import { CarriersService } from './carriers.service.js';

@Module({ providers: [CarriersService], exports: [CarriersService] })
export class CarriersModule {}
