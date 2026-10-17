/**
 * API Forge - Pruebas del Request Builder y Manejo de Solicitudes HTTP (Fase 1F)
 * Valida construcción de URLs con parámetros, separación estricta de encabezados,
 * validación del cuerpo JSON, exclusión de cuerpo en GET y protección de credenciales.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { HttpEngine } from '../server/engine/httpEngine.ts';
import { validateAndNormalizeRequest, ValidationError } from '../server/engine/validation.ts';
import {
  isSensitiveHeader,
  isSensitiveKey,
  sanitizeText,
  REDACTED_MARKER,
} from '../src/services/historySecurityService.ts';
import {
  interpolateRequest,
  interpolateString,
  VariableInterpolationError,
} from '../src/services/environmentService.ts';
import type { ExecuteRequestPayload, EnvironmentVariable } from '../packages/shared/types.ts';

describe('Request Builder - Manejo de Parámetros, Encabezados y URLs (Fase 1F)', () => {
  let server: http.Server;
  let baseUrl: string;
  let testEngine: HttpEngine;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);

      if (parsedUrl.pathname === '/inspect') {
        const queryObj: Record<string, string> = {};
        parsedUrl.searchParams.forEach((val, key) => {
          queryObj[key] = val;
        });

        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          const bodyStr = Buffer.concat(chunks).toString('utf8');
          let parsedJson: unknown = null;
          try {
            parsedJson = bodyStr ? JSON.parse(bodyStr) : null;
          } catch {
            parsedJson = bodyStr;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              url: req.url,
              method: req.method,
              query: queryObj,
              headers: req.headers,
              body: parsedJson,
            })
          );
        });
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    testEngine = new HttpEngine({ allowLoopbackForTesting: true });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('1. debe anexar parámetros de consulta después del signo ? en la URL', async () => {
    const result = await testEngine.execute({
      url: `${baseUrl}/inspect`,
      method: 'GET',
      queryParams: {
        userId: '1',
        _limit: '5',
      },
    });

    expect(result.success).toBe(true);
    expect(result.response?.data).toMatchObject({
      url: '/inspect?userId=1&_limit=5',
      query: {
        userId: '1',
        _limit: '5',
      },
    });
  });

  it('2. debe concatenar parámetros con & si la URL ya contiene query parameters', async () => {
    const result = await testEngine.execute({
      url: `${baseUrl}/inspect?initial=true`,
      method: 'GET',
      queryParams: {
        secondary: 'confirmed',
      },
    });

    expect(result.success).toBe(true);
    expect(result.response?.data).toMatchObject({
      url: '/inspect?initial=true&secondary=confirmed',
      query: {
        initial: 'true',
        secondary: 'confirmed',
      },
    });
  });

  it('3. debe mantener estricta separación entre parámetros de consulta y encabezados HTTP', async () => {
    const result = await testEngine.execute({
      url: `${baseUrl}/inspect`,
      method: 'GET',
      queryParams: {
        filtro: 'activo',
      },
      headers: {
        'X-Custom-Client': 'API-Forge-Hunter',
      },
    });

    expect(result.success).toBe(true);
    const data = result.response?.data as {
      query: Record<string, string>;
      headers: Record<string, string>;
    };

    // El parámetro debe existir en query, NO en headers
    expect(data.query.filtro).toBe('activo');
    expect(data.headers.filtro).toBeUndefined();

    // El encabezado debe existir en headers, NO en query
    expect(data.headers['x-custom-client']).toBe('API-Forge-Hunter');
    expect(data.query['X-Custom-Client']).toBeUndefined();
  });

  it('4. debe rechazar que una petición GET incluya un cuerpo en el motor HTTP', () => {
    expect(() =>
      validateAndNormalizeRequest({
        url: 'https://api.example.com/items',
        method: 'GET',
        body: { error: 'cuerpo no permitido' },
      })
    ).toThrow(ValidationError);
  });

  it('5. debe validar e interpolar parámetros con variables {{VARIABLE}} correctamente', () => {
    const payload: ExecuteRequestPayload = {
      url: '{{BASE_URL}}/posts',
      method: 'GET',
      queryParams: {
        userId: '{{USER_ID}}',
        limit: '10',
      },
      headers: {
        Authorization: 'Bearer {{AUTH_TOKEN}}',
      },
    };

    const variables: EnvironmentVariable[] = [
      { id: '1', name: 'BASE_URL', value: 'https://jsonplaceholder.typicode.com', isSecret: false },
      { id: '2', name: 'USER_ID', value: '42', isSecret: false },
      { id: '3', name: 'AUTH_TOKEN', value: 'hunter_secret_token_123', isSecret: true },
    ];

    const { interpolatedPayload, resolvedCount, secretVarsUsed } = interpolateRequest(payload, variables);

    expect(interpolatedPayload.url).toBe('https://jsonplaceholder.typicode.com/posts');
    expect(interpolatedPayload.queryParams?.userId).toBe('42');
    expect(interpolatedPayload.queryParams?.limit).toBe('10');
    expect(interpolatedPayload.headers?.Authorization).toBe('Bearer hunter_secret_token_123');
    expect(resolvedCount).toBe(3);
    expect(secretVarsUsed).toContain('AUTH_TOKEN');

    // La plantilla original debe mantenerse intacta
    expect(payload.url).toBe('{{BASE_URL}}/posts');
    expect(payload.queryParams?.userId).toBe('{{USER_ID}}');
  });

  it('6. debe clasificar encabezados confidenciales con isSensitiveHeader', () => {
    expect(isSensitiveHeader('Authorization')).toBe(true);
    expect(isSensitiveHeader('authorization')).toBe(true);
    expect(isSensitiveHeader('X-Api-Key')).toBe(true);
    expect(isSensitiveHeader('Cookie')).toBe(true);
    expect(isSensitiveHeader('X-Auth-Token')).toBe(true);

    // Encabezados no sensibles
    expect(isSensitiveHeader('Content-Type')).toBe(false);
    expect(isSensitiveHeader('Accept')).toBe(false);
    expect(isSensitiveHeader('User-Agent')).toBe(false);
  });

  it('7. debe redactar valores de encabezados y parámetros sensibles en el historial', () => {
    const rawHistoryText = 'Token: Bearer my_hunter_super_secret_token en la llamada';
    const { sanitizedText, redactedCount } = sanitizeText(rawHistoryText);

    expect(redactedCount).toBeGreaterThan(0);
    expect(sanitizedText).toContain(REDACTED_MARKER);
    expect(sanitizedText).not.toContain('my_hunter_super_secret_token');
  });

  it('8. debe procesar cuerpos JSON válidos en peticiones POST', async () => {
    const payload = {
      title: 'Misión Rango S',
      completed: true,
      reward: 5000,
    };

    const result = await testEngine.execute({
      url: `${baseUrl}/inspect`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    expect(result.success).toBe(true);
    expect(result.response?.data).toMatchObject({
      method: 'POST',
      body: payload,
    });
  });
});
