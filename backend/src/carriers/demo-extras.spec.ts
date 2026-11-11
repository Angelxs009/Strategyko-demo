import { DemoScheduleAdapter, DemoTrackingAdapter } from './demo-extras.adapter.js';
import { buildDemoTracking } from './demo-extras.js';
import { CARRIERS } from '../common/types.js';

const q = { origin: 'CNSHA', destination: 'ECGYE', weeks: 4 };
const wed = new Date('2026-11-11T10:00:00Z'); // miércoles

describe('Salidas demo', () => {
  it.each(CARRIERS)('%s: una salida por semana, marcadas demo, con buque DEMO', async (carrier) => {
    const deps = await new DemoScheduleAdapter(carrier).getDepartures(q, wed);
    expect(deps).toHaveLength(4);
    for (const d of deps) {
      expect(d.source).toBe('demo');
      expect(d.vessel.startsWith('DEMO ')).toBe(true);
      expect(d.service.startsWith('DEMO-')).toBe(true);
      expect(d.carrier).toBe(carrier);
    }
  });

  it('las salidas son futuras, semanales y eta = etd + tránsito', async () => {
    const deps = await new DemoScheduleAdapter('MAERSK').getDepartures(q, wed);
    expect(deps[0].etd).toBe('2026-11-12'); // próximo jueves
    expect(deps.map((d) => d.etd)).toEqual(['2026-11-12', '2026-11-19', '2026-11-26', '2026-12-03']);
    for (const d of deps) {
      const diff = (Date.parse(d.eta) - Date.parse(d.etd)) / 86_400_000;
      expect(diff).toBe(d.transitDays);
      expect(d.etd >= '2026-11-11').toBe(true);
    }
  });

  it('si hoy es el día de zarpe, esa salida cuenta', async () => {
    const thursday = new Date('2026-11-12T08:00:00Z');
    const [first] = await new DemoScheduleAdapter('MAERSK').getDepartures(q, thursday);
    expect(first.etd).toBe('2026-11-12');
  });

  it('es determinista para la misma ruta y fecha', async () => {
    const a = new DemoScheduleAdapter('CMA_CGM');
    expect(await a.getDepartures(q, wed)).toEqual(await a.getDepartures(q, new Date('2026-11-11T22:00:00Z')));
  });

  it('respeta la cantidad de semanas pedida', async () => {
    expect(await new DemoScheduleAdapter('HAPAG_LLOYD').getDepartures({ ...q, weeks: 1 }, wed)).toHaveLength(1);
    expect(await new DemoScheduleAdapter('HAPAG_LLOYD').getDepartures({ ...q, weeks: 8 }, wed)).toHaveLength(8);
  });
});

describe('Seguimiento demo', () => {
  const ref = 'CSQU3054383';

  it.each(CARRIERS)('%s: marcado demo, con eventos ordenados por fecha', async (carrier) => {
    const t = await new DemoTrackingAdapter(carrier).track(ref, 'container', wed);
    expect(t.source).toBe('demo');
    expect(t.vessel.startsWith('DEMO ')).toBe(true);
    expect(t.events.map((e) => e.code)).toEqual(['GATE_IN', 'LOADED', 'DEPARTED', 'ARRIVED', 'DISCHARGED', 'GATE_OUT']);
    const dates = t.events.map((e) => e.date);
    expect(dates).toEqual([...dates].sort((a, b) => a.localeCompare(b)));
    expect(t.destination).toBe('ECGYE');
    expect(t.eta).toBe(t.events.find((e) => e.code === 'ARRIVED')!.date);
  });

  it('es determinista dentro de la misma semana', async () => {
    const a = await new DemoTrackingAdapter('MAERSK').track(ref, 'container', wed);
    const b = await new DemoTrackingAdapter('MAERSK').track(ref, 'container', new Date('2026-11-14T10:00:00Z'));
    expect(a.origin).toBe(b.origin);
    expect(a.events.map((e) => e.date)).toEqual(b.events.map((e) => e.date));
  });

  it('distintas referencias dan recorridos distintos', async () => {
    const dates = new Set<string>();
    for (const r of ['CSQU3054383', 'ABC123456', 'XYZ987654', 'MSCU1234560', 'HLCU0000001', 'BL20260001']) {
      dates.add((await new DemoTrackingAdapter('MAERSK').track(r, 'bl', wed)).events[0].date);
    }
    expect(dates.size).toBeGreaterThan(2);
  });

  it('los hitos completados coinciden con la fecha actual y el estado es coherente', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const t = buildDemoTracking('MAERSK', `REF${1000 + i}`, 'bl', wed);
      seen.add(t.status);
      const today = '2026-11-11';
      for (const e of t.events) expect(e.completed).toBe(e.date <= today);
      const departed = t.events.find((e) => e.code === 'DEPARTED')!.completed;
      const arrived = t.events.find((e) => e.code === 'ARRIVED')!.completed;
      expect(t.status).toBe(arrived ? 'ARRIVED' : departed ? 'IN_TRANSIT' : 'PENDING');
    }
    expect(seen).toEqual(new Set(['PENDING', 'IN_TRANSIT', 'ARRIVED']));
  });
});
