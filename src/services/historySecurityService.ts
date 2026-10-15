/**
 * API Forge - Servicio de Seguridad y Protección del Historial (Fase 1C)
 * Sanitiza encabezados, parámetros de consulta, URLs y cuerpos antes de persistir
 * en el almacenamiento local para evitar la fuga de credenciales y secretos.
 */

import type { ExecuteRequestPayload } from '../../packages/shared/types.ts';
import type { MissionHistoryItem } from '../types/hunter.ts';

export const REDACTED_MARKER = '[VALOR_PROTEGIDO]';

// Patrones de nombres de encabezados sensibles
const SENSITIVE_HEADER_REGEX = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|apikey|x-auth-token|auth-token|x-access-token|access-token|x-secret|secret|x-token|token|x-credential|x-amz-security-token)$/i;
const SENSITIVE_HEADER_PARTIAL_REGEX = /(auth|token|secret|password|credential|apikey|cookie)/i;

// Patrones de claves sensibles en parámetros de consulta y cuerpos JSON
const SENSITIVE_KEY_REGEX = /^(.*[-_])?(key|token|auth|secret|password|passwd|pwd|credential|sig|signature|access_token|refresh_token|id_token|client_secret|api_key|apikey)$/i;

/**
 * Determina si un nombre de encabezado debe ser redactado.
 */
export function isSensitiveHeader(headerName: string): boolean {
  const normalized = headerName.trim().toLowerCase();
  return SENSITIVE_HEADER_REGEX.test(normalized) || SENSITIVE_HEADER_PARTIAL_REGEX.test(normalized);
}

/**
 * Determina si un parámetro de consulta o clave de cuerpo debe ser redactado.
 */
export function isSensitiveKey(keyName: string): boolean {
  const normalized = keyName.trim().toLowerCase();
  return (
    SENSITIVE_KEY_REGEX.test(normalized) ||
    /password|passwd|secret|token|credential|apikey/i.test(normalized)
  );
}

/**
 * Sanitiza una URL eliminando contraseñas en Basic Auth y parámetros de consulta sensibles.
 */
export function sanitizeUrl(rawUrl: string): { sanitizedUrl: string; redactedCount: number } {
  let redactedCount = 0;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { sanitizedUrl: rawUrl || '', redactedCount: 0 };
  }

  try {
    const parsed = new URL(rawUrl);

    // 1. Redactar Basic Auth en URL (https://user:password@host...)
    if (parsed.password && parsed.password !== REDACTED_MARKER) {
      parsed.password = REDACTED_MARKER;
      redactedCount++;
    }

    // 2. Redactar parámetros sensibles en la query string de la URL
    const searchParams = new URLSearchParams(parsed.search);
    let searchChanged = false;

    for (const [key, val] of Array.from(searchParams.entries())) {
      if (isSensitiveKey(key) && val !== REDACTED_MARKER) {
        searchParams.set(key, REDACTED_MARKER);
        searchChanged = true;
        redactedCount++;
      }
    }

    if (searchChanged) {
      parsed.search = searchParams.toString();
    }

    // Restaurar el marcador legible si URL.toString() lo percent-encodeó
    const finalUrl = parsed.toString().replace(/%5BVALOR_PROTEGIDO%5D/g, REDACTED_MARKER);
    return { sanitizedUrl: finalUrl, redactedCount };
  } catch {
    // Si la URL no es parseable como URL absoluta estándar, aplicamos regex de fallback
    let modified = rawUrl;

    // Detectar Basic Auth via regex: http(s)://user:secret@host
    const basicAuthRegex = /(https?:\/\/[^:]+:)([^@]+)(@)/i;
    if (basicAuthRegex.test(modified)) {
      modified = modified.replace(basicAuthRegex, `$1${REDACTED_MARKER}$3`);
      redactedCount++;
    }

    // Detectar query params comunes en URLs relativas o fragmentadas (?token=xyz)
    const queryParamRegex = /([?&])([^=]+)=([^&#]*)/g;
    modified = modified.replace(queryParamRegex, (match, prefix, key, val) => {
      if (isSensitiveKey(key) && val !== REDACTED_MARKER) {
        redactedCount++;
        return `${prefix}${key}=${REDACTED_MARKER}`;
      }
      return match;
    });

    return { sanitizedUrl: modified, redactedCount };
  }
}

/**
 * Sanitiza encabezados conservando los nombres pero ocultando valores sensibles.
 */
export function sanitizeHeaders(
  headers?: Record<string, string>
): { sanitizedHeaders?: Record<string, string>; redactedCount: number } {
  if (!headers || Object.keys(headers).length === 0) {
    return { sanitizedHeaders: undefined, redactedCount: 0 };
  }

  let redactedCount = 0;
  const cleanHeaders: Record<string, string> = {};

  for (const [key, val] of Object.entries(headers)) {
    if (isSensitiveHeader(key)) {
      cleanHeaders[key] = REDACTED_MARKER;
      if (val !== REDACTED_MARKER) {
        redactedCount++;
      }
    } else {
      // Si el valor contiene explícitamente "Bearer ..." en un encabezado arbitrario
      if (typeof val === 'string' && /bearer\s+[a-z0-9._~+/-]+=*/i.test(val) && !val.includes(REDACTED_MARKER)) {
        cleanHeaders[key] = val.replace(/bearer\s+\S+/i, `Bearer ${REDACTED_MARKER}`);
        redactedCount++;
      } else {
        cleanHeaders[key] = val;
      }
    }
  }

  return { sanitizedHeaders: cleanHeaders, redactedCount };
}

/**
 * Sanitiza parámetros de consulta independientes.
 */
export function sanitizeQueryParams(
  queryParams?: Record<string, string | number | boolean>
): { sanitizedParams?: Record<string, string | number | boolean>; redactedCount: number } {
  if (!queryParams || Object.keys(queryParams).length === 0) {
    return { sanitizedParams: undefined, redactedCount: 0 };
  }

  let redactedCount = 0;
  const cleanParams: Record<string, string | number | boolean> = {};

  for (const [key, val] of Object.entries(queryParams)) {
    if (isSensitiveKey(key)) {
      cleanParams[key] = REDACTED_MARKER;
      if (val !== REDACTED_MARKER) {
        redactedCount++;
      }
    } else {
      cleanParams[key] = val;
    }
  }

  return { sanitizedParams: cleanParams, redactedCount };
}

/**
 * Sanitiza el cuerpo de la solicitud de forma recursiva (para JSON) o mediante patrones (para texto).
 */
export function sanitizeBody(
  body?: string | object | null
): { sanitizedBody?: string | object | null; redactedCount: number } {
  if (body === undefined || body === null) {
    return { sanitizedBody: body, redactedCount: 0 };
  }

  let redactedCount = 0;

  // Caso 1: Objeto estructurado
  if (typeof body === 'object') {
    const sanitizeObject = (obj: unknown): unknown => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      if (obj !== null && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          if (isSensitiveKey(k)) {
            result[k] = REDACTED_MARKER;
            if (v !== REDACTED_MARKER) {
              redactedCount++;
            }
          } else {
            result[k] = sanitizeObject(v);
          }
        }
        return result;
      }
      return obj;
    };

    const sanitized = sanitizeObject(body) as object;
    return { sanitizedBody: sanitized, redactedCount };
  }

  // Caso 2: Cadena de texto
  if (typeof body === 'string') {
    const trimmed = body.trim();

    // Comprobar si es un JSON serializado
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        const { sanitizedBody, redactedCount: objCount } = sanitizeBody(parsed);
        redactedCount += objCount;
        return {
          sanitizedBody: JSON.stringify(sanitizedBody, null, 2),
          redactedCount,
        };
      } catch {
        // No era JSON válido, continuar con sanitización de texto
      }
    }

    // Sanitización de formato URL-encoded (grant_type=password&client_secret=123)
    let textModified = body;
    const urlEncodedRegex = /([^&=?]+)=([^&]*)/g;
    if (body.includes('=')) {
      textModified = textModified.replace(urlEncodedRegex, (match, k, v) => {
        if (isSensitiveKey(k) && v !== REDACTED_MARKER) {
          redactedCount++;
          return `${k}=${REDACTED_MARKER}`;
        }
        return match;
      });
    }

    // Sanitizar Bearer tokens en texto plano
    const bearerRegex = /bearer\s+[a-z0-9._~+/-]+=*/gi;
    if (bearerRegex.test(textModified) && !textModified.includes(REDACTED_MARKER)) {
      textModified = textModified.replace(bearerRegex, `Bearer ${REDACTED_MARKER}`);
      redactedCount++;
    }

    return { sanitizedBody: textModified, redactedCount };
  }

  return { sanitizedBody: body, redactedCount: 0 };
}

/**
 * Sanitiza una carga útil completa para almacenamiento en el historial.
 */
export function sanitizeRequestPayload(payload: ExecuteRequestPayload): {
  sanitized: ExecuteRequestPayload;
  redactedCount: number;
} {
  const { sanitizedUrl, redactedCount: urlCount } = sanitizeUrl(payload.url);
  const { sanitizedHeaders, redactedCount: headersCount } = sanitizeHeaders(payload.headers);
  const { sanitizedParams, redactedCount: paramsCount } = sanitizeQueryParams(payload.queryParams);
  const { sanitizedBody, redactedCount: bodyCount } = sanitizeBody(payload.body);

  const totalRedacted = urlCount + headersCount + paramsCount + bodyCount;

  return {
    sanitized: {
      ...payload,
      url: sanitizedUrl,
      headers: sanitizedHeaders,
      queryParams: sanitizedParams,
      body: sanitizedBody,
    },
    redactedCount: totalRedacted,
  };
}

/**
 * Sanitiza un elemento del historial completo.
 */
export function sanitizeHistoryItem(item: MissionHistoryItem): {
  sanitized: MissionHistoryItem;
  wasModified: boolean;
} {
  const { sanitized: cleanPayload, redactedCount: pRedacted } = sanitizeRequestPayload(item.payload);
  const { sanitizedUrl: cleanItemUrl, redactedCount: uRedacted } = sanitizeUrl(item.url);

  const wasModified = pRedacted > 0 || uRedacted > 0;

  return {
    sanitized: {
      ...item,
      url: cleanItemUrl,
      payload: cleanPayload,
      hasProtectedSecrets: wasModified || item.hasProtectedSecrets || false,
    },
    wasModified,
  };
}

/**
 * Migra y limpia un arreglo de misiones históricas (p.ej. al cargar desde localStorage).
 */
export function migrateAndSanitizeHistory(items: MissionHistoryItem[]): {
  items: MissionHistoryItem[];
  modifiedCount: number;
} {
  let modifiedCount = 0;

  const sanitizedList = items.map((item) => {
    const { sanitized, wasModified } = sanitizeHistoryItem(item);
    if (wasModified) {
      modifiedCount++;
    }
    return sanitized;
  });

  return {
    items: sanitizedList,
    modifiedCount,
  };
}

/**
 * Detecta si una solicitud contiene marcadores de secretos protegidos.
 */
export function hasProtectedSecrets(payload: ExecuteRequestPayload): boolean {
  if (payload.url && payload.url.includes(REDACTED_MARKER)) return true;

  if (payload.headers) {
    for (const val of Object.values(payload.headers)) {
      if (typeof val === 'string' && val.includes(REDACTED_MARKER)) return true;
    }
  }

  if (payload.queryParams) {
    for (const val of Object.values(payload.queryParams)) {
      if (typeof val === 'string' && val.includes(REDACTED_MARKER)) return true;
    }
  }

  if (payload.body) {
    if (typeof payload.body === 'string' && payload.body.includes(REDACTED_MARKER)) return true;
    if (typeof payload.body === 'object') {
      const jsonStr = JSON.stringify(payload.body);
      if (jsonStr.includes(REDACTED_MARKER)) return true;
    }
  }

  return false;
}
