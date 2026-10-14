/**
 * API Forge - Validación y Normalización de Solicitudes HTTP (Fase 1A)
 * Valida métodos, URLs, parámetros de consulta, encabezados y cuerpos de solicitud.
 */

import type { HttpMethod, HttpRequestDefinition } from '../../packages/shared/types.ts';
import { SecurityError } from './securityPolicy.ts';

export class ValidationError extends Error {
  public readonly code: 'INVALID_URL' | 'INVALID_REQUEST';

  constructor(message: string, code: 'INVALID_URL' | 'INVALID_REQUEST' = 'INVALID_REQUEST') {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface NormalizedHttpRequest {
  url: URL;
  method: HttpMethod;
  headers: Record<string, string>;
  body: string | null;
  timeoutMs: number;
  maxResponseSizeBytes: number;
  maxRedirects: number;
}

const ALLOWED_METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

// Expresión regular para nombres de encabezados HTTP válidos (RFC 7230 token)
const VALID_HEADER_NAME_REGEX = /^[a-zA-Z0-9!#$%&'*+\-.^_`|~]+$/;

// Límites de seguridad por defecto
const DEFAULT_TIMEOUT_MS = 10000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 30000;

const DEFAULT_MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_ALLOWED_RESPONSE_SIZE = 10 * 1024 * 1024; // 10 MB

const DEFAULT_MAX_REDIRECTS = 5;
const MAX_ALLOWED_REDIRECTS = 10;

const MAX_REQUEST_BODY_SIZE = 1024 * 1024; // 1 MB

/**
 * Normaliza y valida una definición de solicitud entrante
 */
export function validateAndNormalizeRequest(definition: HttpRequestDefinition): NormalizedHttpRequest {
  // 1. Validar URL presente
  if (!definition || typeof definition.url !== 'string' || definition.url.trim() === '') {
    throw new ValidationError('La propiedad "url" es obligatoria y debe ser un texto no vacío.', 'INVALID_URL');
  }

  // 2. Validar método HTTP
  const rawMethod = (definition.method || 'GET').toUpperCase();
  if (!ALLOWED_METHODS.includes(rawMethod as HttpMethod)) {
    throw new ValidationError(
      `Método HTTP '${rawMethod}' no admitido. Métodos admitidos: ${ALLOWED_METHODS.join(', ')}`,
      'INVALID_REQUEST'
    );
  }
  const method = rawMethod as HttpMethod;

  // 3. Parsear URL base
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(definition.url.trim());
  } catch {
    throw new ValidationError(`La URL proporcionada '${definition.url}' no tiene un formato válido.`, 'INVALID_URL');
  }

  // Validar protocolo permitido antes de evaluar el hostname
  const protocol = parsedUrl.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new SecurityError(
      `Protocolo '${protocol}' no permitido. API Forge únicamente admite 'http:' y 'https:'.`,
      'FORBIDDEN_PROTOCOL'
    );
  }

  if (!parsedUrl.hostname) {
    throw new ValidationError(`La URL proporcionada '${definition.url}' no contiene un nombre de host válido.`, 'INVALID_URL');
  }

  // 4. Incorporar parámetros de consulta si se especifican
  if (definition.queryParams && typeof definition.queryParams === 'object') {
    for (const [key, value] of Object.entries(definition.queryParams)) {
      if (key && value !== undefined && value !== null) {
        parsedUrl.searchParams.append(key, String(value));
      }
    }
  }

  // 5. Validar encabezados personalizados
  const normalizedHeaders: Record<string, string> = {};
  let hasContentType = false;

  if (definition.headers && typeof definition.headers === 'object') {
    for (const [name, val] of Object.entries(definition.headers)) {
      const cleanName = name.trim();

      if (!VALID_HEADER_NAME_REGEX.test(cleanName)) {
        throw new ValidationError(`El nombre de encabezado '${cleanName}' no es válido según RFC 7230.`, 'INVALID_REQUEST');
      }

      const stringVal = String(val);
      // Prevenir inyección de CRLF en encabezados
      if (/[\r\n]/.test(stringVal)) {
        throw new ValidationError(
          `El valor del encabezado '${cleanName}' contiene caracteres CRLF no permitidos.`,
          'INVALID_REQUEST'
        );
      }

      normalizedHeaders[cleanName] = stringVal;

      if (cleanName.toLowerCase() === 'content-type') {
        hasContentType = true;
      }
    }
  }

  // 6. Validar y normalizar el cuerpo de la solicitud
  let normalizedBody: string | null = null;
  const methodsAllowingBody = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (definition.body !== undefined && definition.body !== null) {
    if (!methodsAllowingBody.includes(method)) {
      throw new ValidationError(`El método HTTP ${method} no admite cuerpo de solicitud.`, 'INVALID_REQUEST');
    }

    if (typeof definition.body === 'object') {
      try {
        normalizedBody = JSON.stringify(definition.body);
      } catch (err) {
        throw new ValidationError('El objeto JSON proporcionado en el cuerpo no es serializable.', 'INVALID_REQUEST');
      }
      if (!hasContentType) {
        normalizedHeaders['Content-Type'] = 'application/json';
      }
    } else {
      normalizedBody = String(definition.body);
    }

    // Verificar límite de tamaño del cuerpo de la solicitud
    if (Buffer.byteLength(normalizedBody, 'utf8') > MAX_REQUEST_BODY_SIZE) {
      throw new ValidationError(
        `El cuerpo de la solicitud excede el límite máximo permitido de ${MAX_REQUEST_BODY_SIZE / 1024} KB.`,
        'INVALID_REQUEST'
      );
    }
  }

  // 7. Validar timeout
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (typeof definition.timeoutMs === 'number') {
    if (definition.timeoutMs < MIN_TIMEOUT_MS || definition.timeoutMs > MAX_TIMEOUT_MS) {
      throw new ValidationError(
        `El timeout debe estar comprendido entre ${MIN_TIMEOUT_MS}ms y ${MAX_TIMEOUT_MS}ms.`,
        'INVALID_REQUEST'
      );
    }
    timeoutMs = definition.timeoutMs;
  }

  // 8. Validar límite de respuesta
  let maxResponseSizeBytes = DEFAULT_MAX_RESPONSE_SIZE;
  if (typeof definition.maxResponseSizeBytes === 'number') {
    if (definition.maxResponseSizeBytes <= 0 || definition.maxResponseSizeBytes > MAX_ALLOWED_RESPONSE_SIZE) {
      throw new ValidationError(
        `El límite de respuesta debe ser mayor a 0 y no superior a ${MAX_ALLOWED_RESPONSE_SIZE / (1024 * 1024)} MB.`,
        'INVALID_REQUEST'
      );
    }
    maxResponseSizeBytes = definition.maxResponseSizeBytes;
  }

  // 9. Validar límite de redirecciones
  let maxRedirects = DEFAULT_MAX_REDIRECTS;
  if (typeof definition.maxRedirects === 'number') {
    if (definition.maxRedirects < 0 || definition.maxRedirects > MAX_ALLOWED_REDIRECTS) {
      throw new ValidationError(
        `El número máximo de redirecciones debe estar entre 0 y ${MAX_ALLOWED_REDIRECTS}.`,
        'INVALID_REQUEST'
      );
    }
    maxRedirects = definition.maxRedirects;
  }

  return {
    url: parsedUrl,
    method,
    headers: normalizedHeaders,
    body: normalizedBody,
    timeoutMs,
    maxResponseSizeBytes,
    maxRedirects,
  };
}
