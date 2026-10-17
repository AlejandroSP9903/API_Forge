/**
 * API Forge - Router de Entornos y Variables (Fase 1E)
 * Expone endpoints REST para CRUD de entornos de ejecución.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  listEnvironments,
  getEnvironmentById,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  EnvironmentError,
} from '../services/environmentsService.ts';

export const environmentsRouter = Router();

/**
 * GET /api/environments
 * Lista todos los entornos con su conteo de variables
 */
environmentsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await listEnvironments();
    res.json(list);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/environments
 * Crea un nuevo entorno
 */
environmentsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await createEnvironment(req.body);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof EnvironmentError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
    next(error);
  }
});

/**
 * GET /api/environments/:id
 * Retorna un entorno específico con sus variables
 */
environmentsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const env = await getEnvironmentById(req.params.id);
    if (!env) {
      return res.status(404).json({
        error: {
          code: 'ENVIRONMENT_NOT_FOUND',
          message: `El entorno con ID '${req.params.id}' no fue encontrado.`,
          timestamp: new Date().toISOString(),
        },
      });
    }
    res.json(env);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/environments/:id
 * Actualiza nombre, descripción o variables de un entorno
 */
environmentsRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await updateEnvironment(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    if (error instanceof EnvironmentError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
    next(error);
  }
});

/**
 * DELETE /api/environments/:id
 * Elimina un entorno
 */
environmentsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteEnvironment(req.params.id);
    res.json({ success: true, message: 'Entorno eliminado exitosamente.' });
  } catch (error) {
    if (error instanceof EnvironmentError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
    next(error);
  }
});
