/**
 * API Forge - Router de Ejecución de Solicitudes (Fase 1A)
 * Expone POST /api/requests/execute con validación de entrada y control de seguridad.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { defaultHttpEngine } from '../engine/httpEngine.ts';
import type { ExecuteRequestPayload } from '../../packages/shared/types.ts';

export const requestsRouter = Router();

/**
 * POST /api/requests/execute
 * Ejecuta una petición HTTP a través del motor seguro de API Forge
 */
requestsRouter.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body as Partial<ExecuteRequestPayload>;

    // 1. Validar que el cuerpo sea un objeto válido
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'El cuerpo de la solicitud debe ser un objeto JSON válido.',
        },
        timing: {
          durationMs: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      });
    }

    // 2. Validar URL presente
    if (!payload.url || typeof payload.url !== 'string' || payload.url.trim() === '') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'El campo "url" es obligatorio y debe ser una cadena válida.',
        },
        timing: {
          durationMs: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      });
    }

    // 3. Crear AbortController vinculado al cierre de la conexión del cliente Express
    const clientAbortController = new AbortController();
    req.on('close', () => {
      if (!res.writableEnded) {
        clientAbortController.abort();
      }
    });

    // 4. Filtrar estrictamente la carga útil para no permitir banderas de seguridad no autorizadas
    const cleanDefinition: ExecuteRequestPayload = {
      url: payload.url.trim(),
      method: payload.method,
      headers: payload.headers,
      queryParams: payload.queryParams,
      body: payload.body,
      timeoutMs: payload.timeoutMs,
      maxResponseSizeBytes: payload.maxResponseSizeBytes,
      maxRedirects: payload.maxRedirects,
    };

    // 5. Ejecutar la solicitud a través del motor HTTP con política de seguridad estricta por defecto
    const result = await defaultHttpEngine.execute(cleanDefinition, clientAbortController.signal);

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
