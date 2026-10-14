/**
 * API Forge - Router de Salud (Fase 0)
 * Implementa GET /api/health con diagnóstico completo de backend y SQLite.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { checkDatabaseHealth } from '../db/index.ts';
import { config } from '../config.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { HealthCheckResponse } from '../../packages/shared/types.ts';

export const healthRouter = Router();

const APP_VERSION = '0.1.0';
const SERVICE_NAME = 'api-forge';

/**
 * GET /api/health
 * Retorna el estado del servicio Express, tiempo de actividad y salud de SQLite
 */
healthRouter.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const dbHealth = await checkDatabaseHealth();

    const requiredTables = ['projects', 'api_endpoints', 'health_audit_logs'];
    const hasRequiredTables = requiredTables.every((t) => dbHealth.tablesVerified.includes(t));

    // El estado del servicio solo es 'ok' si la DB está conectada, con claves foráneas activas y tablas esenciales presentes
    const isHealthy = dbHealth.status === 'connected' && dbHealth.foreignKeys === true && hasRequiredTables;

    const payload: HealthCheckResponse = {
      status: isHealthy ? 'ok' : 'degraded',
      service: SERVICE_NAME,
      version: APP_VERSION,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      nodeVersion: process.version,
      database: dbHealth,
    };

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/health/error-simulation
 * Endpoint de prueba para verificar el manejo centralizado de excepciones sin exponer secretos
 */
healthRouter.get('/health/error-simulation', (_req: Request, _res: Response, next: NextFunction) => {
  try {
    throw new AppError('Simulación de error controlado para verificación del middleware.', 400, 'ERR_SIMULATION');
  } catch (err) {
    next(err);
  }
});
