import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CarriersService } from '../carriers/carriers.service.js';
import { withRetry, withTimeout } from '../common/resilience.js';
import type { Carrier, RateQuery, RateQuote } from '../common/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { HistoryQueryDto } from './dto/rate-query.dto.js';

export const CARRIER_TIMEOUT_MS = 8000;
export const CARRIER_RETRIES = 2;

export interface CarrierError {
  carrier: Carrier;
  message: string;
}

export interface FetchRatesResult {
  query: RateQuery;
  quotes: RateQuote[];
  errors: CarrierError[];
}

@Injectable()
export class RatesService {
  /** Backoff base en ms; los tests lo reducen para no esperar. */
  retryBaseDelayMs = 300;
  timeoutMs = CARRIER_TIMEOUT_MS;

  constructor(
    private readonly carriers: CarriersService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get tenantId(): string {
    return this.config.get<string>('DEV_TENANT_ID') ?? 'dev-tenant';
  }

  /** Consulta todas las navieras en paralelo; si una falla, las demás siguen. */
  async fetchRates(query: RateQuery): Promise<FetchRatesResult> {
    const adapters = this.carriers.adapters();
    const results = await Promise.allSettled(
      adapters.map((a) =>
        withRetry(() => withTimeout(a.getRate(query), this.timeoutMs), {
          retries: CARRIER_RETRIES,
          baseDelayMs: this.retryBaseDelayMs,
        }),
      ),
    );

    const quotes: RateQuote[] = [];
    const errors: CarrierError[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') quotes.push(r.value);
      else errors.push({ carrier: adapters[i].carrier, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    });

    if (quotes.length > 0) await this.save(query, quotes);
    return { query, quotes, errors };
  }

  private async save(query: RateQuery, quotes: RateQuote[]): Promise<void> {
    const tenantId = this.tenantId;
    await this.prisma.rateQuery.create({
      data: {
        tenantId,
        origin: query.origin,
        destination: query.destination,
        container: query.container,
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
            surcharges: {
              create: q.surcharges.map((s) => ({ tenantId, code: s.code, name: s.name, amountUsd: s.amountUsd })),
            },
          })),
        },
      },
    });
  }

  /** Historial paginado. SIEMPRE filtra por tenantId. */
  async history(filters: HistoryQueryDto) {
    const where = {
      tenantId: this.tenantId,
      ...(filters.origin && { origin: filters.origin }),
      ...(filters.destination && { destination: filters.destination }),
      ...(filters.container && { container: filters.container }),
      ...(filters.carrier && { carrier: filters.carrier }),
    };
    const [total, rows] = await Promise.all([
      this.prisma.rateQuoteRecord.count({ where }),
      this.prisma.rateQuoteRecord.findMany({
        where,
        orderBy: { fetchedAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: { surcharges: true },
      }),
    ]);
    return {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      items: rows.map((r) => ({
        id: r.id,
        carrier: r.carrier,
        origin: r.origin,
        destination: r.destination,
        container: r.container,
        baseFreightUsd: Number(r.baseFreightUsd),
        totalUsd: Number(r.totalUsd),
        transitDays: r.transitDays,
        validFrom: r.validFrom.toISOString().slice(0, 10),
        validTo: r.validTo.toISOString().slice(0, 10),
        source: r.source,
        fetchedAt: r.fetchedAt.toISOString(),
        surcharges: r.surcharges.map((s) => ({ code: s.code, name: s.name, amountUsd: Number(s.amountUsd) })),
      })),
    };
  }
}
