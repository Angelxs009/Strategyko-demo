import { CarrierNotConfiguredError, TransientCarrierError, type CarrierAdapter } from '../carriers/carrier.adapter.js';
import { DemoCarrierAdapter } from '../carriers/demo.adapter.js';
import type { CarriersService } from '../carriers/carriers.service.js';
import type { RateQuery } from '../common/types.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RatesService } from './rates.service.js';
import type { ConfigService } from '@nestjs/config';

const query: RateQuery = { origin: 'CNSHA', destination: 'ECGYE', container: '40HC' };

function build(adapters: CarrierAdapter[]) {
  const create = vi.fn().mockResolvedValue({});
  const prisma = { rateQuery: { create } } as unknown as PrismaService;
  const carriers = { adapters: () => adapters } as unknown as CarriersService;
  const config = { get: () => undefined } as unknown as ConfigService;
  const service = new RatesService(carriers, prisma, config);
  service.retryBaseDelayMs = 1;
  return { service, create };
}

const failing = (carrier: CarrierAdapter['carrier'], err: Error): CarrierAdapter => ({
  carrier,
  getRate: async () => {
    throw err;
  },
});

describe('RatesService.fetchRates', () => {
  it('si una naviera falla, las demás siguen y el error se informa por naviera', async () => {
    const { service, create } = build([
      new DemoCarrierAdapter('MAERSK'),
      failing('CMA_CGM', new CarrierNotConfiguredError('sin credenciales')),
      new DemoCarrierAdapter('HAPAG_LLOYD'),
    ]);
    const r = await service.fetchRates(query);
    expect(r.quotes.map((q) => q.carrier)).toEqual(['MAERSK', 'HAPAG_LLOYD']);
    expect(r.errors).toEqual([{ carrier: 'CMA_CGM', message: 'sin credenciales' }]);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].data.tenantId).toBe('dev-tenant');
  });

  it('reintenta errores transitorios y luego informa el fallo', async () => {
    let calls = 0;
    const flaky: CarrierAdapter = {
      carrier: 'MAERSK',
      getRate: async () => {
        calls++;
        throw new TransientCarrierError('503');
      },
    };
    const { service } = build([flaky, new DemoCarrierAdapter('CMA_CGM')]);
    const r = await service.fetchRates(query);
    expect(calls).toBe(3);
    expect(r.errors[0]).toEqual({ carrier: 'MAERSK', message: '503' });
  });

  it('una naviera lenta agota el tiempo y no bloquea a las demás', async () => {
    const slow: CarrierAdapter = { carrier: 'MAERSK', getRate: () => new Promise(() => {}) };
    const { service } = build([slow, new DemoCarrierAdapter('CMA_CGM')]);
    service.timeoutMs = 20;
    const r = await service.fetchRates(query);
    expect(r.quotes).toHaveLength(1);
    expect(r.errors[0].message).toContain('Tiempo de espera agotado');
  });

  it('si todas fallan no guarda nada', async () => {
    const { service, create } = build([failing('MAERSK', new CarrierNotConfiguredError('x'))]);
    const r = await service.fetchRates(query);
    expect(r.quotes).toHaveLength(0);
    expect(create).not.toHaveBeenCalled();
  });
});
