/**
 * API Forge - Router de Colecciones de Solicitudes (Fase 1D)
 * Expone endpoints REST para CRUD de colecciones y solicitudes guardadas.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  listCollections,
  getCollectionById,
  createCollection,
  updateCollection,
  deleteCollection,
  createSavedRequest,
  updateSavedRequest,
  deleteSavedRequest,
  CollectionError,
} from '../services/collectionsService.ts';

export const collectionsRouter = Router();

/**
 * GET /api/collections
 * Lista todas las colecciones con conteo de solicitudes
 */
collectionsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listCollections();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/collections
 * Crea una nueva colección
 */
collectionsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await createCollection(req.body);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof CollectionError) {
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
 * GET /api/collections/:id
 * Retorna una colección con sus solicitudes guardadas
 */
collectionsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collection = await getCollectionById(req.params.id);
    if (!collection) {
      return res.status(404).json({
        error: {
          code: 'COLLECTION_NOT_FOUND',
          message: `La colección con ID '${req.params.id}' no fue encontrada.`,
          timestamp: new Date().toISOString(),
        },
      });
    }
    res.json(collection);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/collections/:id
 * Actualiza nombre o descripción de una colección
 */
collectionsRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await updateCollection(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    if (error instanceof CollectionError) {
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
 * DELETE /api/collections/:id
 * Elimina una colección y todas sus solicitudes asociadas
 */
collectionsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteCollection(req.params.id);
    res.json({ success: true, message: 'Colección eliminada exitosamente.' });
  } catch (error) {
    if (error instanceof CollectionError) {
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
 * POST /api/collections/:id/requests
 * Guarda una nueva solicitud dentro de la colección
 */
collectionsRouter.post('/:id/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const saved = await createSavedRequest(req.params.id, req.body);
    res.status(201).json(saved);
  } catch (error) {
    if (error instanceof CollectionError) {
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
 * PUT /api/collections/:collectionId/requests/:requestId
 * Actualiza una solicitud existente dentro de una colección
 */
collectionsRouter.put(
  '/:collectionId/requests/:requestId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await updateSavedRequest(req.params.collectionId, req.params.requestId, req.body);
      res.json(updated);
    } catch (error) {
      if (error instanceof CollectionError) {
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
  }
);

/**
 * DELETE /api/collections/:collectionId/requests/:requestId
 * Elimina una solicitud guardada de una colección
 */
collectionsRouter.delete(
  '/:collectionId/requests/:requestId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteSavedRequest(req.params.collectionId, req.params.requestId);
      res.json({ success: true, message: 'Solicitud eliminada exitosamente de la colección.' });
    } catch (error) {
      if (error instanceof CollectionError) {
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
  }
);
