import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/** Si existe SERVICE_API_KEY, exige el header x-api-key en las rutas /api. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('SERVICE_API_KEY');
    if (!expected) return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.path.startsWith('/api')) return true; // /health queda abierto
    const received = req.header('x-api-key') ?? '';
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('API key inválida o ausente (header x-api-key).');
    }
    return true;
  }
}
