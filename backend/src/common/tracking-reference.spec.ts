import { containerCheckDigit, isValidContainerNumber, parseTrackingReference } from './tracking-reference.js';

describe('ISO 6346', () => {
  it('calcula el dígito verificador del ejemplo oficial CSQU305438-3', () => {
    expect(containerCheckDigit('CSQU305438')).toBe(3);
    expect(isValidContainerNumber('CSQU3054383')).toBe(true);
  });

  it('rechaza un dígito verificador incorrecto', () => {
    expect(isValidContainerNumber('CSQU3054384')).toBe(false);
  });

  it('rechaza formatos que no son de contenedor', () => {
    expect(isValidContainerNumber('CSQU305438')).toBe(false);
    expect(isValidContainerNumber('1234ABC5678')).toBe(false);
  });
});

describe('parseTrackingReference', () => {
  it('acepta un contenedor válido (normaliza mayúsculas y espacios)', () => {
    expect(parseTrackingReference('  csqu3054383 ')).toEqual({ ok: true, reference: 'CSQU3054383', type: 'container' });
  });

  it('con forma de contenedor pero dígito inválido explica el motivo', () => {
    const r = parseTrackingReference('CSQU3054384');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain('dígito verificador inválido');
  });

  it('acepta un BL alfanumérico de 6 a 20 caracteres', () => {
    expect(parseTrackingReference('mscu12345678')).toEqual({ ok: true, reference: 'MSCU12345678', type: 'bl' });
    expect(parseTrackingReference('ABC123').ok).toBe(true);
  });

  it.each(['AB1', '', 'tiene espacios', 'con-guion-123', 'A'.repeat(21)])('rechaza %j', (raw) => {
    expect(parseTrackingReference(raw).ok).toBe(false);
  });
});
