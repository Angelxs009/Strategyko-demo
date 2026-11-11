import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { HistoryQueryDto, RateQueryDto } from './rate-query.dto.js';

const check = (plain: object) => {
  const dto = plainToInstance(RateQueryDto, plain);
  return { dto, errors: validateSync(dto).flatMap((e) => Object.values(e.constraints ?? {})) };
};

describe('RateQueryDto', () => {
  it('acepta un origen chino y aplica los valores por defecto', () => {
    const { dto, errors } = check({ origin: 'cnsha' });
    expect(errors).toEqual([]);
    expect(dto.origin).toBe('CNSHA');
    expect(dto.destination).toBe('ECGYE');
    expect(dto.container).toBe('40HC');
  });

  it('rechaza un origen que no es de China, con mensaje en español', () => {
    const { errors } = check({ origin: 'USLAX' });
    expect(errors).toContain('origin debe ser un puerto de China (empieza con CN).');
  });

  it('rechaza un UN/LOCODE mal formado', () => {
    expect(check({ origin: 'CN' }).errors.length).toBeGreaterThan(0);
    expect(check({ origin: 'CNSHA', destination: 'E1' }).errors).toContain(
      'destination debe ser un código UN/LOCODE válido (ej. ECGYE).',
    );
  });

  it('rechaza si falta el origen', () => {
    expect(check({}).errors.length).toBeGreaterThan(0);
  });

  it('rechaza un contenedor fuera del enum', () => {
    expect(check({ origin: 'CNSHA', container: '45HC' }).errors[0]).toContain('container debe ser uno de');
  });
});

describe('HistoryQueryDto', () => {
  it('limita pageSize a 100 y convierte números', () => {
    const ok = plainToInstance(HistoryQueryDto, { page: '2', pageSize: '50' });
    expect(validateSync(ok)).toEqual([]);
    expect(ok.page).toBe(2);
    expect(validateSync(plainToInstance(HistoryQueryDto, { pageSize: '500' })).length).toBe(1);
  });
});
