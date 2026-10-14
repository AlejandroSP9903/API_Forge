/**
 * API Forge - Motor de Ejecución HTTP (Fase 1A)
 * Orquesta validación, verificación SSRF, streaming con límite de tamaño,
 * gestión segura de redirecciones y medición precisa de latencia.
 */

import http from 'http';
import https from 'https';
import { performance } from 'perf_hooks';
import { SecurityPolicy, SecurityError, defaultSecurityPolicy, type SecurityPolicyOptions } from './securityPolicy.ts';
import { validateAndNormalizeRequest, ValidationError, type NormalizedHttpRequest } from './validation.ts';
import { normalizeResponse } from './responseNormalizer.ts';
import type {
  HttpRequestDefinition,
  ExecuteRequestResult,
  HttpEngineErrorCode,
  HttpResponseData,
} from '../../packages/shared/types.ts';

export class HttpEngineError extends Error {
  public readonly code: HttpEngineErrorCode;
  public readonly details?: unknown;

  constructor(message: string, code: HttpEngineErrorCode, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class HttpEngine {
  private readonly securityPolicy: SecurityPolicy;

  constructor(options?: SecurityPolicyOptions) {
    this.securityPolicy = options?.allowLoopbackForTesting
      ? new SecurityPolicy(options)
      : defaultSecurityPolicy;
  }

  /**
   * Ejecuta una solicitud HTTP respetando las políticas de seguridad y límites configurados
   */
  public async execute(
    definition: HttpRequestDefinition,
    parentSignal?: AbortSignal
  ): Promise<ExecuteRequestResult> {
    const startTime = performance.now();
    const startedAt = new Date().toISOString();

    try {
      // 1. Normalizar y validar definición de solicitud
      const normalized = validateAndNormalizeRequest(definition);

      // 2. Ejecutar con soporte de redirecciones seguras
      const responseData = await this.executeWithRedirects(normalized, 0, parentSignal);

      const durationMs = Math.round(performance.now() - startTime);
      const completedAt = new Date().toISOString();

      return {
        success: true,
        response: responseData,
        timing: {
          durationMs,
          startedAt,
          completedAt,
        },
      };
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      const completedAt = new Date().toISOString();

      let code: HttpEngineErrorCode = 'NETWORK_ERROR';
      let message = err instanceof Error ? err.message : 'Error desconocido al ejecutar la solicitud HTTP.';
      let details: unknown = undefined;

      if (err instanceof ValidationError) {
        code = err.code;
      } else if (err instanceof SecurityError) {
        code = err.code;
      } else if (err instanceof HttpEngineError) {
        code = err.code;
        details = err.details;
      } else if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
        code = 'ABORTED';
        message = 'La solicitud fue cancelada por el cliente o excedió el tiempo límite.';
      }

      return {
        success: false,
        error: {
          code,
          message,
          details,
        },
        timing: {
          durationMs,
          startedAt,
          completedAt,
        },
      };
    }
  }

  /**
   * Realiza la petición y sigue redirecciones validando el destino en cada salto
   */
  private async executeWithRedirects(
    reqData: NormalizedHttpRequest,
    redirectsCount: number,
    parentSignal?: AbortSignal
  ): Promise<HttpResponseData> {
    // 1. Validar seguridad del destino antes de conectar (SSRF y protocolo)
    await this.securityPolicy.validateUrl(reqData.url.toString());

    // 2. Ejecutar intercambio de red único
    const result = await this.performSingleExchange(reqData, redirectsCount, parentSignal);

    // 3. Manejar redirecciones si aplica (301, 302, 303, 307, 308)
    const isRedirect = result.status >= 300 && result.status < 400 && result.headers['location'];

    if (isRedirect && redirectsCount < reqData.maxRedirects) {
      const location = result.headers['location'];
      let nextUrl: URL;

      try {
        nextUrl = new URL(location, reqData.url);
      } catch {
        throw new HttpEngineError(`Encabezado de redirección Location '${location}' no válido.`, 'INVALID_URL');
      }

      // Validar seguridad de la nueva URL destino antes de seguirla
      await this.securityPolicy.validateUrl(nextUrl.toString());

      // Según RFC 7231, en 301, 302 y 303 se suele transformar la petición a GET sin cuerpo
      let nextMethod = reqData.method;
      let nextBody = reqData.body;

      if (result.status === 303 || ((result.status === 301 || result.status === 302) && reqData.method === 'POST')) {
        nextMethod = 'GET';
        nextBody = null;
      }

      const nextReqData: NormalizedHttpRequest = {
        ...reqData,
        url: nextUrl,
        method: nextMethod,
        body: nextBody,
      };

      return this.executeWithRedirects(nextReqData, redirectsCount + 1, parentSignal);
    }

    return result;
  }

  /**
   * Realiza un único intercambio HTTP / HTTPS con Node.js nativo
   */
  private performSingleExchange(
    reqData: NormalizedHttpRequest,
    redirectsCount: number,
    parentSignal?: AbortSignal
  ): Promise<HttpResponseData> {
    return new Promise<HttpResponseData>((resolve, reject) => {
      // 1. Configurar AbortController para Timeout y cancelación externa
      const abortController = new AbortController();
      let isTimedOut = false;
      let isAbortedByParent = false;

      const timeoutTimer = setTimeout(() => {
        isTimedOut = true;
        abortController.abort();
      }, reqData.timeoutMs);

      const onParentAbort = () => {
        isAbortedByParent = true;
        abortController.abort();
      };

      if (parentSignal) {
        if (parentSignal.aborted) {
          clearTimeout(timeoutTimer);
          return reject(new HttpEngineError('La solicitud fue cancelada antes de iniciarse.', 'ABORTED'));
        }
        parentSignal.addEventListener('abort', onParentAbort, { once: true });
      }

      const isHttps = reqData.url.protocol === 'https:';
      const transport = isHttps ? https : http;

      // 2. Configurar opciones del request con lookup seguro para prevenir DNS Rebinding
      const requestOptions: http.RequestOptions = {
        method: reqData.method,
        hostname: reqData.url.hostname,
        port: reqData.url.port || (isHttps ? 443 : 80),
        path: reqData.url.pathname + reqData.url.search,
        headers: {
          ...reqData.headers,
          // Encabezado Host normalizado
          Host: reqData.url.host,
          'User-Agent': reqData.headers['user-agent'] || 'API-Forge/1.0',
          Accept: reqData.headers['accept'] || '*/*',
        },
        lookup: this.securityPolicy.createSafeLookup(),
        signal: abortController.signal,
      };

      // Si hay cuerpo, agregar Content-Length si no está especificado
      if (reqData.body !== null) {
        const bodyLength = Buffer.byteLength(reqData.body, 'utf8');
        (requestOptions.headers as Record<string, string | number>)['Content-Length'] = bodyLength;
      }

      const clientReq = transport.request(requestOptions, (clientRes) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;

        clientRes.on('data', (chunk: Buffer) => {
          totalBytes += chunk.byteLength;

          if (totalBytes > reqData.maxResponseSizeBytes) {
            clearTimeout(timeoutTimer);
            if (parentSignal) {
              parentSignal.removeEventListener('abort', onParentAbort);
            }
            clientReq.destroy();
            return reject(
              new HttpEngineError(
                `El tamaño de la respuesta excedió el límite configurado de ${reqData.maxResponseSizeBytes / 1024} KB.`,
                'RESPONSE_TOO_LARGE'
              )
            );
          }

          chunks.push(chunk);
        });

        clientRes.on('end', () => {
          clearTimeout(timeoutTimer);
          if (parentSignal) {
            parentSignal.removeEventListener('abort', onParentAbort);
          }

          const completeBuffer = Buffer.concat(chunks);
          const statusCode = clientRes.statusCode || 0;
          const statusMessage = clientRes.statusMessage || '';

          const normalized = normalizeResponse(
            statusCode,
            statusMessage,
            clientRes.headers,
            completeBuffer,
            redirectsCount
          );

          resolve(normalized);
        });
      });

      clientReq.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(timeoutTimer);
        if (parentSignal) {
          parentSignal.removeEventListener('abort', onParentAbort);
        }

        if (isTimedOut) {
          return reject(
            new HttpEngineError(
              `Tiempo de espera agotado (${reqData.timeoutMs}ms) al esperar respuesta del destino.`,
              'TIMEOUT'
            )
          );
        }

        if (isAbortedByParent || (abortController.signal.aborted && !isTimedOut)) {
          return reject(new HttpEngineError('La solicitud fue cancelada por el cliente.', 'ABORTED'));
        }

        const errMsg = err.message || '';

        if (errMsg.includes('SSRF') || errMsg.includes('restringida') || errMsg.includes('prohibida')) {
          return reject(new HttpEngineError(errMsg, 'SSRF_BLOCKED'));
        }

        if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
          return reject(new HttpEngineError(`No se pudo resolver el nombre de host: ${err.message}`, 'DNS_RESOLUTION_FAILED'));
        }

        reject(new HttpEngineError(`Error de red al conectar con el destino: ${err.message}`, 'NETWORK_ERROR', { code: err.code }));
      });

      // Escribir cuerpo si existe y finalizar la solicitud
      if (reqData.body !== null) {
        clientReq.write(reqData.body);
      }
      clientReq.end();
    });
  }
}

export const defaultHttpEngine = new HttpEngine();
