import { TransientCarrierError } from '../carriers/carrier.adapter.js';
import { TimeoutError, withRetry, withTimeout } from './resilience.js';

describe('withTimeout', () => {
  it('rechaza con TimeoutError si se excede el tiempo', async () => {
    const slow = new Promise((r) => setTimeout(r, 200));
    await expect(withTimeout(slow, 20)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('devuelve el valor si llega a tiempo', async () => {
    await expect(withTimeout(Promise.resolve(7), 100)).resolves.toBe(7);
  });
});

describe('withRetry', () => {
  it('reintenta errores transitorios hasta tener éxito', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) throw new TransientCarrierError('503');
      return 'ok';
    };
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).resolves.toBe('ok');
    expect(calls).toBe(3);
  });

  it('se rinde tras agotar los reintentos (1 intento + 2 reintentos)', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new TransientCarrierError('503');
    };
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).rejects.toThrow('503');
    expect(calls).toBe(3);
  });

  it('NO reintenta errores no transitorios', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new Error('400 credenciales inválidas');
    };
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).rejects.toThrow('400');
    expect(calls).toBe(1);
  });
});
