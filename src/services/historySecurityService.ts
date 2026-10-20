/**
 * API Forge - Servicio de Seguridad y Protección del Historial (Fase 1C-R)
 * Sanitiza encabezados, parámetros de consulta, URLs, cuerpos y resultados
 * antes de persistir en el almacenamiento local para evitar la fuga de credenciales y secretos.
 */

import type { ExecuteRequestPayload, ExecuteRequestResult, RequestAuthConfig } from '../../packages/shared/types.ts';
import type { MissionHistoryItem } from '../types/hunter.ts';

export const REDACTED_MARKER = '[VALOR_PROTEGIDO]';

// Patrones de nombres de encabezados sensibles
const SENSITIVE_HEADER_EXACT_REGEX = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|apikey|x-auth-token|auth-token|x-access-token|access-token|x-secret|secret|x-token|token|x-credential|x-amz-security-token|x-signature|signature|x-session-id|session-id)$/i;
const SENSITIVE_HEADER_PARTIAL_REGEX = /(auth|token|secret|password|passwd|credential|apikey|api_key|cookie|signature|sig|session|bearer|jwt)/i;

// Patrones de claves sensibles en parámetros de consulta y cuerpos JSON
const SENSITIVE_KEY_EXACT_REGEX = /^(key|token|auth|secret|password|passwd|pwd|passcode|credential|sig|signature|sign|access_token|refresh_token|id_token|client_secret|api_key|apikey|session|session_id|sessionid|jwt|bearer)$/i;
const SENSITIVE_KEY_SUBSTRING_REGEX = /(password|passwd|passcode|secret|token|credential|apikey|api_key|signature|sig|private[_-]?key)/i;

/**
 * Función auxiliar para verificar si un valor ya ha sido redactado.
 */
export function isAlreadyRedacted(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return (
    val === REDACTED_MARKER ||
    val === '%5BVALOR_PROTEGIDO%5D' ||
    decodeURIComponent(val) === REDACTED_MARKER
  );
}

/**
 * Determina si un nombre de encabezado debe ser redactado.
 * Es insensible a mayúsculas y minúsculas (RFC 7230).
 */
export function isSensitiveHeader(headerName: string): boolean {
  if (!headerName || typeof headerName !== 'string') return false;
  const normalized = headerName.trim().toLowerCase();
  return SENSITIVE_HEADER_EXACT_REGEX.test(normalized) || SENSITIVE_HEADER_PARTIAL_REGEX.test(normalized);
}

/**
 * Determina si un parámetro de consulta o clave de cuerpo debe ser redactado.
 * Insensible a mayúsculas, minúsculas, camelCase y snake_case.
 */
export function isSensitiveKey(keyName: string): boolean {
  if (!keyName || typeof keyName !== 'string') return false;
  const normalized = keyName.trim().toLowerCase();
  return (
    SENSITIVE_KEY_EXACT_REGEX.test(normalized) ||
    SENSITIVE_KEY_SUBSTRING_REGEX.test(normalized)
  );
}

/**
 * Determina si una cadena de texto coincide con patrones reconocibles de secretos o tokens.
 */
export function isSensitiveText(text: string): boolean {
  if (!text || typeof text !== 'string' || isAlreadyRedacted(text)) return false;

  // 1. Bearer Token
  if (/bearer\s+[A-Za-z0-9._~+/=-]+/i.test(text)) return true;

  // 2. JWT Token (formato eyJ...)
  if (/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\b/.test(text)) return true;

  // 3. Prefijos conocidos de API Keys comunes (GitHub, Stripe, Slack, etc.)
  if (/\b(ghp_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,}|sk_live_[a-zA-Z0-9]{20,}|ak_live_[a-zA-Z0-9]{15,}|xox[baprs]-[a-zA-Z0-9]{10,})\b/.test(text)) {
    return true;
  }

  // 4. Claves privadas PEM
  if (/-----BEGIN [A-Z0-9\s_-]*PRIVATE KEY-----/.test(text)) return true;

  return false;
}

/**
 * Sanitiza texto libre o mensajes de error reemplazando credenciales reconocibles.
 */
export function sanitizeText(text: string): { sanitizedText: string; redactedCount: number } {
  if (!text || typeof text !== 'string') {
    return { sanitizedText: text || '', redactedCount: 0 };
  }

  let redactedCount = 0;
  let modified = text;

  // 1. URLs con contraseñas Basic Auth incrustadas en el texto: https://user:secret@host
  const basicAuthInTextRegex = /(https?:\/\/[^\s:@/]+:)([^\s:@/]+)(@[^\s"']+)/gi;
  modified = modified.replace(basicAuthInTextRegex, (match, prefix, pass, suffix) => {
    if (!isAlreadyRedacted(pass)) {
      redactedCount++;
      return `${prefix}${REDACTED_MARKER}${suffix}`;
    }
    return match;
  });

  // 2. Bearer tokens: Bearer <token>
  const bearerRegex = /(bearer\s+)(?!\[VALOR_PROTEGIDO\])[A-Za-z0-9._~+/=-]+/gi;
  modified = modified.replace(bearerRegex, (match, prefix) => {
    redactedCount++;
    return `${prefix}${REDACTED_MARKER}`;
  });

  // 3. Tokens JWT (eyJ...)
  const jwtRegex = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\b/g;
  modified = modified.replace(jwtRegex, (match) => {
    if (!isAlreadyRedacted(match)) {
      redactedCount++;
      return REDACTED_MARKER;
    }
    return match;
  });

  // 4. Claves privadas PEM
  const pemRegex = /-----BEGIN [A-Z0-9\s_-]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9\s_-]*PRIVATE KEY-----/g;
  modified = modified.replace(pemRegex, (match) => {
    if (!match.includes(REDACTED_MARKER)) {
      redactedCount++;
      return `-----BEGIN PRIVATE KEY-----\n${REDACTED_MARKER}\n-----END PRIVATE KEY-----`;
    }
    return match;
  });

  // 5. Prefijos de API keys conocidos
  const apiKeyPrefixRegex = /\b(ghp_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,}|sk_live_[a-zA-Z0-9]{20,}|ak_live_[a-zA-Z0-9]{15,}|xox[baprs]-[a-zA-Z0-9]{10,})\b/g;
  modified = modified.replace(apiKeyPrefixRegex, (match) => {
    if (!isAlreadyRedacted(match)) {
      redactedCount++;
      return REDACTED_MARKER;
    }
    return match;
  });

  // 6. Parámetros de consulta o pares clave=valor en texto plano
  const keyValueRegex = /(?<=[?&;,\s([{]|^)(password|passwd|secret|token|access_token|refresh_token|api_key|apikey|client_secret|signature|sig)=([^&\s"';,\n\r)]+)/gi;
  modified = modified.replace(keyValueRegex, (match, key, val) => {
    if (!isAlreadyRedacted(val)) {
      redactedCount++;
      return `${key}=${REDACTED_MARKER}`;
    }
    return match;
  });

  return { sanitizedText: modified, redactedCount };
}

/**
 * Sanitiza una URL eliminando contraseñas en Basic Auth y parámetros de consulta sensibles.
 * Preserva la idempotencia completa ante ejecuciones múltiples.
 */
export function sanitizeUrl(rawUrl: string): { sanitizedUrl: string; redactedCount: number } {
  let redactedCount = 0;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { sanitizedUrl: rawUrl || '', redactedCount: 0 };
  }

  try {
    const parsed = new URL(rawUrl);

    // 1. Redactar Basic Auth en URL (https://user:password@host...)
    if (parsed.password && !isAlreadyRedacted(parsed.password)) {
      parsed.password = REDACTED_MARKER;
      redactedCount++;
    }

    // 1b. Redactar Username si contiene un token o clave sensible
    if (parsed.username && !isAlreadyRedacted(parsed.username)) {
      if (isSensitiveKey(parsed.username) || isSensitiveText(parsed.username)) {
        parsed.username = REDACTED_MARKER;
        redactedCount++;
      }
    }

    // 2. Redactar parámetros sensibles en la query string de la URL
    const searchParams = new URLSearchParams(parsed.search);
    let searchChanged = false;

    for (const [key, val] of Array.from(searchParams.entries())) {
      if (isSensitiveKey(key) || isSensitiveText(val)) {
        if (!isAlreadyRedacted(val)) {
          searchParams.set(key, REDACTED_MARKER);
          searchChanged = true;
          redactedCount++;
        }
      }
    }

    if (searchChanged) {
      parsed.search = searchParams.toString();
    }

    // Restaurar el marcador legible si URL.toString() lo percent-encodeó en password o params
    const finalUrl = parsed.toString().replace(/%5BVALOR_PROTEGIDO%5D/g, REDACTED_MARKER);
    return { sanitizedUrl: finalUrl, redactedCount };
  } catch {
    // Si la URL no es parseable como URL absoluta estándar, aplicamos regex de fallback
    let modified = rawUrl;

    // Detectar Basic Auth via regex: http(s)://user:secret@host
    const basicAuthRegex = /(https?:\/\/[^:]+:)([^@]+)(@)/i;
    const authMatch = basicAuthRegex.exec(modified);
    if (authMatch && !isAlreadyRedacted(authMatch[2])) {
      modified = modified.replace(basicAuthRegex, `$1${REDACTED_MARKER}$3`);
      redactedCount++;
    }

    // Detectar query params en URLs relativas o fragmentadas (?token=xyz)
    const queryParamRegex = /([?&])([^=]+)=([^&#]*)/g;
    modified = modified.replace(queryParamRegex, (fullMatch, prefix, key, val) => {
      if ((isSensitiveKey(key) || isSensitiveText(val)) && !isAlreadyRedacted(val)) {
        redactedCount++;
        return `${prefix}${key}=${REDACTED_MARKER}`;
      }
      return fullMatch;
    });

    return { sanitizedUrl: modified, redactedCount };
  }
}

/**
 * Sanitiza encabezados conservando los nombres pero ocultando valores sensibles.
 * Insensible a mayúsculas/minúsculas y soporta redacción de Bearer o JWT en encabezados arbitrarios.
 */
export function sanitizeHeaders(
  headers?: Record<string, string>
): { sanitizedHeaders?: Record<string, string>; redactedCount: number } {
  if (!headers || typeof headers !== 'object' || Object.keys(headers).length === 0) {
    return { sanitizedHeaders: undefined, redactedCount: 0 };
  }

  let redactedCount = 0;
  const cleanHeaders: Record<string, string> = {};

  for (const [key, val] of Object.entries(headers)) {
    if (isSensitiveHeader(key)) {
      if (!isAlreadyRedacted(val)) {
        cleanHeaders[key] = REDACTED_MARKER;
        redactedCount++;
      } else {
        cleanHeaders[key] = REDACTED_MARKER;
      }
    } else {
      // Si el encabezado no es de nombre sensible, inspeccionamos el contenido
      if (typeof val === 'string') {
        const { sanitizedText, redactedCount: textCount } = sanitizeText(val);
        if (textCount > 0) {
          cleanHeaders[key] = sanitizedText;
          redactedCount += textCount;
        } else {
          cleanHeaders[key] = val;
        }
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
  if (!queryParams || typeof queryParams !== 'object' || Object.keys(queryParams).length === 0) {
    return { sanitizedParams: undefined, redactedCount: 0 };
  }

  let redactedCount = 0;
  const cleanParams: Record<string, string | number | boolean> = {};

  for (const [key, val] of Object.entries(queryParams)) {
    const strVal = String(val);
    if (isSensitiveKey(key) || isSensitiveText(strVal)) {
      if (!isAlreadyRedacted(strVal)) {
        cleanParams[key] = REDACTED_MARKER;
        redactedCount++;
      } else {
        cleanParams[key] = REDACTED_MARKER;
      }
    } else {
      cleanParams[key] = val;
    }
  }

  return { sanitizedParams: cleanParams, redactedCount };
}

/**
 * Sanitiza el cuerpo de la solicitud de forma recursiva (para JSON/objetos/arreglos) o mediante patrones (para texto).
 */
export function sanitizeBody(
  body?: string | object | null
): { sanitizedBody?: string | object | null; redactedCount: number } {
  if (body === undefined || body === null) {
    return { sanitizedBody: body, redactedCount: 0 };
  }

  let redactedCount = 0;

  // Caso 1: Objeto estructurado o Arreglo
  if (typeof body === 'object') {
    const sanitizeObject = (obj: unknown): unknown => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      if (obj !== null && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          if (isSensitiveKey(k)) {
            if (!isAlreadyRedacted(v)) {
              result[k] = REDACTED_MARKER;
              redactedCount++;
            } else {
              result[k] = REDACTED_MARKER;
            }
          } else {
            if (typeof v === 'string') {
              const { sanitizedText, redactedCount: textCount } = sanitizeText(v);
              if (textCount > 0) {
                result[k] = sanitizedText;
                redactedCount += textCount;
              } else {
                result[k] = v;
              }
            } else {
              result[k] = sanitizeObject(v);
            }
          }
        }
        return result;
      }
      if (typeof obj === 'string') {
        const { sanitizedText, redactedCount: textCount } = sanitizeText(obj);
        if (textCount > 0) {
          redactedCount += textCount;
          return sanitizedText;
        }
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

    // Aplicar sanitizador integral de texto
    const { sanitizedText, redactedCount: textCount } = sanitizeText(body);
    redactedCount += textCount;
    return { sanitizedBody: sanitizedText, redactedCount };
  }

  return { sanitizedBody: body, redactedCount: 0 };
}

/**
 * Sanitiza el resultado de ejecución (response headers, response body, error messages)
 * asegurando que ningún secreto devuelto o generado por el backend se persista en texto plano.
 */
export function sanitizeResult(result?: ExecuteRequestResult): {
  sanitizedResult?: ExecuteRequestResult;
  redactedCount: number;
} {
  if (!result || typeof result !== 'object') {
    return { sanitizedResult: result, redactedCount: 0 };
  }

  let totalRedacted = 0;
  const cleanResult: ExecuteRequestResult = {
    ...result,
  };

  // 1. Sanitizar respuesta HTTP si está presente
  if (result.response) {
    const { sanitizedHeaders, redactedCount: hCount } = sanitizeHeaders(result.response.headers);
    totalRedacted += hCount;

    let cleanResponseBody = result.response.body;
    let cleanResponseData = result.response.data;

    if (result.response.body) {
      const { sanitizedBody, redactedCount: bCount } = sanitizeBody(result.response.body);
      totalRedacted += bCount;
      cleanResponseBody = typeof sanitizedBody === 'string' ? sanitizedBody : JSON.stringify(sanitizedBody);
    }

    if (result.response.data && typeof result.response.data === 'object') {
      const { sanitizedBody, redactedCount: dCount } = sanitizeBody(result.response.data);
      totalRedacted += dCount;
      cleanResponseData = sanitizedBody;
    }

    cleanResult.response = {
      ...result.response,
      headers: sanitizedHeaders || result.response.headers,
      body: cleanResponseBody,
      data: cleanResponseData,
    };
  }

  // 2. Sanitizar error si está presente
  if (result.error) {
    const { sanitizedText: cleanErrorMessage, redactedCount: eCount } = sanitizeText(result.error.message);
    totalRedacted += eCount;

    let cleanDetails = result.error.details;
    if (result.error.details) {
      if (typeof result.error.details === 'string') {
        const { sanitizedText, redactedCount: dCount } = sanitizeText(result.error.details);
        totalRedacted += dCount;
        cleanDetails = sanitizedText;
      } else if (typeof result.error.details === 'object') {
        const { sanitizedBody, redactedCount: dCount } = sanitizeBody(result.error.details as object);
        totalRedacted += dCount;
        cleanDetails = sanitizedBody;
      }
    }

    cleanResult.error = {
      ...result.error,
      message: cleanErrorMessage,
      details: cleanDetails,
    };
  }

  return {
    sanitizedResult: cleanResult,
    redactedCount: totalRedacted,
  };
}

/**
 * Sanitiza la configuración de autenticación HTTP (Fase 1G)
 * Redacta tokens Bearer, contraseñas Basic Auth y valores de API Key sensibles.
 */
export function sanitizeAuth(
  auth?: RequestAuthConfig
): { sanitizedAuth?: RequestAuthConfig; redactedCount: number } {
  if (!auth || typeof auth !== 'object' || auth.type === 'none') {
    return { sanitizedAuth: auth ? { type: 'none' } : undefined, redactedCount: 0 };
  }

  let redactedCount = 0;
  const cleanAuth: RequestAuthConfig = { type: auth.type };

  if (auth.type === 'bearer' && auth.bearer) {
    const rawToken = auth.bearer.token;
    if (rawToken) {
      if (rawToken.startsWith('{{') && rawToken.endsWith('}}')) {
        // Las referencias a variables de entorno se preservan en plantillas
        cleanAuth.bearer = { token: rawToken };
      } else if (!isAlreadyRedacted(rawToken)) {
        cleanAuth.bearer = { token: REDACTED_MARKER };
        redactedCount++;
      } else {
        cleanAuth.bearer = { token: REDACTED_MARKER };
      }
    } else {
      cleanAuth.bearer = { token: '' };
    }
  } else if (auth.type === 'basic' && auth.basic) {
    const { username, password } = auth.basic;
    let cleanPass = password;
    if (password) {
      if (password.startsWith('{{') && password.endsWith('}}')) {
        cleanPass = password;
      } else if (!isAlreadyRedacted(password)) {
        cleanPass = REDACTED_MARKER;
        redactedCount++;
      } else {
        cleanPass = REDACTED_MARKER;
      }
    }
    cleanAuth.basic = {
      username: username || '',
      password: cleanPass || '',
    };
  } else if (auth.type === 'apikey' && auth.apiKey) {
    const { key, value, addTo } = auth.apiKey;
    let cleanVal = value;
    if (value) {
      if (value.startsWith('{{') && value.endsWith('}}')) {
        cleanVal = value;
      } else if (isSensitiveKey(key) || isSensitiveText(value) || !isAlreadyRedacted(value)) {
        cleanVal = REDACTED_MARKER;
        redactedCount++;
      }
    }
    cleanAuth.apiKey = {
      key: key || '',
      value: cleanVal || '',
      addTo: addTo || 'header',
    };
  }

  return { sanitizedAuth: cleanAuth, redactedCount };
}

/**
 * Sanitiza una carga útil completa para almacenamiento en el historial.
 */
export function sanitizeRequestPayload(payload: ExecuteRequestPayload): {
  sanitized: ExecuteRequestPayload;
  redactedCount: number;
} {
  if (!payload || typeof payload !== 'object') {
    return {
      sanitized: { url: '', method: 'GET' },
      redactedCount: 0,
    };
  }

  const { sanitizedUrl, redactedCount: urlCount } = sanitizeUrl(payload.url);
  const { sanitizedHeaders, redactedCount: headersCount } = sanitizeHeaders(payload.headers);
  const { sanitizedParams, redactedCount: paramsCount } = sanitizeQueryParams(payload.queryParams);
  const { sanitizedBody, redactedCount: bodyCount } = sanitizeBody(payload.body);
  const { sanitizedAuth, redactedCount: authCount } = sanitizeAuth(payload.auth);

  const totalRedacted = urlCount + headersCount + paramsCount + bodyCount + authCount;

  return {
    sanitized: {
      ...payload,
      url: sanitizedUrl,
      headers: sanitizedHeaders,
      queryParams: sanitizedParams,
      body: sanitizedBody,
      auth: sanitizedAuth,
    },
    redactedCount: totalRedacted,
  };
}

/**
 * Sanitiza un elemento del historial completo con validación defensiva contra datos malformados.
 */
export function sanitizeHistoryItem(rawItem: unknown): {
  sanitized: MissionHistoryItem;
  wasModified: boolean;
  isCorrupted: boolean;
} {
  if (!rawItem || typeof rawItem !== 'object') {
    return {
      sanitized: {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        method: 'GET',
        url: 'https://api.example.com',
        durationMs: 0,
        success: false,
        payload: { url: 'https://api.example.com', method: 'GET' },
      },
      wasModified: false,
      isCorrupted: true,
    };
  }

  const item = rawItem as Partial<MissionHistoryItem>;

  // Validar campos mínimos
  const hasValidUrl = typeof item.url === 'string' && item.url.trim() !== '';
  const payloadUrl = item.payload && typeof item.payload.url === 'string' ? item.payload.url : '';
  const effectiveUrl = hasValidUrl ? item.url! : (payloadUrl || 'https://api.example.com');

  const rawPayload: ExecuteRequestPayload = item.payload && typeof item.payload === 'object'
    ? item.payload
    : { url: effectiveUrl, method: item.method || 'GET' };

  const { sanitized: cleanPayload, redactedCount: pRedacted } = sanitizeRequestPayload(rawPayload);
  const { sanitizedUrl: cleanItemUrl, redactedCount: uRedacted } = sanitizeUrl(effectiveUrl);
  const { sanitizedResult: cleanResult, redactedCount: rRedacted } = sanitizeResult(item.result);

  const totalRedacted = pRedacted + uRedacted + rRedacted;
  const wasModified = totalRedacted > 0;

  const validId = typeof item.id === 'string' && item.id.trim() !== ''
    ? item.id
    : `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const validTimestamp = typeof item.timestamp === 'string' && item.timestamp.trim() !== ''
    ? item.timestamp
    : new Date().toISOString();

  const sanitizedItem: MissionHistoryItem = {
    id: validId,
    timestamp: validTimestamp,
    method: item.method || cleanPayload.method || 'GET',
    url: cleanItemUrl,
    status: item.status ?? cleanResult?.response?.status,
    statusText: item.statusText ?? cleanResult?.response?.statusText,
    durationMs: item.durationMs ?? cleanResult?.timing?.durationMs ?? 0,
    success: item.success ?? cleanResult?.success ?? true,
    errorCode: item.errorCode ?? cleanResult?.error?.code,
    payload: cleanPayload,
    result: cleanResult,
    hasProtectedSecrets: wasModified || Boolean(item.hasProtectedSecrets) || hasProtectedSecrets(cleanPayload, cleanResult),
  };

  const isCorrupted = !hasValidUrl && !payloadUrl;

  return {
    sanitized: sanitizedItem,
    wasModified,
    isCorrupted,
  };
}

/**
 * Migra y limpia un arreglo de misiones históricas (p.ej. al cargar desde localStorage).
 * Tolera registros malformados o nulos sin borrar registros válidos indiscriminadamente.
 * Es estrictamente idempotente.
 */
export function migrateAndSanitizeHistory(rawItems: unknown[]): {
  items: MissionHistoryItem[];
  modifiedCount: number;
  corruptedCount: number;
} {
  if (!Array.isArray(rawItems)) {
    return { items: [], modifiedCount: 0, corruptedCount: 0 };
  }

  let modifiedCount = 0;
  let corruptedCount = 0;
  const cleanList: MissionHistoryItem[] = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') {
      corruptedCount++;
      continue;
    }

    const { sanitized, wasModified, isCorrupted } = sanitizeHistoryItem(rawItem);

    if (isCorrupted) {
      corruptedCount++;
      continue;
    }

    if (wasModified) {
      modifiedCount++;
    }

    cleanList.push(sanitized);
  }

  return {
    items: cleanList,
    modifiedCount,
    corruptedCount,
  };
}

/**
 * Detecta si una solicitud o resultado contiene marcadores de secretos protegidos.
 */
export function hasProtectedSecrets(
  payload: ExecuteRequestPayload,
  result?: ExecuteRequestResult
): boolean {
  if (!payload || typeof payload !== 'object') return false;

  if (payload.url && payload.url.includes(REDACTED_MARKER)) return true;

  if (payload.headers) {
    for (const val of Object.values(payload.headers)) {
      if (typeof val === 'string' && val.includes(REDACTED_MARKER)) return true;
    }
  }

  if (payload.queryParams) {
    for (const val of Object.values(payload.queryParams)) {
      if (typeof val === 'string' && String(val).includes(REDACTED_MARKER)) return true;
    }
  }

  if (payload.body) {
    if (typeof payload.body === 'string' && payload.body.includes(REDACTED_MARKER)) return true;
    if (typeof payload.body === 'object') {
      const jsonStr = JSON.stringify(payload.body);
      if (jsonStr.includes(REDACTED_MARKER)) return true;
    }
  }

  if (payload.auth) {
    if (payload.auth.bearer?.token && payload.auth.bearer.token.includes(REDACTED_MARKER)) return true;
    if (payload.auth.basic?.password && payload.auth.basic.password.includes(REDACTED_MARKER)) return true;
    if (payload.auth.basic?.username && payload.auth.basic.username.includes(REDACTED_MARKER)) return true;
    if (payload.auth.apiKey?.value && payload.auth.apiKey.value.includes(REDACTED_MARKER)) return true;
  }

  if (result) {
    if (result.response?.body && result.response.body.includes(REDACTED_MARKER)) return true;
    if (result.response?.headers) {
      for (const val of Object.values(result.response.headers)) {
        if (typeof val === 'string' && val.includes(REDACTED_MARKER)) return true;
      }
    }
    if (result.error?.message && result.error.message.includes(REDACTED_MARKER)) return true;
  }

  return false;
}
