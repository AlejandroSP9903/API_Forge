/**
 * API Forge - Factoría de Aplicación Express (Fase 0)
 * Configura middleware base, routers de API y manejador de errores.
 */

import express, { type Express } from 'express';
import { healthRouter } from './routes/health.ts';
import { requestsRouter } from './routes/requests.ts';
import { collectionsRouter } from './routes/collections.ts';
import { environmentsRouter } from './routes/environments.ts';
import { errorHandler } from './middleware/errorHandler.ts';

export function createApp(): Express {
  const app = express();

  // Parsing JSON en el cuerpo de solicitudes
  app.use(express.json());

  // Rutas de API bajo el prefijo /api
  app.use('/api', healthRouter);
  app.use('/api/requests', requestsRouter);
  app.use('/api/collections', collectionsRouter);
  app.use('/api/environments', environmentsRouter);

  // Fallback 404 para cualquier ruta /api no coincidente (evita que caiga en Vite SPA middleware retornando HTML)
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      error: {
        code: 'API_ENDPOINT_NOT_FOUND',
        message: `Ruta API no encontrada: [${req.method}] ${req.path}`,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Manejador centralizado de errores
  app.use(errorHandler);

  return app;
}
