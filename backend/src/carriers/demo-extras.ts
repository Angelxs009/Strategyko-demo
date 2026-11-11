import type {
  Carrier,
  Departure,
  ReferenceType,
  ScheduleQuery,
  TrackingEvent,
  TrackingResult,
  TrackingStatus,
} from '../common/types.js';
import { portName } from '../common/ports.js';
import { DEMO_PROFILES, hashString, isoDate, isoWeek, seededRandom } from './demo-rates.js';

// ATENCIÓN: todo lo de este archivo es SIMULADO. Los buques llevan el prefijo "DEMO" a propósito
// para que nunca se confundan con barcos, viajes o seguimientos reales.

const DAY_MS = 86_400_000;

/** Día de la semana de zarpe (0 = domingo) y servicio ficticio de cada naviera. */
const SCHEDULE_PROFILES: Record<Carrier, { weekday: number; service: string }> = {
  MAERSK: { weekday: 4, service: 'DEMO-PAC-A' },
  CMA_CGM: { weekday: 6, service: 'DEMO-PAC-B' },
  HAPAG_LLOYD: { weekday: 2, service: 'DEMO-PAC-C' },
  MSC: { weekday: 0, service: 'DEMO-PAC-D' },
};

const VESSEL_NAMES = ['AURORA', 'ATLAS', 'CORAL', 'DELTA', 'EOLO', 'FARO', 'GALENA', 'HORIZONTE'];

const startOfDayUtc = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

function vesselAndVoyage(carrier: Carrier, etd: Date, rand: () => number) {
  const { key } = isoWeek(etd);
  const week = key.split('-W')[1];
  return {
    vessel: `DEMO ${VESSEL_NAMES[Math.floor(rand() * VESSEL_NAMES.length)]}`,
    voyage: `${week}${String(etd.getUTCFullYear() % 100).padStart(2, '0')}E`,
    transitDays: Math.max(1, DEMO_PROFILES[carrier].transitDays + Math.round((rand() - 0.5) * 2)),
  };
}

/**
 * Próximas salidas simuladas: una por semana, en el día de zarpe de cada naviera, desde hoy
 * (inclusive) hacia adelante. Deterministas para la misma ruta y la misma fecha.
 */
export function buildDemoDepartures(carrier: Carrier, query: ScheduleQuery, now: Date): Departure[] {
  const profile = SCHEDULE_PROFILES[carrier];
  const today = startOfDayUtc(now);
  const daysUntil = (profile.weekday - today.getUTCDay() + 7) % 7;
  const first = addDays(today, daysUntil);

  return Array.from({ length: query.weeks }, (_, i) => {
    const etd = addDays(first, i * 7);
    const rand = seededRandom(hashString(`dep|${carrier}|${query.origin}|${query.destination}|${isoDate(etd)}`));
    const { vessel, voyage, transitDays } = vesselAndVoyage(carrier, etd, rand);
    return {
      carrier,
      origin: query.origin,
      destination: query.destination,
      vessel,
      voyage,
      service: profile.service,
      etd: isoDate(etd),
      eta: isoDate(addDays(etd, transitDays)),
      transitDays,
      source: 'demo' as const,
    };
  });
}

const STATUS_BY_LAST_EVENT: Record<string, TrackingStatus> = {
  ARRIVED: 'ARRIVED',
  DISCHARGED: 'ARRIVED',
  GATE_OUT: 'ARRIVED',
  DEPARTED: 'IN_TRANSIT',
};

/**
 * Seguimiento simulado de una referencia. La línea de tiempo es determinista por naviera y
 * referencia dentro de la misma semana; los hitos se marcan como completados según la fecha actual.
 */
export function buildDemoTracking(
  carrier: Carrier,
  reference: string,
  referenceType: ReferenceType,
  now: Date,
): TrackingResult {
  const rand = seededRandom(hashString(`trk|${carrier}|${reference}|${isoWeek(now).key}`));
  const origins = ['CNSHA', 'CNNGB', 'CNSZX', 'CNTAO'];
  const origin = origins[Math.floor(rand() * origins.length)];
  const destination = 'ECGYE';

  // Entre 5 días en el futuro y 45 días en el pasado, para ver los tres estados.
  const offsetDays = Math.floor(rand() * 51) - 5;
  const start = addDays(isoWeek(now).monday, -offsetDays);
  const transit = Math.max(1, DEMO_PROFILES[carrier].transitDays + Math.round((rand() - 0.5) * 2));
  const today = startOfDayUtc(now);

  const { vessel, voyage } = vesselAndVoyage(carrier, addDays(start, 3), rand);

  const plan: { code: string; description: string; at: string; day: number }[] = [
    { code: 'GATE_IN', description: 'Ingreso de la carga a la terminal de origen', at: origin, day: 0 },
    { code: 'LOADED', description: 'Carga embarcada en el buque', at: origin, day: 2 },
    { code: 'DEPARTED', description: 'Zarpe del buque', at: origin, day: 3 },
    { code: 'ARRIVED', description: 'Arribo del buque al puerto de destino', at: destination, day: 3 + transit },
    { code: 'DISCHARGED', description: 'Descarga en la terminal de destino', at: destination, day: 4 + transit },
    { code: 'GATE_OUT', description: 'Retiro de la carga de la terminal', at: destination, day: 6 + transit },
  ];

  const events: TrackingEvent[] = plan.map((p) => {
    const date = addDays(start, p.day);
    return {
      code: p.code,
      description: p.description,
      location: p.at,
      locationName: portName(p.at),
      date: isoDate(date),
      completed: date.getTime() <= today.getTime(),
    };
  });

  const lastDone = [...events].reverse().find((e) => e.completed);
  return {
    carrier,
    reference,
    referenceType,
    status: (lastDone && STATUS_BY_LAST_EVENT[lastDone.code]) || 'PENDING',
    vessel,
    voyage,
    origin,
    destination,
    eta: events.find((e) => e.code === 'ARRIVED')!.date,
    events,
    source: 'demo',
  };
}
