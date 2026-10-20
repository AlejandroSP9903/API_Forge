/**
 * API Forge - Servicio de Proyectos en Backend (Fase 2A)
 * Gestiona proyectos persistidos en SQLite mediante Drizzle ORM
 * y su relación con las colecciones existentes sin alterar saved_requests.
 */

import { eq, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import { projects, collections, savedRequests, type Project, type Collection } from '../db/schema.ts';
import type {
  ProjectSummary,
  ProjectWithCollections,
  CollectionSummary,
  CreateProjectPayload,
  UpdateProjectPayload,
} from '../../packages/shared/types.ts';

export class ProjectError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'PROJECT_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Retorna todos los proyectos ordenados por fecha de creación descendente
 * con el conteo de colecciones asociadas
 */
export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt), desc(projects.id));

  const summaries: ProjectSummary[] = [];
  for (const row of rows) {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(collections)
      .where(eq(collections.projectId, row.id));

    const collectionsCount = Number(countResult[0]?.count || 0);

    summaries.push({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      collectionsCount,
    });
  }

  return summaries;
}

/**
 * Retorna un proyecto por ID con sus colecciones asociadas
 */
export async function getProjectById(id: string): Promise<ProjectWithCollections | null> {
  const db = await getDb();
  const projRows = await db.select().from(projects).where(eq(projects.id, id));

  if (projRows.length === 0) {
    return null;
  }

  const proj = projRows[0];
  const colRows = await db
    .select()
    .from(collections)
    .where(eq(collections.projectId, id))
    .orderBy(desc(collections.createdAt));

  const mappedCollections: CollectionSummary[] = [];
  for (const col of colRows) {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedRequests)
      .where(eq(savedRequests.collectionId, col.id));

    mappedCollections.push({
      id: col.id,
      name: col.name,
      description: col.description,
      projectId: col.projectId,
      createdAt: new Date(col.createdAt).toISOString(),
      updatedAt: new Date(col.updatedAt).toISOString(),
      requestsCount: Number(countResult[0]?.count || 0),
    });
  }

  return {
    id: proj.id,
    name: proj.name,
    description: proj.description,
    createdAt: new Date(proj.createdAt).toISOString(),
    updatedAt: proj.updatedAt ? new Date(proj.updatedAt).toISOString() : null,
    collectionsCount: mappedCollections.length,
    collections: mappedCollections,
  };
}

/**
 * Crea un nuevo proyecto en SQLite
 */
export async function createProject(payload: CreateProjectPayload): Promise<ProjectSummary> {
  if (!payload || typeof payload !== 'object') {
    throw new ProjectError('El cuerpo de la solicitud debe ser un objeto JSON válido.', 400, 'INVALID_PAYLOAD');
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) {
    throw new ProjectError('El nombre del proyecto es obligatorio y no puede estar vacío.', 400, 'EMPTY_NAME');
  }

  if (name.length > 100) {
    throw new ProjectError('El nombre del proyecto no puede superar los 100 caracteres.', 400, 'NAME_TOO_LONG');
  }

  const description =
    typeof payload.description === 'string' && payload.description.trim() !== ''
      ? payload.description.trim()
      : null;

  if (description && description.length > 500) {
    throw new ProjectError('La descripción del proyecto no puede superar los 500 caracteres.', 400, 'DESCRIPTION_TOO_LONG');
  }

  const now = new Date();
  const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const db = await getDb();
  await db.insert(projects).values({
    id,
    name,
    description,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    name,
    description,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    collectionsCount: 0,
  };
}

/**
 * Actualiza nombre y/o descripción de un proyecto existente
 */
export async function updateProject(
  id: string,
  payload: UpdateProjectPayload
): Promise<ProjectSummary> {
  if (!payload || typeof payload !== 'object') {
    throw new ProjectError('El cuerpo de la solicitud debe ser un objeto JSON válido.', 400, 'INVALID_PAYLOAD');
  }

  const db = await getDb();
  const existing = await getProjectById(id);
  if (!existing) {
    throw new ProjectError(`No se encontró el proyecto con ID '${id}'.`, 404, 'PROJECT_NOT_FOUND');
  }

  const updateValues: Partial<Project> = {
    updatedAt: new Date(),
  };

  if (payload.name !== undefined) {
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name) {
      throw new ProjectError('El nombre del proyecto no puede estar vacío.', 400, 'EMPTY_NAME');
    }
    if (name.length > 100) {
      throw new ProjectError('El nombre del proyecto no puede superar los 100 caracteres.', 400, 'NAME_TOO_LONG');
    }
    updateValues.name = name;
  }

  if (payload.description !== undefined) {
    const descStr = typeof payload.description === 'string' ? payload.description.trim() : '';
    if (descStr.length > 500) {
      throw new ProjectError('La descripción del proyecto no puede superar los 500 caracteres.', 400, 'DESCRIPTION_TOO_LONG');
    }
    updateValues.description = descStr ? descStr : null;
  }

  await db.update(projects).set(updateValues).where(eq(projects.id, id));

  const updated = await getProjectById(id);
  return {
    id: updated!.id,
    name: updated!.name,
    description: updated!.description,
    createdAt: updated!.createdAt,
    updatedAt: updated!.updatedAt,
    collectionsCount: updated!.collectionsCount,
  };
}

/**
 * Elimina un proyecto de forma segura.
 * Las colecciones asociadas se conservan y quedan desasociadas (project_id = null).
 * Las solicitudes guardadas de las colecciones se conservan intactas.
 */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  const existing = await getProjectById(id);
  if (!existing) {
    throw new ProjectError(`No se encontró el proyecto con ID '${id}'.`, 404, 'PROJECT_NOT_FOUND');
  }

  // 1. Desasociar todas las colecciones vinculadas a este proyecto
  await db
    .update(collections)
    .set({
      projectId: null,
      updatedAt: new Date(),
    })
    .where(eq(collections.projectId, id));

  // 2. Eliminar el proyecto
  await db.delete(projects).where(eq(projects.id, id));
}

/**
 * Retorna las colecciones que pertenecen a un proyecto
 */
export async function getProjectCollections(projectId: string): Promise<CollectionSummary[]> {
  const db = await getDb();
  const existing = await getProjectById(projectId);
  if (!existing) {
    throw new ProjectError(`No se encontró el proyecto con ID '${projectId}'.`, 404, 'PROJECT_NOT_FOUND');
  }

  const colRows = await db
    .select()
    .from(collections)
    .where(eq(collections.projectId, projectId))
    .orderBy(desc(collections.createdAt));

  const result: CollectionSummary[] = [];
  for (const col of colRows) {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedRequests)
      .where(eq(savedRequests.collectionId, col.id));

    result.push({
      id: col.id,
      name: col.name,
      description: col.description,
      projectId: col.projectId,
      createdAt: new Date(col.createdAt).toISOString(),
      updatedAt: new Date(col.updatedAt).toISOString(),
      requestsCount: Number(countResult[0]?.count || 0),
    });
  }

  return result;
}

/**
 * Asocia una colección existente a un proyecto.
 * Valida la existencia de ambos.
 * Si la colección ya pertenece a otro proyecto, arroja error 409 COLLECTION_ALREADY_ASSIGNED.
 */
export async function associateCollectionToProject(
  projectId: string,
  collectionId: string
): Promise<CollectionSummary> {
  if (!collectionId || typeof collectionId !== 'string' || !collectionId.trim()) {
    throw new ProjectError('El ID de la colección es obligatorio.', 400, 'INVALID_COLLECTION_ID');
  }

  const cleanCollectionId = collectionId.trim();

  const db = await getDb();

  // 1. Validar existencia del proyecto
  const projRows = await db.select().from(projects).where(eq(projects.id, projectId));
  if (projRows.length === 0) {
    throw new ProjectError(`No se encontró el proyecto con ID '${projectId}'.`, 404, 'PROJECT_NOT_FOUND');
  }

  // 2. Validar existencia de la colección
  const colRows = await db.select().from(collections).where(eq(collections.id, cleanCollectionId));
  if (colRows.length === 0) {
    throw new ProjectError(`No se encontró la colección con ID '${cleanCollectionId}'.`, 404, 'COLLECTION_NOT_FOUND');
  }

  const targetCol = colRows[0];

  // 3. Validar si ya está vinculada a otro proyecto
  if (targetCol.projectId && targetCol.projectId !== projectId) {
    throw new ProjectError(
      `La colección '${targetCol.name}' ya pertenece al proyecto '${targetCol.projectId}'. Desasóciala primero antes de vincularla a otro proyecto.`,
      409,
      'COLLECTION_ALREADY_ASSIGNED'
    );
  }

  // Si ya pertenece a este proyecto, operación idempotente
  if (targetCol.projectId === projectId) {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedRequests)
      .where(eq(savedRequests.collectionId, targetCol.id));

    return {
      id: targetCol.id,
      name: targetCol.name,
      description: targetCol.description,
      projectId: targetCol.projectId,
      createdAt: new Date(targetCol.createdAt).toISOString(),
      updatedAt: new Date(targetCol.updatedAt).toISOString(),
      requestsCount: Number(countResult[0]?.count || 0),
    };
  }

  // 4. Asociar la colección al proyecto
  const now = new Date();
  await db
    .update(collections)
    .set({
      projectId,
      updatedAt: now,
    })
    .where(eq(collections.id, cleanCollectionId));

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(savedRequests)
    .where(eq(savedRequests.collectionId, cleanCollectionId));

  return {
    id: targetCol.id,
    name: targetCol.name,
    description: targetCol.description,
    projectId,
    createdAt: new Date(targetCol.createdAt).toISOString(),
    updatedAt: now.toISOString(),
    requestsCount: Number(countResult[0]?.count || 0),
  };
}

/**
 * Desasocia una colección de un proyecto.
 * La colección y sus solicitudes guardadas se conservan intactas.
 */
export async function dissociateCollectionFromProject(
  projectId: string,
  collectionId: string
): Promise<void> {
  if (!collectionId || typeof collectionId !== 'string' || !collectionId.trim()) {
    throw new ProjectError('El ID de la colección es obligatorio.', 400, 'INVALID_COLLECTION_ID');
  }

  const cleanCollectionId = collectionId.trim();

  const db = await getDb();

  // 1. Validar existencia del proyecto
  const projRows = await db.select().from(projects).where(eq(projects.id, projectId));
  if (projRows.length === 0) {
    throw new ProjectError(`No se encontró el proyecto con ID '${projectId}'.`, 404, 'PROJECT_NOT_FOUND');
  }

  // 2. Validar existencia de la colección
  const colRows = await db.select().from(collections).where(eq(collections.id, cleanCollectionId));
  if (colRows.length === 0) {
    throw new ProjectError(`No se encontró la colección con ID '${cleanCollectionId}'.`, 404, 'COLLECTION_NOT_FOUND');
  }

  const targetCol = colRows[0];

  // 3. Validar que la colección realmente pertenece a este proyecto
  if (targetCol.projectId !== projectId) {
    throw new ProjectError(
      `La colección '${targetCol.name}' no está asociada al proyecto con ID '${projectId}'.`,
      400,
      'COLLECTION_NOT_ASSOCIATED'
    );
  }

  // 4. Desasociar (set project_id = null)
  await db
    .update(collections)
    .set({
      projectId: null,
      updatedAt: new Date(),
    })
    .where(eq(collections.id, cleanCollectionId));
}
