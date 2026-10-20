/**
 * API Forge - Router de Proyectos (Fase 2A)
 * Expone endpoints REST para CRUD de proyectos y asociación con colecciones.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectCollections,
  associateCollectionToProject,
  dissociateCollectionFromProject,
  ProjectError,
} from '../services/projectsService.ts';

export const projectsRouter = Router();

/**
 * GET /api/projects
 * Lista todos los proyectos con su conteo de colecciones
 */
projectsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await listProjects();
    res.json(list);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects
 * Crea un nuevo proyecto
 */
projectsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await createProject(req.body);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof ProjectError) {
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
 * GET /api/projects/:id
 * Retorna un proyecto con sus colecciones asociadas
 */
projectsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: `El proyecto con ID '${req.params.id}' no fue encontrado.`,
          timestamp: new Date().toISOString(),
        },
      });
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/projects/:id
 * Actualiza nombre o descripción de un proyecto
 */
projectsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await updateProject(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    if (error instanceof ProjectError) {
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
 * PUT /api/projects/:id
 * Alias de actualización para compatibilidad REST
 */
projectsRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await updateProject(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    if (error instanceof ProjectError) {
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
 * DELETE /api/projects/:id
 * Elimina un proyecto de forma segura sin borrar colecciones ni solicitudes
 */
projectsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteProject(req.params.id);
    res.status(200).json({
      success: true,
      message: `El proyecto '${req.params.id}' fue eliminado exitosamente. Sus colecciones permanecen disponibles.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ProjectError) {
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
 * GET /api/projects/:id/collections
 * Lista las colecciones asociadas a un proyecto
 */
projectsRouter.get('/:id/collections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collections = await getProjectCollections(req.params.id);
    res.json(collections);
  } catch (error) {
    if (error instanceof ProjectError) {
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
 * POST /api/projects/:id/collections
 * Asocia una colección existente al proyecto
 */
projectsRouter.post('/:id/collections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionId = req.body?.collectionId;
    const result = await associateCollectionToProject(req.params.id, collectionId);
    res.status(200).json({
      success: true,
      message: `Colección '${result.name}' asociada exitosamente al proyecto.`,
      collection: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ProjectError) {
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
 * DELETE /api/projects/:id/collections/:collectionId
 * Desasocia una colección del proyecto sin eliminarla
 */
projectsRouter.delete('/:id/collections/:collectionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await dissociateCollectionFromProject(req.params.id, req.params.collectionId);
    res.status(200).json({
      success: true,
      message: `Colección '${req.params.collectionId}' desasociada exitosamente del proyecto.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ProjectError) {
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
