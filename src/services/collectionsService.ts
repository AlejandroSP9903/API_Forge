/**
 * API Forge - Cliente Frontend para el Servicio de Colecciones (Fase 1D)
 * Conecta los componentes de React con los endpoints /api/collections de SQLite.
 */

import type {
  CollectionSummary,
  CollectionWithRequests,
  SavedRequestData,
  CreateCollectionPayload,
  UpdateCollectionPayload,
  CreateSavedRequestPayload,
  UpdateSavedRequestPayload,
} from '../../packages/shared/types.ts';

const API_BASE = '/api/collections';

export async function fetchCollections(): Promise<CollectionSummary[]> {
  const response = await fetch(API_BASE);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al obtener colecciones.`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return [];
  }
  return response.json();
}

export async function fetchCollectionById(id: string): Promise<CollectionWithRequests> {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al obtener detalles de la colección.`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Respuesta del servidor no es JSON válido.');
  }
  return response.json();
}

export async function createCollectionApi(payload: CreateCollectionPayload): Promise<CollectionSummary> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al crear colección.`);
  }
  return response.json();
}

export async function updateCollectionApi(
  id: string,
  payload: UpdateCollectionPayload
): Promise<CollectionSummary> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al actualizar colección.`);
  }
  return response.json();
}

export async function deleteCollectionApi(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al eliminar colección.`);
  }
}

export async function createSavedRequestApi(
  collectionId: string,
  payload: CreateSavedRequestPayload
): Promise<SavedRequestData> {
  const response = await fetch(`${API_BASE}/${collectionId}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al guardar solicitud en la colección.`);
  }
  return response.json();
}

export async function updateSavedRequestApi(
  collectionId: string,
  requestId: string,
  payload: UpdateSavedRequestPayload
): Promise<SavedRequestData> {
  const response = await fetch(`${API_BASE}/${collectionId}/requests/${requestId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al actualizar solicitud.`);
  }
  return response.json();
}

export async function deleteSavedRequestApi(
  collectionId: string,
  requestId: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/${collectionId}/requests/${requestId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status} al eliminar solicitud.`);
  }
}
