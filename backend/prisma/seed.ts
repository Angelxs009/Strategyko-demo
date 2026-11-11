// Seed mínimo: guarda una consulta con tarifas DEMO (simuladas) para que el historial no arranque vacío.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ACTIVE_CARRIERS } from '../src/carriers/carriers.service.js';
import { DemoCarrierAdapter } from '../src/carriers/demo.adapter.js';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://strategyko:strategyko@localhost:55434/strategyko_rates';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const tenantId = process.env.DEV_TENANT_ID ?? 'dev-tenant';

async function main() {
  const query = { origin: 'CNSHA', destination: 'ECGYE', container: '40HC' as const };
  const quotes = await Promise.all(ACTIVE_CARRIERS.map((c) => new DemoCarrierAdapter(c).getRate(query)));
  await prisma.rateQuery.create({
    data: {
      tenantId,
      ...query,
      quotes: {
        create: quotes.map((q) => ({
          tenantId,
          carrier: q.carrier,
          origin: q.origin,
          destination: q.destination,
          container: q.container,
          baseFreightUsd: q.baseFreightUsd,
          totalUsd: q.totalUsd,
          transitDays: q.transitDays,
          validFrom: new Date(q.validFrom),
          validTo: new Date(q.validTo),
          source: q.source,
          surcharges: { create: q.surcharges.map((s) => ({ tenantId, code: s.code, name: s.name, amountUsd: s.amountUsd })) },
        })),
      },
    },
  });
  console.log(`Seed listo: ${quotes.length} tarifas demo para el tenant "${tenantId}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
