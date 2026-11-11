import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { CarriersService } from '../carriers/carriers.service.js';
import { DemoScheduleAdapter, DemoTrackingAdapter } from '../carriers/demo-extras.adapter.js';
import type { ScheduleAdapter, TrackingAdapter } from '../carriers/extras.adapter.js';
import { CarrierContractUnverifiedError, TransientCarrierError } from '../carriers/carrier.adapter.js';
import { TrackingService } from '../tracking/tracking.service.js';
import { TrackingQueryDto } from '../tracking/dto/tracking-query.dto.js';
import { ScheduleQueryDto } from './dto/schedule-query.dto.js';
import { SchedulesService } from './schedules.service.js';

const q = { origin: 'CNSHA', destination: 'ECGYE', weeks: 2 };
const now = new Date('2026-11-11T10:00:00Z');

const failing = (carrier: ScheduleAdapter['carrier'], err: Error): ScheduleAdapter => ({
  carrier,
  getDepartures: async () => {
    throw err;
  },
});

function schedulesWith(adapters: ScheduleAdapter[]) {
  const service = new SchedulesService({ scheduleAdapters: () => adapters } as unknown as CarriersService);
  service.retryBaseDelayMs = 1;
  return service;
}

describe('SchedulesService', () => {
  it('combina las salidas de todas las navieras ordenadas por fecha', async () => {
    const r = await schedulesWith([
      new DemoScheduleAdapter('MAERSK'),
      new DemoScheduleAdapter('CMA_CGM'),
      new DemoScheduleAdapter('HAPAG_LLOYD'),
    ]).fetch(q, now);
    expect(r.n).toBe(6);
    const etds = r.departures.map((d) => d.etd);
    expect(etds).toEqual([...etds].sort());
    expect(r.mode).toBe('demo');
    expect(r.warning).toContain('Salidas simuladas (modo demo)');
  });

  it('si una naviera falla, las demás siguen y el error se informa', async () => {
    const r = await schedulesWith([
      new DemoScheduleAdapter('MAERSK'),
      failing('CMA_CGM', new CarrierContractUnverifiedError('CMA CGM', 'Schedules')),
    ]).fetch(q, now);
    expect(r.n).toBe(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ carrier: 'CMA_CGM' });
    expect(r.errors[0].message).toContain('no está verificado');
  });

  it('reintenta errores transitorios', async () => {
    let calls = 0;
    const flaky: ScheduleAdapter = {
      carrier: 'MAERSK',
      getDepartures: async () => {
        calls++;
        throw new TransientCarrierError('503');
      },
    };
    const r = await schedulesWith([flaky]).fetch(q, now);
    expect(calls).toBe(3);
    expect(r.errors[0].message).toBe('503');
  });

  it('con todas fallando devuelve lista vacía y no inventa datos', async () => {
    const r = await schedulesWith([failing('MAERSK', new Error('x'))]).fetch(q, now);
    expect(r.departures).toEqual([]);
    expect(r.n).toBe(0);
  });
});

describe('TrackingService', () => {
  const trackingWith = (adapter: TrackingAdapter) => {
    const service = new TrackingService({ trackingAdapter: () => adapter } as unknown as CarriersService);
    service.retryBaseDelayMs = 1;
    return service;
  };

  it('devuelve el seguimiento demo con aviso', async () => {
    const r = await trackingWith(new DemoTrackingAdapter('MAERSK')).track('csqu3054383', 'MAERSK', now);
    expect(r.tracking.reference).toBe('CSQU3054383');
    expect(r.tracking.referenceType).toBe('container');
    expect(r.mode).toBe('demo');
    expect(r.warning).toContain('Seguimiento y eventos simulados (modo demo)');
  });

  it('rechaza una referencia inválida con 400 y no consulta a la naviera', async () => {
    const track = vi.fn();
    const service = trackingWith({ carrier: 'MAERSK', track });
    await expect(service.track('CSQU3054384', 'MAERSK')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.track('!!', 'MAERSK')).rejects.toBeInstanceOf(BadRequestException);
    expect(track).not.toHaveBeenCalled();
  });

  it('si la naviera falla responde 502 con el detalle', async () => {
    const service = trackingWith({
      carrier: 'MAERSK',
      track: async () => {
        throw new CarrierContractUnverifiedError('Maersk', 'Track & Trace');
      },
    });
    const err = await service.track('ABC12345', 'MAERSK').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadGatewayException);
    expect(JSON.stringify((err as BadGatewayException).getResponse())).toContain('no está verificado');
  });
});

describe('DTOs', () => {
  it('ScheduleQueryDto: valores por defecto y límites', () => {
    const ok = plainToInstance(ScheduleQueryDto, { origin: 'cnsha' });
    expect(validateSync(ok)).toEqual([]);
    expect(ok).toMatchObject({ origin: 'CNSHA', destination: 'ECGYE', weeks: 4 });
    expect(validateSync(plainToInstance(ScheduleQueryDto, { origin: 'CNSHA', weeks: '9' })).length).toBe(1);
    expect(validateSync(plainToInstance(ScheduleQueryDto, { origin: 'CNSHA', weeks: '0' })).length).toBe(1);
    expect(validateSync(plainToInstance(ScheduleQueryDto, { origin: 'USLAX' })).length).toBe(1);
  });

  it('TrackingQueryDto: carrier obligatorio y conocido', () => {
    expect(validateSync(plainToInstance(TrackingQueryDto, { carrier: 'maersk' }))).toEqual([]);
    expect(validateSync(plainToInstance(TrackingQueryDto, {})).length).toBe(1);
    expect(validateSync(plainToInstance(TrackingQueryDto, { carrier: 'ACME' })).length).toBe(1);
  });
});
