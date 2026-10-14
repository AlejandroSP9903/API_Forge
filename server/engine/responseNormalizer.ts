/**
 * API Forge - Normalización de Respuestas HTTP (Fase 1A)
 * Procesa códigos de estado, encabezados, tipo de contenido y cuerpos de respuesta.
 */

import type { HttpResponseData } from '../../packages/shared/types.ts';

export function normalizeResponse(
  status: number,
  statusText: string,
  rawHeaders: Record<string, string | string[] | undefined>,
  bodyBuffer: Buffer,
  redirectsCount: number
): HttpResponseData {
  // 1. Normalizar encabezados a Record<string, string>
  const headers: Record<string, string> = {};
  for (const [key, val] of Object.entries(rawHeaders)) {
    if (val !== undefined) {
      headers[key.toLowerCase()] = Array.isArray(val) ? val.join(', ') : String(val);
    }
  }

  // 2. Extraer Content-Type
  const contentType = headers['content-type'] || null;

  // 3. Decodificar cuerpo a texto
  const rawBodyText = bodyBuffer.toString('utf8');

  // 4. Parsear JSON si el Content-Type indica JSON
  let parsedJson: unknown = undefined;
  if (contentType && contentType.toLowerCase().includes('application/json')) {
    try {
      parsedJson = JSON.parse(rawBodyText);
    } catch {
      // Si no es JSON válido, parsedJson permanece undefined y rawBodyText se conserva
    }
  }

  return {
    status,
    statusText,
    headers,
    contentType,
    body: rawBodyText,
    data: parsedJson,
    sizeBytes: bodyBuffer.byteLength,
    redirectsCount,
  };
}
