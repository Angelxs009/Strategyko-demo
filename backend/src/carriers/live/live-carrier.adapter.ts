import type { ConfigService } from '@nestjs/config';
import type { Carrier, RateQuery, RateQuote } from '../../common/types.js';
import { CarrierNotConfiguredError, type CarrierAdapter } from '../carrier.adapter.js';
import { carrierRequestJson } from './http.js';
import { ClientCredentialsTokenProvider } from './oauth2.js';
import { buildLiveQuote, type RawLiveRate } from './rate-mapping.js';

/** Petición HTTP que una naviera necesita para cotizar. La define cada adaptador. */
export interface LiveRequest {
  method: 'GET' | 'POST';
  path: string; // relativo a *_BASE_URL
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

interface LiveSettings {
  baseUrl: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
}

/**
 * Esqueleto común de los adaptadores live. Aquí vive todo lo verificable (configuración, token,
 * HTTP, clasificación de errores y validación del resultado). Cada naviera solo aporta:
 *   - buildRequest(): qué pedirle a su API
 *   - parseResponse(): cómo leer su respuesta
 *   - apiKeyHeader(): nombre del header de la API key, si aplica
 * Mientras esas piezas no estén verificadas, lanzan CarrierContractUnverifiedError.
 */
export abstract class LiveCarrierAdapter implements CarrierAdapter {
  abstract readonly carrier: Carrier;
  /** Prefijo de variables de entorno, ej. "MAERSK" → MAERSK_BASE_URL, MAERSK_CLIENT_ID… */
  protected abstract readonly envPrefix: string;

  private tokens: ClientCredentialsTokenProvider | null = null;

  constructor(protected readonly config: ConfigService) {}

  protected abstract buildRequest(query: RateQuery): LiveRequest;
  protected abstract parseResponse(raw: unknown, query: RateQuery): RawLiveRate;

  /** Nombre del header donde va la API key. null = aún no verificado. */
  protected apiKeyHeader(): string | null {
    return null;
  }

  async getRate(query: RateQuery, _now?: Date): Promise<RateQuote> {
    const settings = this.settings();
    const req = this.buildRequest(query); // lanza CarrierContractUnverifiedError si falta el contrato

    const headers: Record<string, string> = { accept: 'application/json', ...req.headers };
    if (settings.tokenUrl && settings.clientId && settings.clientSecret) {
      this.tokens ??= new ClientCredentialsTokenProvider({
        carrier: this.carrier,
        tokenUrl: settings.tokenUrl,
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
      });
      headers.authorization = `Bearer ${await this.tokens.getToken()}`;
    }
    if (settings.apiKey) {
      const name = this.apiKeyHeader();
      if (!name) {
        throw new CarrierNotConfiguredError(
          `${this.carrier}: hay una API key configurada pero el nombre de su header no está verificado (TODO(angel): apiKeyHeader()).`,
        );
      }
      headers[name] = settings.apiKey;
    }

    const url = new URL(req.path, settings.baseUrl.endsWith('/') ? settings.baseUrl : `${settings.baseUrl}/`);
    for (const [k, v] of Object.entries(req.query ?? {})) url.searchParams.set(k, v);
    if (req.body !== undefined) headers['content-type'] = 'application/json';

    const raw = await carrierRequestJson(this.carrier, url.toString(), {
      method: req.method,
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
    });
    return buildLiveQuote(this.carrier, query, this.parseResponse(raw, query));
  }

  /** Lee y valida la configuración. Nunca cae a demo: si falta algo, lanza un error claro. */
  private settings(): LiveSettings {
    const get = (k: string) => this.config.get<string>(`${this.envPrefix}_${k}`) || undefined;
    const s: LiveSettings = {
      baseUrl: get('BASE_URL') ?? '',
      tokenUrl: get('TOKEN_URL'),
      clientId: get('CLIENT_ID'),
      clientSecret: get('CLIENT_SECRET'),
      apiKey: get('API_KEY'),
    };
    const missing: string[] = [];
    if (!s.baseUrl) missing.push(`${this.envPrefix}_BASE_URL`);
    const hasOauth = Boolean(s.tokenUrl && s.clientId && s.clientSecret);
    if (!hasOauth && !s.apiKey) {
      missing.push(`${this.envPrefix}_TOKEN_URL + ${this.envPrefix}_CLIENT_ID + ${this.envPrefix}_CLIENT_SECRET (o ${this.envPrefix}_API_KEY)`);
    }
    if (missing.length > 0) {
      throw new CarrierNotConfiguredError(
        `${this.carrier} no está configurado para modo live. Faltan variables de entorno: ${missing.join('; ')}.`,
      );
    }
    return s;
  }
}
