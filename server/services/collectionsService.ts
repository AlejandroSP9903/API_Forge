/**
 * API Forge - Servicio de Colecciones en Backend (Fase 1D)
 * Gestiona colecciones de solicitudes HTTP persistidas en SQLite mediante Drizzle ORM,
 * aplicando sanitización obligatoria de credenciales y validaciones de integridad.
 */

import { eq, desc, asc, sql } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import { collections, savedRequests, type Collection, type SavedRequest } from '../db/schema.ts';
import type {
  HttpMethod,
  CollectionSummary,
  CollectionWithRequests,
  SavedRequestData,
  CreateCollectionPayload,
  UpdateCollectionPayload,
  CreateSavedRequestPayload,
  UpdateSavedRequestPayload,
  RequestAuthConfig,
} from '../../packages/shared/types.ts';
import {
  sanitizeUrl,
  sanitizeHeaders,
  sanitizeQueryParams,
  sanitizeBody,
  sanitizeAuth,
  hasProtectedSecrets,
} from '../../src/services/historySecurityService.ts';

const ALLOWED_METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export class CollectionError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'COLLECTION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Mapea una fila de base de datos a SavedRequestData
 */
function mapSavedRequestRow(row: SavedRequest): SavedRequestData {
  let parsedHeaders: Record<string, string> | undefined = undefined;
  if (row.headers) {
    try {
      parsedHeaders = JSON.parse(row.headers);
    } catch {
      parsedHeaders = undefined;
    }
  }

  let parsedParams: Record<string, string | number | boolean> | undefined = undefined;
  if (row.queryParams) {
    try {
      parsedParams = JSON.parse(row.queryParams);
    } catch {
      parsedParams = undefined;
    }
  }

  let parsedBody: string | object | null = row.body ?? null;
  if (row.body && (row.body.trim().startsWith('{') || row.body.trim().startsWith('['))) {
    try {
      parsedBody = JSON.parse(row.body);
    } catch {
      parsedBody = row.body;
    }
  }

  let parsedAuth: RequestAuthConfig | undefined = undefined;
  if (row.auth) {
    try {
      parsedAuth = JSON.parse(row.auth);
    } catch {
      parsedAuth = undefined;
    }
  }

  const payloadForSecretCheck = {
    url: row.url,
    method: row.method as HttpMethod,
    headers: parsedHeaders,
    queryParams: parsedParams,
    body: parsedBody,
    auth: parsedAuth,
  };

  return {
    id: row.id,
    collectionId: row.collectionId,
    name: row.name,
    method: row.method as HttpMethod,
    url: row.url,
    headers: parsedHeaders,
    queryParams: parsedParams,
    body: parsedBody,
    auth: parsedAuth,
    contentType: row.contentType || undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    hasProtectedSecrets: hasProtectedSecrets(payloadForSecretCheck),
  };
}

/**
 * Retorna todas las colecciones con el conteo de solicitudes guardadas
 */
export async function listCollections(): Promise<CollectionSummary[]> {
  const db = await getDb();
  const rows = await db.select().from(collections).orderBy(desc(collections.createdAt));

  // Obtener conteo de solicitudes por cada colección
  const summaries: CollectionSummary[] = [];
  for (const row of rows) {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedRequests)
      .where(eq(savedRequests.collectionId, row.id));

    const requestsCount = Number(countResult[0]?.count || 0);

    summaries.push({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      requestsCount,
    });
  }

  return summaries;
}

/**
 * Retorna una colección por ID con todas sus solicitudes guardadas
 */
export async function getCollectionById(id: string): Promise<CollectionWithRequests | null> {
  const db = await getDb();
  const colRows = await db.select().from(collections).where(eq(collections.id, id));

  if (colRows.length === 0) {
    return null;
  }

  const col = colRows[0];
  const reqRows = await db
    .select()
    .from(savedRequests)
    .where(eq(savedRequests.collectionId, id))
    .orderBy(asc(savedRequests.createdAt));

  const mappedRequests = reqRows.map(mapSavedRequestRow);

  return {
    id: col.id,
    name: col.name,
    description: col.description,
    createdAt: new Date(col.createdAt).toISOString(),
    updatedAt: new Date(col.updatedAt).toISOString(),
    requestsCount: mappedRequests.length,
    requests: mappedRequests,
  };
}

/**
 * Crea una nueva colección
 */
export async function createCollection(payload: CreateCollectionPayload): Promise<CollectionSummary> {
  if (!payload || typeof payload !== 'object') {
    throw new CollectionError('El cuerpo de la solicitud debe ser un objeto JSON válido.', 400, 'INVALID_PAYLOAD');
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) {
    throw new CollectionError('El nombre de la colección es obligatorio y no puede estar vacío.', 400, 'EMPTY_NAME');
  }

  if (name.length > 100) {
    throw new CollectionError('El nombre de la colección no puede superar los 100 caracteres.', 400, 'NAME_TOO_LONG');
  }

  const description = typeof payload.description === 'string' && payload.description.trim() !== ''
    ? payload.description.trim()
    : null;

  const now = new Date();
  const id = `col_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const db = await getDb();
  await db.insert(collections).values({
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
    requestsCount: 0,
  };
}

/**
 * Actualiza nombre y/o descripción de una colección
 */
export async function updateCollection(
  id: string,
  payload: UpdateCollectionPayload
): Promise<CollectionSummary> {
  const db = await getDb();
  const existing = await getCollectionById(id);
  if (!existing) {
    throw new CollectionError(`No se encontró la colección con ID '${id}'.`, 404, 'NOT_FOUND');
  }

  const updateValues: Partial<Collection> = {
    updatedAt: new Date(),
  };

  if (payload.name !== undefined) {
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name) {
      throw new CollectionError('El nombre de la colección no puede estar vacío.', 400, 'EMPTY_NAME');
    }
    if (name.length > 100) {
      throw new CollectionError('El nombre de la colección no puede superar los 100 caracteres.', 400, 'NAME_TOO_LONG');
    }
    updateValues.name = name;
  }

  if (payload.description !== undefined) {
    updateValues.description = typeof payload.description === 'string' && payload.description.trim() !== ''
      ? payload.description.trim()
      : null;
  }

  await db.update(collections).set(updateValues).where(eq(collections.id, id));

  const updated = await getCollectionById(id);
  return {
    id: updated!.id,
    name: updated!.name,
    description: updated!.description,
    createdAt: updated!.createdAt,
    updatedAt: updated!.updatedAt,
    requestsCount: updated!.requestsCount,
  };
}

/**
 * Elimina una colección (y sus solicitudes en cascada)
 */
export async function deleteCollection(id: string): Promise<void> {
  const db = await getDb();
  const existing = await db.select().from(collections).where(eq(collections.id, id));
  if (existing.length === 0) {
    throw new CollectionError(`No se encontró la colección con ID '${id}'.`, 404, 'NOT_FOUND');
  }

  await db.delete(collections).where(eq(collections.id, id));
}

/**
 * Guarda una nueva solicitud dentro de una colección con sanitización de credenciales
 */
export async function createSavedRequest(
  collectionId: string,
  payload: CreateSavedRequestPayload
): Promise<SavedRequestData> {
  const db = await getDb();
  const colExists = await db.select().from(collections).where(eq(collections.id, collectionId));
  if (colExists.length === 0) {
    throw new CollectionError(`La colección con ID '${collectionId}' no existe.`, 404, 'COLLECTION_NOT_FOUND');
  }

  if (!payload || typeof payload !== 'object') {
    throw new CollectionError('El cuerpo de la solicitud debe ser un objeto JSON válido.', 400, 'INVALID_PAYLOAD');
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) {
    throw new CollectionError('El nombre de la solicitud es obligatorio y no puede estar vacío.', 400, 'EMPTY_NAME');
  }

  const rawMethod = (payload.method || 'GET').toUpperCase() as HttpMethod;
  if (!ALLOWED_METHODS.includes(rawMethod)) {
    throw new CollectionError(
      `Método HTTP '${rawMethod}' no admitido. Admitidos: ${ALLOWED_METHODS.join(', ')}`,
      400,
      'INVALID_METHOD'
    );
  }

  const rawUrl = typeof payload.url === 'string' ? payload.url.trim() : '';
  if (!rawUrl) {
    throw new CollectionError('La URL de la solicitud es obligatoria.', 400, 'EMPTY_URL');
  }

  // 1. Sanitización de seguridad OBLIGATORIA
  const { sanitizedUrl } = sanitizeUrl(rawUrl);
  const { sanitizedHeaders } = sanitizeHeaders(payload.headers);
  const { sanitizedParams } = sanitizeQueryParams(payload.queryParams);
  const { sanitizedBody } = sanitizeBody(payload.body);
  const { sanitizedAuth } = sanitizeAuth(payload.auth);

  const now = new Date();
  const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const serializedHeaders = sanitizedHeaders ? JSON.stringify(sanitizedHeaders) : null;
  const serializedParams = sanitizedParams ? JSON.stringify(sanitizedParams) : null;
  const serializedBody = sanitizedBody !== undefined && sanitizedBody !== null
    ? (typeof sanitizedBody === 'object' ? JSON.stringify(sanitizedBody) : String(sanitizedBody))
    : null;
  const serializedAuth = sanitizedAuth ? JSON.stringify(sanitizedAuth) : null;

  await db.insert(savedRequests).values({
    id,
    collectionId,
    name,
    method: rawMethod,
    url: sanitizedUrl,
    headers: serializedHeaders,
    queryParams: serializedParams,
    body: serializedBody,
    auth: serializedAuth,
    contentType: payload.contentType || (sanitizedHeaders ? sanitizedHeaders['content-type'] : null),
    createdAt: now,
    updatedAt: now,
  });

  // Actualizar también timestamp de la colección padre
  await db.update(collections).set({ updatedAt: now }).where(eq(collections.id, collectionId));

  const row = (await db.select().from(savedRequests).where(eq(savedRequests.id, id)))[0];
  return mapSavedRequestRow(row);
}

/**
 * Actualiza una solicitud guardada dentro de una colección
 */
export async function updateSavedRequest(
  collectionId: string,
  requestId: string,
  payload: UpdateSavedRequestPayload
): Promise<SavedRequestData> {
  const db = await getDb();
  const existingRows = await db
    .select()
    .from(savedRequests)
    .where(eq(savedRequests.id, requestId));

  if (existingRows.length === 0) {
    throw new CollectionError(`No se encontró la solicitud con ID '${requestId}'.`, 404, 'NOT_FOUND');
  }

  const existing = existingRows[0];
  if (existing.collectionId !== collectionId) {
    throw new CollectionError(`La solicitud '${requestId}' no pertenece a la colección '${collectionId}'.`, 400, 'COLLECTION_MISMATCH');
  }

  const now = new Date();
  const updateValues: Partial<SavedRequest> = {
    updatedAt: now,
  };

  if (payload.name !== undefined) {
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name) {
      throw new CollectionError('El nombre de la solicitud no puede estar vacío.', 400, 'EMPTY_NAME');
    }
    updateValues.name = name;
  }

  if (payload.method !== undefined) {
    const rawMethod = payload.method.toUpperCase() as HttpMethod;
    if (!ALLOWED_METHODS.includes(rawMethod)) {
      throw new CollectionError(`Método HTTP '${rawMethod}' no admitido.`, 400, 'INVALID_METHOD');
    }
    updateValues.method = rawMethod;
  }

  if (payload.url !== undefined) {
    const rawUrl = typeof payload.url === 'string' ? payload.url.trim() : '';
    if (!rawUrl) {
      throw new CollectionError('La URL de la solicitud no puede estar vacía.', 400, 'EMPTY_URL');
    }
    const { sanitizedUrl } = sanitizeUrl(rawUrl);
    updateValues.url = sanitizedUrl;
  }

  if (payload.headers !== undefined) {
    const { sanitizedHeaders } = sanitizeHeaders(payload.headers);
    updateValues.headers = sanitizedHeaders ? JSON.stringify(sanitizedHeaders) : null;
  }

  if (payload.queryParams !== undefined) {
    const { sanitizedParams } = sanitizeQueryParams(payload.queryParams);
    updateValues.queryParams = sanitizedParams ? JSON.stringify(sanitizedParams) : null;
  }

  if (payload.body !== undefined) {
    const { sanitizedBody } = sanitizeBody(payload.body);
    updateValues.body = sanitizedBody !== undefined && sanitizedBody !== null
      ? (typeof sanitizedBody === 'object' ? JSON.stringify(sanitizedBody) : String(sanitizedBody))
      : null;
  }

  if (payload.contentType !== undefined) {
    updateValues.contentType = payload.contentType;
  }

  if (payload.auth !== undefined) {
    const { sanitizedAuth } = sanitizeAuth(payload.auth);
    updateValues.auth = sanitizedAuth ? JSON.stringify(sanitizedAuth) : null;
  }

  await db.update(savedRequests).set(updateValues).where(eq(savedRequests.id, requestId));
  await db.update(collections).set({ updatedAt: now }).where(eq(collections.id, collectionId));

  const updatedRow = (await db.select().from(savedRequests).where(eq(savedRequests.id, requestId)))[0];
  return mapSavedRequestRow(updatedRow);
}

/**
 * Elimina una solicitud guardada de una colección
 */
export async function deleteSavedRequest(collectionId: string, requestId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.select().from(savedRequests).where(eq(savedRequests.id, requestId));

  if (existing.length === 0) {
    throw new CollectionError(`No se encontró la solicitud con ID '${requestId}'.`, 404, 'NOT_FOUND');
  }

  if (existing[0].collectionId !== collectionId) {
    throw new CollectionError(`La solicitud '${requestId}' no pertenece a la colección '${collectionId}'.`, 400, 'COLLECTION_MISMATCH');
  }

  await db.delete(savedRequests).where(eq(savedRequests.id, requestId));
  await db.update(collections).set({ updatedAt: new Date() }).where(eq(collections.id, collectionId));
}
