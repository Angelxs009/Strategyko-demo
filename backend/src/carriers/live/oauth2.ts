import { CarrierResponseError } from '../carrier.adapter.js';
import { carrierRequestJson } from './http.js';

export interface ClientCredentialsConfig {
  carrier: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

const SAFETY_MARGIN_MS = 30_000;

/**
 * Obtiene y cachea tokens con el flujo estándar OAuth2 "client credentials" (RFC 6749, §4.4).
 *
 * TODO(angel): cada portal define cómo se envían las credenciales (en el cuerpo, como en este
 * proveedor, o con HTTP Basic), el `scope` y la URL del token. Verifícalo en su documentación.
 */
export class ClientCredentialsTokenProvider {
  private token: { value: string; expiresAt: number } | null = null;
  private pending: Promise<string> | null = null;

  constructor(
    private readonly cfg: ClientCredentialsConfig,
    private readonly now: () => number = Date.now,
  ) {}

  async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;
    // Evita pedir varios tokens a la vez cuando hay consultas en paralelo.
    this.pending ??= this.fetchToken().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async fetchToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
    });
    if (this.cfg.scope) body.set('scope', this.cfg.scope);

    const raw = (await carrierRequestJson(this.cfg.carrier, this.cfg.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
    })) as { access_token?: unknown; expires_in?: unknown };

    if (typeof raw?.access_token !== 'string' || raw.access_token === '') {
      throw new CarrierResponseError(`${this.cfg.carrier}: la respuesta del token no incluye access_token.`);
    }
    const expiresIn = typeof raw.expires_in === 'number' && raw.expires_in > 0 ? raw.expires_in : 300;
    this.token = { value: raw.access_token, expiresAt: this.now() + expiresIn * 1000 - SAFETY_MARGIN_MS };
    return raw.access_token;
  }
}
