/**
 * API Forge - Pruebas Unitarias de Sanitización y Protección de Historial (Fase 1C)
 * Verifica que los secretos, contraseñas, tokens y cookies nunca se persistan en texto plano.
 */

import { describe, it, expect } from 'vitest';
import {
  isSensitiveHeader,
  isSensitiveKey,
  sanitizeUrl,
  sanitizeHeaders,
  sanitizeQueryParams,
  sanitizeBody,
  sanitizeRequestPayload,
  sanitizeHistoryItem,
  migrateAndSanitizeHistory,
  hasProtectedSecrets,
  REDACTED_MARKER,
} from '../src/services/historySecurityService.ts';
import type { ExecuteRequestPayload } from '../packages/shared/types.ts';
import type { MissionHistoryItem } from '../src/types/hunter.ts';

describe('Servicio de Seguridad del Historial (historySecurityService)', () => {
  describe('Detección de Cabeceras y Claves Sensibles', () => {
    it('debe identificar cabeceras de autorización, tokens, cookies y claves de API', () => {
      expect(isSensitiveHeader('Authorization')).toBe(true);
      expect(isSensitiveHeader('authorization')).toBe(true);
      expect(isSensitiveHeader('Proxy-Authorization')).toBe(true);
      expect(isSensitiveHeader('Cookie')).toBe(true);
      expect(isSensitiveHeader('Set-Cookie')).toBe(true);
      expect(isSensitiveHeader('x-api-key')).toBe(true);
      expect(isSensitiveHeader('X-Auth-Token')).toBe(true);
      expect(isSensitiveHeader('X-Access-Token')).toBe(true);
      expect(isSensitiveHeader('x-custom-secret')).toBe(true);
      expect(isSensitiveHeader('x-credential-id')).toBe(true);
    });

    it('no debe marcar cabeceras normales como sensibles', () => {
      expect(isSensitiveHeader('Content-Type')).toBe(false);
      expect(isSensitiveHeader('Accept')).toBe(false);
      expect(isSensitiveHeader('User-Agent')).toBe(false);
      expect(isSensitiveHeader('Cache-Control')).toBe(false);
      expect(isSensitiveHeader('X-Requested-With')).toBe(false);
    });

    it('debe identificar nombres de parámetros sensibles', () => {
      expect(isSensitiveKey('api_key')).toBe(true);
      expect(isSensitiveKey('apiKey')).toBe(true);
      expect(isSensitiveKey('token')).toBe(true);
      expect(isSensitiveKey('access_token')).toBe(true);
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('client_secret')).toBe(true);
      expect(isSensitiveKey('sig')).toBe(true);
      expect(isSensitiveKey('signature')).toBe(true);
    });

    it('no debe marcar parámetros estándar como sensibles', () => {
      expect(isSensitiveKey('page')).toBe(false);
      expect(isSensitiveKey('limit')).toBe(false);
      expect(isSensitiveKey('sort')).toBe(false);
      expect(isSensitiveKey('query')).toBe(false);
      expect(isSensitiveKey('userId')).toBe(false);
    });
  });

  describe('Sanitización de URLs', () => {
    it('debe redactar contraseñas de Basic Auth en la URL', () => {
      const raw = 'https://admin:SuperSecretPass123@api.example.com/v1/resource';
      const { sanitizedUrl, redactedCount } = sanitizeUrl(raw);

      expect(redactedCount).toBe(1);
      expect(sanitizedUrl).toContain(`admin:${REDACTED_MARKER}@api.example.com`);
      expect(sanitizedUrl).not.toContain('SuperSecretPass123');
    });

    it('debe redactar parámetros de consulta sensibles dentro de la URL', () => {
      const raw = 'https://api.example.com/data?token=ghp_abc123456&userId=42&apiKey=xyz789';
      const { sanitizedUrl, redactedCount } = sanitizeUrl(raw);

      expect(redactedCount).toBe(2);
      expect(sanitizedUrl).toContain(`token=${REDACTED_MARKER}`);
      expect(sanitizedUrl).toContain(`apiKey=${REDACTED_MARKER}`);
      expect(sanitizedUrl).toContain('userId=42');
      expect(sanitizedUrl).not.toContain('ghp_abc123456');
      expect(sanitizedUrl).not.toContain('xyz789');
    });

    it('debe preservar URLs limpias sin modificar', () => {
      const raw = 'https://jsonplaceholder.typicode.com/posts/1?page=2';
      const { sanitizedUrl, redactedCount } = sanitizeUrl(raw);

      expect(redactedCount).toBe(0);
      expect(sanitizedUrl).toBe(raw);
    });
  });

  describe('Sanitización de Encabezados (Headers)', () => {
    it('debe redactar valores de Authorization, Cookie y API Keys conservando sus nombres', () => {
      const headers = {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret',
        Cookie: 'session_id=abcdef123456; secure',
        'X-Api-Key': 'ak_live_9988776655',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      const { sanitizedHeaders, redactedCount } = sanitizeHeaders(headers);

      expect(redactedCount).toBe(3);
      expect(sanitizedHeaders).toBeDefined();
      expect(sanitizedHeaders!['Authorization']).toBe(REDACTED_MARKER);
      expect(sanitizedHeaders!['Cookie']).toBe(REDACTED_MARKER);
      expect(sanitizedHeaders!['X-Api-Key']).toBe(REDACTED_MARKER);
      expect(sanitizedHeaders!['Content-Type']).toBe('application/json');
      expect(sanitizedHeaders!['Accept']).toBe('application/json');
    });

    it('debe redactar tokens Bearer incluso en cabeceras no estándar', () => {
      const headers = {
        'X-Forwarded-Auth': 'Bearer topsecretvalue123',
        Host: 'example.com',
      };

      const { sanitizedHeaders, redactedCount } = sanitizeHeaders(headers);
      expect(redactedCount).toBe(1);
      expect(sanitizedHeaders!['X-Forwarded-Auth']).toContain(REDACTED_MARKER);
      expect(sanitizedHeaders!['X-Forwarded-Auth']).not.toContain('topsecretvalue123');
    });
  });

  describe('Sanitización de Parámetros de Consulta (Query Params)', () => {
    it('debe redactar tokens y claves manteniendo parámetros no sensibles', () => {
      const params = {
        apiKey: 'hunter-key-999',
        page: 1,
        limit: 25,
        access_token: 'tok_5544332211',
      };

      const { sanitizedParams, redactedCount } = sanitizeQueryParams(params);

      expect(redactedCount).toBe(2);
      expect(sanitizedParams!['apiKey']).toBe(REDACTED_MARKER);
      expect(sanitizedParams!['access_token']).toBe(REDACTED_MARKER);
      expect(sanitizedParams!['page']).toBe(1);
      expect(sanitizedParams!['limit']).toBe(25);
    });
  });

  describe('Sanitización del Cuerpo (Body)', () => {
    it('debe redactar contraseñas y tokens en objetos JSON anidados', () => {
      const bodyObj = {
        username: 'sung_jinwoo',
        password: 'ShadowMonarchPassword!',
        profile: {
          email: 'cazador@api-forge.local',
          token: 'jwt_nested_secret_123',
          stats: {
            rank: 'S',
            secretCode: 'TopSecretManaKey',
          },
        },
      };

      const { sanitizedBody, redactedCount } = sanitizeBody(bodyObj);

      expect(redactedCount).toBe(3);
      const cast = sanitizedBody as typeof bodyObj;
      expect(cast.username).toBe('sung_jinwoo');
      expect(cast.password).toBe(REDACTED_MARKER);
      expect(cast.profile.token).toBe(REDACTED_MARKER);
      expect(cast.profile.stats.secretCode).toBe(REDACTED_MARKER);
      expect(cast.profile.stats.rank).toBe('S');
    });

    it('debe redactar JSON serializado como cadena de texto', () => {
      const jsonString = JSON.stringify({
        email: 'user@test.com',
        client_secret: 'secret_abc_xyz',
      });

      const { sanitizedBody, redactedCount } = sanitizeBody(jsonString);

      expect(redactedCount).toBe(1);
      expect(typeof sanitizedBody).toBe('string');
      const parsed = JSON.parse(sanitizedBody as string);
      expect(parsed.email).toBe('user@test.com');
      expect(parsed.client_secret).toBe(REDACTED_MARKER);
    });

    it('debe redactar cadenas codificadas en formato URL-encoded', () => {
      const formBody = 'grant_type=password&username=hunter&password=supersecret&client_secret=key123';
      const { sanitizedBody, redactedCount } = sanitizeBody(formBody);

      expect(redactedCount).toBe(2);
      expect(sanitizedBody).toContain(`password=${REDACTED_MARKER}`);
      expect(sanitizedBody).toContain(`client_secret=${REDACTED_MARKER}`);
      expect(sanitizedBody).toContain('username=hunter');
    });
  });

  describe('Sanitización Integral de Solicitud y Migración de Historial', () => {
    it('debe sanitizar una carga útil completa y detectar presencia de secretos protegidos', () => {
      const payload: ExecuteRequestPayload = {
        url: 'https://api.external.com/v1/auth?apiKey=live_sec_123',
        method: 'POST',
        headers: {
          Authorization: 'Bearer tok_887766',
          'Content-Type': 'application/json',
        },
        queryParams: {
          token: 'query_tok_999',
          scope: 'read_write',
        },
        body: {
          client_secret: 'cs_xyz_321',
          name: 'Operación Shadow',
        },
      };

      const { sanitized, redactedCount } = sanitizeRequestPayload(payload);

      expect(redactedCount).toBe(4);
      expect(hasProtectedSecrets(sanitized)).toBe(true);
      expect(hasProtectedSecrets(payload)).toBe(false); // La original no tiene marcadores
      expect(sanitized.headers!['Authorization']).toBe(REDACTED_MARKER);
      expect(sanitized.queryParams!['token']).toBe(REDACTED_MARKER);
      expect((sanitized.body as Record<string, unknown>).client_secret).toBe(REDACTED_MARKER);
    });

    it('debe migrar y limpiar registros antiguos del historial que contengan texto plano', () => {
      const legacyHistory: MissionHistoryItem[] = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          method: 'GET',
          url: 'https://api.example.com/posts/1',
          durationMs: 50,
          success: true,
          payload: {
            url: 'https://api.example.com/posts/1',
            method: 'GET',
          },
        },
        {
          id: '2',
          timestamp: new Date().toISOString(),
          method: 'POST',
          url: 'https://api.example.com/login',
          durationMs: 120,
          success: true,
          payload: {
            url: 'https://api.example.com/login',
            method: 'POST',
            headers: {
              Authorization: 'Bearer legacy_plaintext_secret_token_to_redact',
            },
            body: {
              password: 'plaintext_password_in_storage',
            },
          },
        },
      ];

      const { items, modifiedCount } = migrateAndSanitizeHistory(legacyHistory);

      expect(modifiedCount).toBe(1);
      expect(items[0].hasProtectedSecrets).toBe(false);
      expect(items[1].hasProtectedSecrets).toBe(true);
      expect(items[1].payload.headers!['Authorization']).toBe(REDACTED_MARKER);
      expect((items[1].payload.body as Record<string, unknown>).password).toBe(REDACTED_MARKER);
    });
  });
});
