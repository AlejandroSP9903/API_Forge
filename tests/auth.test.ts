/**
 * API Forge - Pruebas de Autenticación HTTP (Fase 1G)
 * Valida los 4 métodos de autenticación:
 * 1. Sin autenticación
 * 2. Bearer Token (con y sin prefijo, con variables {{TOKEN}})
 * 3. Basic Auth (codificación Base64 RFC 7617, variables {{USER}} y {{PASS}})
 * 4. API Key (en encabezado HTTP y en parámetro de consulta URL, con variables)
 * Así como la redacción de seguridad en historial y la persistencia en colecciones SQLite.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { HttpEngine } from '../server/engine/httpEngine.ts';
import {
  formatBearerToken,
  encodeBasicAuth,
} from '../src/components/RequestBuilder.tsx';
import {
  sanitizeAuth,
  sanitizeRequestPayload,
  hasProtectedSecrets,
  REDACTED_MARKER,
} from '../src/services/historySecurityService.ts';
import {
  interpolateRequest,
} from '../src/services/environmentService.ts';
import {
  createCollection,
  createSavedRequest,
  getCollectionById,
  updateSavedRequest,
} from '../server/services/collectionsService.ts';
import { initDatabase, closeDatabase } from '../server/db/index.ts';
import { runMigrations } from '../server/db/migrate.ts';
import type {
  ExecuteRequestPayload,
  EnvironmentVariable,
  RequestAuthConfig,
} from '../packages/shared/types.ts';

describe('FASE 1G: Sistema de Autenticación HTTP', () => {
  let server: http.Server;
  let baseUrl: string;
  let testEngine: HttpEngine;

  beforeAll(async () => {
    // 1. Inicializar base de datos de prueba en memoria
    await initDatabase('file::memory:?cache=shared');
    await runMigrations();

    // 2. Servidor HTTP de inspección
    server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);

      if (parsedUrl.pathname === '/auth-inspect') {
        const queryObj: Record<string, string> = {};
        parsedUrl.searchParams.forEach((val, key) => {
          queryObj[key] = val;
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            url: req.url,
            method: req.method,
            headers: req.headers,
            query: queryObj,
          })
        );
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
    await closeDatabase();
  });

  describe('1. Formateo y Helpers de Autenticación', () => {
    it('debe agregar automáticamente el prefijo Bearer si no está presente', () => {
      expect(formatBearerToken('hunter_token_123')).toBe('Bearer hunter_token_123');
      expect(formatBearerToken('   abc_xyz   ')).toBe('Bearer abc_xyz');
    });

    it('no debe duplicar el prefijo Bearer si el usuario ya lo escribió', () => {
      expect(formatBearerToken('Bearer hunter_token_123')).toBe('Bearer hunter_token_123');
      expect(formatBearerToken('bearer my_secret_jwt')).toBe('bearer my_secret_jwt');
      expect(formatBearerToken('BEARER token_upper')).toBe('BEARER token_upper');
    });

    it('debe codificar credenciales Basic Auth en Base64 seguro para UTF-8', () => {
      const encoded = encodeBasicAuth('sung_jinwoo', 'shadow_monarch_99');
      expect(encoded).toBe(btoa('sung_jinwoo:shadow_monarch_99'));

      // Probar decodificación
      const decoded = atob(encoded);
      expect(decoded).toBe('sung_jinwoo:shadow_monarch_99');
    });

    it('debe manejar caracteres especiales y acentos en Basic Auth', () => {
      const encoded = encodeBasicAuth('cazador_áéí', 'contraseña_ñ');
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });
  });

  describe('2. Bearer Token - Ejecución y Resolución', () => {
    it('debe inyectar el encabezado Authorization Bearer al ejecutar', async () => {
      const result = await testEngine.execute({
        url: `${baseUrl}/auth-inspect`,
        method: 'GET',
        auth: {
          type: 'bearer',
          bearer: {
            token: 'hunter_shadow_token_abc',
          },
        },
      });

      expect(result.success).toBe(true);
      const data = result.response?.data as { headers: Record<string, string> };
      expect(data.headers['authorization']).toBe('Bearer hunter_shadow_token_abc');
    });

    it('debe resolver variables {{TOKEN}} en Bearer Token', () => {
      const payload: ExecuteRequestPayload = {
        url: 'https://api.example.com/data',
        method: 'GET',
        auth: {
          type: 'bearer',
          bearer: {
            token: '{{AUTH_TOKEN}}',
          },
        },
      };

      const variables: EnvironmentVariable[] = [
        { id: '1', name: 'AUTH_TOKEN', value: 'resolved_jwt_token_999', isSecret: true },
      ];

      const { interpolatedPayload, resolvedCount, secretVarsUsed } = interpolateRequest(payload, variables);

      expect(interpolatedPayload.auth?.bearer?.token).toBe('resolved_jwt_token_999');
      expect(resolvedCount).toBe(1);
      expect(secretVarsUsed).toContain('AUTH_TOKEN');
    });
  });

  describe('3. Basic Auth - Ejecución y Resolución', () => {
    it('debe inyectar el encabezado Authorization Basic con Base64 al ejecutar', async () => {
      const result = await testEngine.execute({
        url: `${baseUrl}/auth-inspect`,
        method: 'GET',
        auth: {
          type: 'basic',
          basic: {
            username: 'monarch',
            password: 'secret_key_123',
          },
        },
      });

      expect(result.success).toBe(true);
      const data = result.response?.data as { headers: Record<string, string> };
      const expectedBase64 = Buffer.from('monarch:secret_key_123').toString('base64');
      expect(data.headers['authorization']).toBe(`Basic ${expectedBase64}`);
    });

    it('debe resolver variables en usuario y contraseña de Basic Auth', () => {
      const payload: ExecuteRequestPayload = {
        url: 'https://api.example.com/protected',
        method: 'GET',
        auth: {
          type: 'basic',
          basic: {
            username: '{{HUNTER_USER}}',
            password: '{{HUNTER_PASS}}',
          },
        },
      };

      const variables: EnvironmentVariable[] = [
        { id: '1', name: 'HUNTER_USER', value: 'admin_cazador', isSecret: false },
        { id: '2', name: 'HUNTER_PASS', value: 'super_shadow_pwd', isSecret: true },
      ];

      const { interpolatedPayload, resolvedCount, secretVarsUsed } = interpolateRequest(payload, variables);

      expect(interpolatedPayload.auth?.basic?.username).toBe('admin_cazador');
      expect(interpolatedPayload.auth?.basic?.password).toBe('super_shadow_pwd');
      expect(resolvedCount).toBe(2);
      expect(secretVarsUsed).toContain('HUNTER_PASS');
    });
  });

  describe('4. API Key - Inyección en Encabezado y Parámetro de Consulta', () => {
    it('debe inyectar API Key en encabezado HTTP si addTo es header', async () => {
      const result = await testEngine.execute({
        url: `${baseUrl}/auth-inspect`,
        method: 'GET',
        auth: {
          type: 'apikey',
          apiKey: {
            key: 'X-Hunter-Key',
            value: 'val_hunter_888',
            addTo: 'header',
          },
        },
      });

      expect(result.success).toBe(true);
      const data = result.response?.data as { headers: Record<string, string> };
      expect(data.headers['x-hunter-key']).toBe('val_hunter_888');
    });

    it('debe inyectar API Key en query params si addTo es query', async () => {
      const result = await testEngine.execute({
        url: `${baseUrl}/auth-inspect`,
        method: 'GET',
        auth: {
          type: 'apikey',
          apiKey: {
            key: 'api_key',
            value: 'query_key_value_777',
            addTo: 'query',
          },
        },
      });

      expect(result.success).toBe(true);
      const data = result.response?.data as { url: string; query: Record<string, string> };
      expect(data.url).toContain('api_key=query_key_value_777');
      expect(data.query.api_key).toBe('query_key_value_777');
    });

    it('debe resolver variables en clave y valor de API Key', () => {
      const payload: ExecuteRequestPayload = {
        url: 'https://api.example.com/items',
        method: 'GET',
        auth: {
          type: 'apikey',
          apiKey: {
            key: '{{HEADER_NAME}}',
            value: '{{HEADER_VALUE}}',
            addTo: 'header',
          },
        },
      };

      const variables: EnvironmentVariable[] = [
        { id: '1', name: 'HEADER_NAME', value: 'X-System-Key', isSecret: false },
        { id: '2', name: 'HEADER_VALUE', value: 'secret_val_101', isSecret: true },
      ];

      const { interpolatedPayload, resolvedCount } = interpolateRequest(payload, variables);

      expect(interpolatedPayload.auth?.apiKey?.key).toBe('X-System-Key');
      expect(interpolatedPayload.auth?.apiKey?.value).toBe('secret_val_101');
      expect(resolvedCount).toBe(2);
    });
  });

  describe('5. Redacción y Seguridad del Historial (Fase 1G)', () => {
    it('debe redactar tokens Bearer con [VALOR_PROTEGIDO]', () => {
      const auth: RequestAuthConfig = {
        type: 'bearer',
        bearer: {
          token: 'super_secret_token_live',
        },
      };

      const { sanitizedAuth, redactedCount } = sanitizeAuth(auth);
      expect(redactedCount).toBe(1);
      expect(sanitizedAuth?.bearer?.token).toBe(REDACTED_MARKER);
    });

    it('debe preservar plantillas {{TOKEN}} sin redactar en sanitizeAuth', () => {
      const auth: RequestAuthConfig = {
        type: 'bearer',
        bearer: {
          token: '{{MI_VARIABLE}}',
        },
      };

      const { sanitizedAuth, redactedCount } = sanitizeAuth(auth);
      expect(redactedCount).toBe(0);
      expect(sanitizedAuth?.bearer?.token).toBe('{{MI_VARIABLE}}');
    });

    it('debe redactar contraseñas en Basic Auth', () => {
      const auth: RequestAuthConfig = {
        type: 'basic',
        basic: {
          username: 'admin',
          password: 'plain_password_123',
        },
      };

      const { sanitizedAuth, redactedCount } = sanitizeAuth(auth);
      expect(redactedCount).toBe(1);
      expect(sanitizedAuth?.basic?.username).toBe('admin');
      expect(sanitizedAuth?.basic?.password).toBe(REDACTED_MARKER);
    });

    it('debe detectar secretos protegidos en payload con hasProtectedSecrets', () => {
      const payload: ExecuteRequestPayload = {
        url: 'https://api.example.com',
        method: 'GET',
        auth: {
          type: 'bearer',
          bearer: {
            token: REDACTED_MARKER,
          },
        },
      };

      expect(hasProtectedSecrets(payload)).toBe(true);
    });

    it('debe sanitizar payload completo incluyendo auth en sanitizeRequestPayload', () => {
      const payload: ExecuteRequestPayload = {
        url: 'https://api.example.com/secure',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        auth: {
          type: 'bearer',
          bearer: {
            token: 'confidential_token_xyz',
          },
        },
      };

      const { sanitized, redactedCount } = sanitizeRequestPayload(payload);
      expect(redactedCount).toBeGreaterThan(0);
      expect(sanitized.auth?.bearer?.token).toBe(REDACTED_MARKER);
    });
  });

  describe('6. Persistencia de Autenticación en Colecciones SQLite', () => {
    it('debe guardar y recuperar una solicitud con configuración de autenticación Bearer', async () => {
      const col = await createCollection({ name: 'Colección Hunter Auth' });

      const saved = await createSavedRequest(col.id, {
        name: 'Misión con Token',
        method: 'GET',
        url: 'https://api.example.com/hunter-guild',
        auth: {
          type: 'bearer',
          bearer: {
            token: '{{AUTH_TOKEN}}',
          },
        },
      });

      expect(saved.auth?.type).toBe('bearer');
      expect(saved.auth?.bearer?.token).toBe('{{AUTH_TOKEN}}');

      // Leer colección completa y verificar
      const colWithReqs = await getCollectionById(col.id);
      expect(colWithReqs?.requests).toHaveLength(1);
      const reqFromDb = colWithReqs!.requests[0];
      expect(reqFromDb.auth?.type).toBe('bearer');
      expect(reqFromDb.auth?.bearer?.token).toBe('{{AUTH_TOKEN}}');
    });

    it('debe actualizar la autenticación de una solicitud existente', async () => {
      const col = await createCollection({ name: 'Colección Hunter API Key' });

      const saved = await createSavedRequest(col.id, {
        name: 'Misión Inicial',
        method: 'GET',
        url: 'https://api.example.com/v1',
        auth: {
          type: 'none',
        },
      });

      const updated = await updateSavedRequest(col.id, saved.id, {
        auth: {
          type: 'apikey',
          apiKey: {
            key: 'X-API-Key',
            value: '{{MY_API_KEY}}',
            addTo: 'header',
          },
        },
      });

      expect(updated.auth?.type).toBe('apikey');
      expect(updated.auth?.apiKey?.key).toBe('X-API-Key');
      expect(updated.auth?.apiKey?.addTo).toBe('header');
    });
  });
});
