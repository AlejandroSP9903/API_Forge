/**
 * API Forge - Cliente Frontend para el Servicio de Proyectos (Fase 2A)
 * Conecta los componentes de React con los endpoints /api/projects de SQLite.
 */

import type {
  ProjectSummary,
  ProjectWithCollections,
  CollectionSummary,
  CreateProjectPayload,
  UpdateProjectPayload,
} from '../../packages/shared/types.ts';

const API_BASE = '/api/projects';

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const response = await fetch(API_BASE);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al obtener proyectos.`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return [];
  }
  return response.json();
}

export async function fetchProjectById(id: string): Promise<ProjectWithCollections> {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al obtener detalles del proyecto.`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Respuesta del servidor no es JSON válido.');
  }
  return response.json();
}

export async function createProjectApi(payload: CreateProjectPayload): Promise<ProjectSummary> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al crear proyecto.`);
  }
  return response.json();
}

export async function updateProjectApi(
  id: string,
  payload: UpdateProjectPayload
): Promise<ProjectSummary> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al actualizar proyecto.`);
  }
  return response.json();
}

export async function deleteProjectApi(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al eliminar proyecto.`);
  }
}

export async function fetchProjectCollectionsApi(projectId: string): Promise<CollectionSummary[]> {
  const response = await fetch(`${API_BASE}/${projectId}/collections`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al obtener colecciones del proyecto.`);
  }
  return response.json();
}

export async function associateCollectionToProjectApi(
  projectId: string,
  collectionId: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/${projectId}/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collectionId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al asociar colección al proyecto.`);
  }
}

export async function dissociateCollectionFromProjectApi(
  projectId: string,
  collectionId: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/${projectId}/collections/${collectionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al desasociar colección del proyecto.`);
  }
}
