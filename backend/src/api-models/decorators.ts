import { applyDecorators } from '@nestjs/common';
import { ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from './common.models.js';

/** Errores que pueden ocurrir en cualquier ruta `/api`: clave inválida (si está activada) y límite de uso. */
export const ApiCommonErrors = () =>
  applyDecorators(
    ApiUnauthorizedResponse({
      type: ErrorResponseDto,
      description: 'Falta el header `x-api-key` o es inválido. Solo aplica si el servicio tiene `SERVICE_API_KEY` configurada.',
      example: { statusCode: 401, message: 'API key inválida o ausente (header x-api-key).', error: 'Unauthorized' },
    }),
    ApiTooManyRequestsResponse({
      type: ErrorResponseDto,
      description: 'Demasiadas solicitudes: el límite es de 60 por minuto.',
      example: { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
    }),
  );
