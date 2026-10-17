/**
 * API Forge - Servicio de Entornos en Backend (Fase 1E)
 * Gestiona entornos y variables persistidos en SQLite mediante Drizzle ORM.
 */

import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import { environments, type Environment } from '../db/schema.ts';
import type {
  EnvironmentSummary,
  EnvironmentData,
  EnvironmentVariable,
  CreateEnvironmentPayload,
  UpdateEnvironmentPayload,
} from '../../packages/shared/types.ts';

export class EnvironmentError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'ENVIRONMENT_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Normaliza y valida una lista de variables de entorno
 */
function sanitizeVariablesList(rawVars: unknown): EnvironmentVariable[] {
  if (!Array.isArray(rawVars)) {
    return [];
  }

  const result: EnvironmentVariable[] = [];
  for (const item of rawVars) {
    if (item && typeof item === 'object') {
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!name) continue; // Ignorar variables sin nombre

      const value = typeof item.value === 'string' ? item.value : String(item.value ?? '');
      const id = typeof item.id === 'string' && item.id.trim()
        ? item.id.trim()
        : `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const isSecret = Boolean(item.isSecret);

      result.push({ id, name, value, isSecret });
    }
  }

  return result;
}

/**
 * Mapea una fila de base de datos a EnvironmentData
 */
function mapEnvironmentRow(row: Environment): EnvironmentData {
  let parsedVariables: EnvironmentVariable[] = [];
  if (row.variables) {
    try {
      parsedVariables = sanitizeVariablesList(JSON.parse(row.variables));
    } catch {
      parsedVariables = [];
    }
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    variables: parsedVariables,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Lista todos los entornos con su conteo de variables
 */
export async function listEnvironments(): Promise<EnvironmentSummary[]> {
  const db = await getDb();
  const rows = await db.select().from(environments).orderBy(desc(environments.createdAt));

  return rows.map((row) => {
    let count = 0;
    if (row.variables) {
      try {
        const parsed = JSON.parse(row.variables);
        count = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        count = 0;
      }
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description || null,
      variablesCount: count,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  });
}

/**
 * Retorna un entorno por ID con todas sus variables
 */
export async function getEnvironmentById(id: string): Promise<EnvironmentData | null> {
  const db = await getDb();
  const rows = await db.select().from(environments).where(eq(environments.id, id));

  if (rows.length === 0) {
    return null;
  }

  return mapEnvironmentRow(rows[0]);
}

/**
 * Crea un nuevo entorno de ejecución
 */
export async function createEnvironment(payload: CreateEnvironmentPayload): Promise<EnvironmentData> {
  if (!payload || typeof payload !== 'object') {
    throw new EnvironmentError('El cuerpo de la solicitud debe ser un objeto JSON válido.', 400, 'INVALID_PAYLOAD');
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) {
    throw new EnvironmentError('El nombre del entorno es obligatorio y no puede estar vacío.', 400, 'EMPTY_NAME');
  }

  if (name.length > 100) {
    throw new EnvironmentError('El nombre del entorno no puede superar los 100 caracteres.', 400, 'NAME_TOO_LONG');
  }

  const description = typeof payload.description === 'string' && payload.description.trim() !== ''
    ? payload.description.trim()
    : null;

  const sanitizedVars = sanitizeVariablesList(payload.variables);
  const now = new Date();
  const id = `env_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const db = await getDb();
  await db.insert(environments).values({
    id,
    name,
    description,
    variables: JSON.stringify(sanitizedVars),
    createdAt: now,
    updatedAt: now,
  });

  const row = (await db.select().from(environments).where(eq(environments.id, id)))[0];
  return mapEnvironmentRow(row);
}

/**
 * Actualiza nombre, descripción o variables de un entorno existente
 */
export async function updateEnvironment(
  id: string,
  payload: UpdateEnvironmentPayload
): Promise<EnvironmentData> {
  const db = await getDb();
  const existing = await getEnvironmentById(id);
  if (!existing) {
    throw new EnvironmentError(`No se encontró el entorno con ID '${id}'.`, 404, 'NOT_FOUND');
  }

  const updateValues: Partial<Environment> = {
    updatedAt: new Date(),
  };

  if (payload.name !== undefined) {
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name) {
      throw new EnvironmentError('El nombre del entorno no puede estar vacío.', 400, 'EMPTY_NAME');
    }
    if (name.length > 100) {
      throw new EnvironmentError('El nombre del entorno no puede superar los 100 caracteres.', 400, 'NAME_TOO_LONG');
    }
    updateValues.name = name;
  }

  if (payload.description !== undefined) {
    updateValues.description = typeof payload.description === 'string' && payload.description.trim() !== ''
      ? payload.description.trim()
      : null;
  }

  if (payload.variables !== undefined) {
    const sanitizedVars = sanitizeVariablesList(payload.variables);
    updateValues.variables = JSON.stringify(sanitizedVars);
  }

  await db.update(environments).set(updateValues).where(eq(environments.id, id));

  const updatedRow = (await db.select().from(environments).where(eq(environments.id, id)))[0];
  return mapEnvironmentRow(updatedRow);
}

/**
 * Elimina un entorno por ID
 */
export async function deleteEnvironment(id: string): Promise<void> {
  const db = await getDb();
  const existing = await db.select().from(environments).where(eq(environments.id, id));
  if (existing.length === 0) {
    throw new EnvironmentError(`No se encontró el entorno con ID '${id}'.`, 404, 'NOT_FOUND');
  }

  await db.delete(environments).where(eq(environments.id, id));
}
