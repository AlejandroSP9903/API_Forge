/**
 * API Forge - Manejador Centralizado de Errores (Fase 0)
 * Garantiza respuestas JSON estructuradas y protege contra la fuga de información sensible.
 */

import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.ts';
import type { ApiResponseError } from '../../packages/shared/types.ts';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = 'statusCode' in err && typeof err.statusCode === 'number' ? err.statusCode : 500;
  const errorCode = 'code' in err && typeof err.code === 'string' ? err.code : 'INTERNAL_SERVER_ERROR';

  // Registro de error interno sin exponer datos confidenciales a la respuesta cliente
  console.error(`[Error] [${req.method}] ${req.path} -> ${errorCode}: ${err.message}`);

  const isProduction = config.nodeEnv === 'production';

  const responsePayload: ApiResponseError = {
    error: {
      code: errorCode,
      // En producción enmascaramos mensajes de errores genéricos 500
      message: (statusCode >= 500 && isProduction)
        ? 'Ha ocurrido un error interno en el servidor.'
        : err.message || 'Error no especificado.',
      timestamp: new Date().toISOString(),
    },
  };

  res.status(statusCode).json(responsePayload);
}
