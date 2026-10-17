/**
 * API Forge - Servicio de Variables y Entornos (Fase 1E)
 * Motor de interpolación {{VARIABLE}} y cliente API para gestión de entornos en SQLite.
 */

import type {
  EnvironmentSummary,
  EnvironmentData,
  EnvironmentVariable,
  CreateEnvironmentPayload,
  UpdateEnvironmentPayload,
  ExecuteRequestPayload,
} from '../../packages/shared/types.ts';

const API_BASE = '/api/environments';
const STORAGE_KEY_ACTIVE_ENV = 'api_forge_active_environment_id_v1';

export class VariableInterpolationError extends Error {
  public readonly variableName: string;

  constructor(variableName: string, message?: string) {
    super(
      message ||
        `La variable '{{${variableName}}}' no está definida en el entorno activo. Configúrala en Entornos antes de ejecutar.`
    );
    this.name = 'VariableInterpolationError';
    this.variableName = variableName;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Retorna el ID del entorno activo guardado localmente
 */
export function getActiveEnvironmentId(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_ENV);
  } catch {
    return null;
  }
}

/**
 * Guarda el ID del entorno activo en localStorage
 */
export function setActiveEnvironmentId(id: string | null): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ENV, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_ENV);
    }
  } catch {
    // ignore
  }
}

/**
 * Cliente REST: Obtener lista de entornos
 */
export async function fetchEnvironments(): Promise<EnvironmentSummary[]> {
  const response = await fetch(API_BASE);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al obtener entornos.`);
  }
  return response.json();
}

/**
 * Cliente REST: Obtener entorno por ID
 */
export async function fetchEnvironmentById(id: string): Promise<EnvironmentData> {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al obtener detalles del entorno.`);
  }
  return response.json();
}

/**
 * Cliente REST: Crear un nuevo entorno
 */
export async function createEnvironmentApi(payload: CreateEnvironmentPayload): Promise<EnvironmentData> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al crear entorno.`);
  }
  return response.json();
}

/**
 * Cliente REST: Actualizar entorno
 */
export async function updateEnvironmentApi(
  id: string,
  payload: UpdateEnvironmentPayload
): Promise<EnvironmentData> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al actualizar entorno.`);
  }
  return response.json();
}

/**
 * Cliente REST: Eliminar entorno
 */
export async function deleteEnvironmentApi(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al eliminar entorno.`);
  }
}

/**
 * Expresión regular para detectar sintaxis {{VARIABLE}} o {{ VARIABLE }}
 */
export const VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g;

/**
 * Interpola un texto plano reemplazando {{NOMBRE}} por su valor
 * Lanza VariableInterpolationError si la variable no existe en el mapa
 */
export function interpolateString(
  text: string,
  variablesMap: Map<string, string>,
  tracker?: { resolvedCount: number; secretVarsUsed: Set<string>; secretNames: Set<string> }
): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  return text.replace(VARIABLE_REGEX, (match, varNameRaw) => {
    const varName = varNameRaw.trim();
    if (!variablesMap.has(varName)) {
      throw new VariableInterpolationError(varName);
    }

    const value = variablesMap.get(varName) ?? '';
    if (tracker) {
      tracker.resolvedCount++;
      if (tracker.secretNames.has(varName)) {
        tracker.secretVarsUsed.add(varName);
      }
    }
    return value;
  });
}

export interface InterpolationResult {
  interpolatedPayload: ExecuteRequestPayload;
  resolvedCount: number;
  secretVarsUsed: string[];
}

/**
 * Interpola de forma segura una solicitud HTTP completa (URL, encabezados, queryParams y cuerpo)
 * sin modificar jamás el payload original de la plantilla.
 */
export function interpolateRequest(
  originalPayload: ExecuteRequestPayload,
  variables: EnvironmentVariable[] = []
): InterpolationResult {
  // Construir mapa de variables (respetando nombre exacto)
  const variablesMap = new Map<string, string>();
  const secretNames = new Set<string>();

  for (const v of variables) {
    const cleanName = (v.name || '').trim();
    if (cleanName) {
      variablesMap.set(cleanName, v.value ?? '');
      if (v.isSecret) {
        secretNames.add(cleanName);
      }
    }
  }

  const tracker = {
    resolvedCount: 0,
    secretVarsUsed: new Set<string>(),
    secretNames,
  };

  // 1. Interpolar URL
  const interpolatedUrl = interpolateString(originalPayload.url, variablesMap, tracker);

  // 2. Interpolar Parámetros de Consulta
  let interpolatedQueryParams: Record<string, string | number | boolean> | undefined = undefined;
  if (originalPayload.queryParams) {
    interpolatedQueryParams = {};
    for (const [key, val] of Object.entries(originalPayload.queryParams)) {
      const cleanKey = interpolateString(key, variablesMap, tracker);
      if (typeof val === 'string') {
        interpolatedQueryParams[cleanKey] = interpolateString(val, variablesMap, tracker);
      } else {
        interpolatedQueryParams[cleanKey] = val;
      }
    }
  }

  // 3. Interpolar Encabezados
  let interpolatedHeaders: Record<string, string> | undefined = undefined;
  if (originalPayload.headers) {
    interpolatedHeaders = {};
    for (const [key, val] of Object.entries(originalPayload.headers)) {
      const cleanKey = interpolateString(key, variablesMap, tracker);
      interpolatedHeaders[cleanKey] = interpolateString(val, variablesMap, tracker);
    }
  }

  // 4. Interpolar Cuerpo (JSON o Texto)
  let interpolatedBody: string | object | null = null;
  if (originalPayload.body !== null && originalPayload.body !== undefined) {
    if (typeof originalPayload.body === 'string') {
      const interpolatedString = interpolateString(originalPayload.body, variablesMap, tracker);
      interpolatedBody = interpolatedString;
    } else if (typeof originalPayload.body === 'object') {
      try {
        const rawJsonString = JSON.stringify(originalPayload.body);
        const interpolatedJsonString = interpolateString(rawJsonString, variablesMap, tracker);
        interpolatedBody = JSON.parse(interpolatedJsonString);
      } catch {
        // Si no se puede re-parsear como objeto, conservar como string interpolado
        const rawJsonString = JSON.stringify(originalPayload.body);
        interpolatedBody = interpolateString(rawJsonString, variablesMap, tracker);
      }
    } else {
      interpolatedBody = originalPayload.body;
    }
  }

  const interpolatedPayload: ExecuteRequestPayload = {
    ...originalPayload,
    url: interpolatedUrl,
    queryParams: interpolatedQueryParams,
    headers: interpolatedHeaders,
    body: interpolatedBody,
  };

  return {
    interpolatedPayload,
    resolvedCount: tracker.resolvedCount,
    secretVarsUsed: Array.from(tracker.secretVarsUsed),
  };
}
