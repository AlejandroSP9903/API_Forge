/**
 * API Forge - Pruebas Unitarias y de Seguridad del Historial (Fase 1C-R)
 * Verifica que los secretos, contraseñas, tokens y cookies nunca se persistan en texto plano,
 * valida la migración e idempotencia del almacenamiento local y la tolerancia a datos malformados.
 */

import { describe, it, expect } from 'vitest';
import {
  isSensitiveHeader,
  isSensitiveKey,
  sanitizeText,
  sanitizeUrl,
  sanitizeHeaders,
  sanitizeQueryParams,
  sanitizeBody,
  sanitizeResult,
  sanitizeRequestPayload,
  sanitizeHistoryItem,
  migrateAndSanitizeHistory,
  hasProtectedSecrets,
  REDACTED_MARKER,
} from '../src/services/historySecurityService.ts';
import type { ExecuteRequestPayload, ExecuteRequestResult } from '../packages/shared/types.ts';
import type { MissionHistoryItem } from '../src/types/hunter.ts';
import { validateAndNormalizeRequest, ValidationError } from '../server/engine/validation.ts';

describe('Servicio de Seguridad del Historial (historySecurityService)', () => {
  describe('Detección de Cabeceras y Claves Sensibles (Insensible a mayúsculas/minúsculas)', () => {
    it('debe identificar cabeceras de autorización, tokens, cookies y claves de API en cualquier combinación de mayúsculas', () => {
      expect(isSensitiveHeader('Authorization')).toBe(true);
      expect(isSensitiveHeader('authorization')).toBe(true);
      expect(isSensitiveHeader('AUTHORIZATION')).toBe(true);
      expect(isSensitiveHeader('Proxy-Authorization')).toBe(true);
      expect(isSensitiveHeader('proxy-authorization')).toBe(true);
      expect(isSensitiveHeader('Cookie')).toBe(true);
      expect(isSensitiveHeader('cookie')).toBe(true);
      expect(isSensitiveHeader('COOKIE')).toBe(true);
      expect(isSensitiveHeader('Set-Cookie')).toBe(true);
      expect(isSensitiveHeader('set-cookie')).toBe(true);
      expect(isSensitiveHeader('x-api-key')).toBe(true);
      expect(isSensitiveHeader('X-Api-Key')).toBe(true);
      expect(isSensitiveHeader('X-API-KEY')).toBe(true);
      expect(isSensitiveHeader('X-Auth-Token')).toBe(true);
      expect(isSensitiveHeader('x-access-token')).toBe(true);
      expect(isSensitiveHeader('x-custom-secret')).toBe(true);
      expect(isSensitiveHeader('x-credential-id')).toBe(true);
      expect(isSensitiveHeader('x-signature')).toBe(true);
      expect(isSensitiveHeader('X-Signature')).toBe(true);
      expect(isSensitiveHeader('signature')).toBe(true);
      expect(isSensitiveHeader('x-session-id')).toBe(true);
    });

    it('no debe marcar cabeceras normales como sensibles', () => {
      expect(isSensitiveHeader('Content-Type')).toBe(false);
      expect(isSensitiveHeader('Accept')).toBe(false);
      expect(isSensitiveHeader('User-Agent')).toBe(false);
      expect(isSensitiveHeader('Cache-Control')).toBe(false);
      expect(isSensitiveHeader('X-Requested-With')).toBe(false);
      expect(isSensitiveHeader('Origin')).toBe(false);
    });

    it('debe identificar nombres de parámetros sensibles en camelCase, snake_case y UPPERCASE', () => {
      expect(isSensitiveKey('api_key')).toBe(true);
      expect(isSensitiveKey('apiKey')).toBe(true);
      expect(isSensitiveKey('API_KEY')).toBe(true);
      expect(isSensitiveKey('token')).toBe(true);
      expect(isSensitiveKey('TOKEN')).toBe(true);
      expect(isSensitiveKey('access_token')).toBe(true);
      expect(isSensitiveKey('accessToken')).toBe(true);
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('PASSWORD')).toBe(true);
      expect(isSensitiveKey('userPassword')).toBe(true);
      expect(isSensitiveKey('client_secret')).toBe(true);
      expect(isSensitiveKey('clientSecret')).toBe(true);
      expect(isSensitiveKey('secret')).toBe(true);
      expect(isSensitiveKey('SECRET')).toBe(true);
      expect(isSensitiveKey('sig')).toBe(true);
      expect(isSensitiveKey('SIG')).toBe(true);
      expect(isSensitiveKey('signature')).toBe(true);
      expect(isSensitiveKey('SIGNATURE')).toBe(true);
      expect(isSensitiveKey('urlSignature')).toBe(true);
      expect(isSensitiveKey('webhook_signature')).toBe(true);
      expect(isSensitiveKey('passwd')).toBe(true);
      expect(isSensitiveKey('passcode')).toBe(true);
    });

    it('no debe marcar parámetros estándar no sensibles', () => {
      expect(isSensitiveKey('page')).toBe(false);
      expect(isSensitiveKey('limit')).toBe(false);
      expect(isSensitiveKey('sort')).toBe(false);
      expect(isSensitiveKey('query')).toBe(false);
      expect(isSensitiveKey('userId')).toBe(false);
      expect(isSensitiveKey('status')).toBe(false);
    });
  });

  describe('Sanitización de URLs y Credenciales Incrustadas', () => {
    it('debe redactar contraseñas de Basic Auth en la URL', () => {
      const raw = 'https://admin:SuperSecretPass123@api.example.com/v1/resource';
      const { sanitizedUrl, redactedCount } = sanitizeUrl(raw);

      expect(redactedCount).toBe(1);
      expect(sanitizedUrl).toContain(`admin:${REDACTED_MARKER}@api.example.com`);
      expect(sanitizedUrl).not.toContain('SuperSecretPass123');
    });

    it('debe redactar tokens cuando actúan como usuario en la URL', () => {
      const raw = 'https://ghp_abcdefghijklmnopqrstuvwxyz012345@github.com/org/repo';
      const { sanitizedUrl, redactedCount } = sanitizeUrl(raw);

      expect(redactedCount).toBe(1);
      expect(sanitizedUrl).toContain(`${REDACTED_MARKER}@github.com`);
      expect(sanitizedUrl).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz012345');
    });

    it('debe redactar múltiples parámetros sensibles (token, api_key, password, secret, signature)', () => {
      const raw = 'https://api.example.com/data?token=tok123&api_key=key456&password=pass789&secret=sec000&signature=sig999&page=1&limit=20';
      const { sanitizedUrl, redactedCount } = sanitizeUrl(raw);

      expect(redactedCount).toBe(5);
      expect(sanitizedUrl).toContain(`token=${REDACTED_MARKER}`);
      expect(sanitizedUrl).toContain(`api_key=${REDACTED_MARKER}`);
      expect(sanitizedUrl).toContain(`password=${REDACTED_MARKER}`);
      expect(sanitizedUrl).toContain(`secret=${REDACTED_MARKER}`);
      expect(sanitizedUrl).toContain(`signature=${REDACTED_MARKER}`);
      expect(sanitizedUrl).toContain('page=1');
      expect(sanitizedUrl).toContain('limit=20');
      expect(sanitizedUrl).not.toContain('tok123');
      expect(sanitizedUrl).not.toContain('key456');
      expect(sanitizedUrl).not.toContain('pass789');
      expect(sanitizedUrl).not.toContain('sec000');
      expect(sanitizedUrl).not.toContain('sig999');
    });

    it('debe preservar URLs limpias sin modificar', () => {
      const raw = 'https://jsonplaceholder.typicode.com/posts/1?page=2&filter=active';
      const { sanitizedUrl, redactedCount } = sanitizeUrl(raw);

      expect(redactedCount).toBe(0);
      expect(sanitizedUrl).toBe(raw);
    });

    it('debe ser estrictamente IDEMPOTENTE: ejecutar dos veces sanitizeUrl no debe volver a redactar ni alterar la URL', () => {
      const raw = 'https://admin:SuperSecretPass123@api.example.com/v1/resource?token=sec_abc123';
      const step1 = sanitizeUrl(raw);
      expect(step1.redactedCount).toBe(2);

      const step2 = sanitizeUrl(step1.sanitizedUrl);
      expect(step2.redactedCount).toBe(0);
      expect(step2.sanitizedUrl).toBe(step1.sanitizedUrl);
    });
  });

  describe('Sanitización de Encabezados (Headers)', () => {
    it('debe redactar valores de Authorization, Cookie, Proxy-Authorization y x-api-key en cualquier casing', () => {
      const headers = {
        AUTHORIZATION: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret',
        Cookie: 'session_id=abcdef123456; csrf=secretCsrfToken; secure',
        'proxy-authorization': 'Basic dXNlcjpwYXNzd29yZA==',
        'X-API-KEY': 'ak_live_9988776655',
        'X-Signature': 'sha256=123456abcdef',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      const { sanitizedHeaders, redactedCount } = sanitizeHeaders(headers);

      expect(redactedCount).toBe(5);
      expect(sanitizedHeaders).toBeDefined();
      expect(sanitizedHeaders!['AUTHORIZATION']).toBe(REDACTED_MARKER);
      expect(sanitizedHeaders!['Cookie']).toBe(REDACTED_MARKER);
      expect(sanitizedHeaders!['proxy-authorization']).toBe(REDACTED_MARKER);
      expect(sanitizedHeaders!['X-API-KEY']).toBe(REDACTED_MARKER);
      expect(sanitizedHeaders!['X-Signature']).toBe(REDACTED_MARKER);
      expect(sanitizedHeaders!['Content-Type']).toBe('application/json');
      expect(sanitizedHeaders!['Accept']).toBe('application/json');
      expect(JSON.stringify(sanitizedHeaders)).not.toContain('abcdef123456');
    });

    it('debe redactar tokens Bearer y JWT incluso si están en encabezados personalizados no estándar', () => {
      const headers = {
        'X-Custom-Gateway': 'Bearer topsecretvalue123',
        'X-Session-Relay': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozS6qYZs19pPZ_1234567890',
        Host: 'example.com',
      };

      const { sanitizedHeaders, redactedCount } = sanitizeHeaders(headers);
      expect(redactedCount).toBe(2);
      expect(sanitizedHeaders!['X-Custom-Gateway']).toBe(`Bearer ${REDACTED_MARKER}`);
      expect(sanitizedHeaders!['X-Session-Relay']).toBe(REDACTED_MARKER);
      expect(sanitizedHeaders!['Host']).toBe('example.com');
    });

    it('debe ser IDEMPOTENTE: volver a sanitizar encabezados ya protegidos no incrementa redactedCount', () => {
      const initial = {
        Authorization: 'Bearer initial_secret',
        'X-Api-Key': 'key_abc',
        Accept: 'application/json',
      };
      const run1 = sanitizeHeaders(initial);
      expect(run1.redactedCount).toBe(2);

      const run2 = sanitizeHeaders(run1.sanitizedHeaders);
      expect(run2.redactedCount).toBe(0);
      expect(run2.sanitizedHeaders).toEqual(run1.sanitizedHeaders);
    });
  });

  describe('Sanitización de Cuerpos (Body) con Objetos Anidados, Arreglos y Patrones de Credenciales', () => {
    it('debe redactar contraseñas y tokens en objetos JSON anidados y en arreglos', () => {
      const bodyObj = {
        username: 'hunter_pro',
        password: 'TopSecretPassword123!',
        tokens: ['token_alpha_123', 'token_beta_456'],
        profile: {
          email: 'hunter@api-forge.local',
          token: 'jwt_nested_secret_123',
          stats: {
            rank: 'S',
            clientSecret: 'secret_mana_core',
          },
        },
        accounts: [
          { service: 'auth-server', password: 'nested_array_password' },
          { service: 'database', apiKey: 'db_secret_key' },
        ],
      };

      const { sanitizedBody, redactedCount } = sanitizeBody(bodyObj);

      expect(redactedCount).toBe(6);
      const cast = sanitizedBody as typeof bodyObj;
      expect(cast.username).toBe('hunter_pro');
      expect(cast.password).toBe(REDACTED_MARKER);
      expect(cast.tokens).toBe(REDACTED_MARKER);
      expect(cast.profile.token).toBe(REDACTED_MARKER);
      expect(cast.profile.stats.clientSecret).toBe(REDACTED_MARKER);
      expect(cast.profile.stats.rank).toBe('S');
      expect(cast.accounts[0].password).toBe(REDACTED_MARKER);
      expect(cast.accounts[1].apiKey).toBe(REDACTED_MARKER);

      const jsonStr = JSON.stringify(sanitizedBody);
      expect(jsonStr).not.toContain('TopSecretPassword123!');
      expect(jsonStr).not.toContain('nested_array_password');
      expect(jsonStr).not.toContain('db_secret_key');
    });

    it('debe redactar claves privadas PEM y tokens JWT en cadenas de texto libre', () => {
      const text = `
        Configuración de inicio de sesión:
        Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2VjcmV0X2tleV9leGFtcGxl
        -----BEGIN RSA PRIVATE KEY-----
        MIIEowIBAAKCAQEA0Y1+secret_key_material_here+abcdef==
        -----END RSA PRIVATE KEY-----
        apiKey=live_sec_token_999
      `;

      const { sanitizedBody, redactedCount } = sanitizeBody(text);

      expect(redactedCount).toBeGreaterThanOrEqual(2);
      expect(typeof sanitizedBody).toBe('string');
      expect(sanitizedBody).toContain(`Bearer ${REDACTED_MARKER}`);
      expect(sanitizedBody).toContain('-----BEGIN PRIVATE KEY-----');
      expect(sanitizedBody).not.toContain('secret_key_material_here');
      expect(sanitizedBody).not.toContain('live_sec_token_999');
    });

    it('debe redactar cadenas codificadas en formato URL-encoded (form-urlencoded)', () => {
      const formBody = 'grant_type=password&username=hunter&password=supersecret&client_secret=key123&signature=sig_abc';
      const { sanitizedBody, redactedCount } = sanitizeBody(formBody);

      expect(redactedCount).toBe(3);
      expect(sanitizedBody).toContain(`password=${REDACTED_MARKER}`);
      expect(sanitizedBody).toContain(`client_secret=${REDACTED_MARKER}`);
      expect(sanitizedBody).toContain(`signature=${REDACTED_MARKER}`);
      expect(sanitizedBody).toContain('username=hunter');
      expect(sanitizedBody).not.toContain('supersecret');
      expect(sanitizedBody).not.toContain('key123');
      expect(sanitizedBody).not.toContain('sig_abc');
    });
  });

  describe('Sanitización de Resultados de Ejecución (ExecuteRequestResult)', () => {
    it('debe redactar cabeceras Set-Cookie y tokens en el cuerpo de la respuesta', () => {
      const rawResult: ExecuteRequestResult = {
        success: true,
        response: {
          status: 200,
          statusText: 'OK',
          headers: {
            'set-cookie': 'session_token=secret_session_val_999; HttpOnly; Secure',
            'content-type': 'application/json',
          },
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'secret_oauth_access_token_123',
            refresh_token: 'secret_refresh_token_456',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          data: {
            access_token: 'secret_oauth_access_token_123',
            refresh_token: 'secret_refresh_token_456',
            token_type: 'Bearer',
            expires_in: 3600,
          },
          sizeBytes: 150,
          redirectsCount: 0,
        },
        timing: {
          durationMs: 45,
          startedAt: '2026-10-15T00:00:00.000Z',
          completedAt: '2026-10-15T00:00:00.045Z',
        },
      };

      const { sanitizedResult, redactedCount } = sanitizeResult(rawResult);

      expect(redactedCount).toBeGreaterThanOrEqual(3);
      expect(sanitizedResult).toBeDefined();
      expect(sanitizedResult!.response!.headers['set-cookie']).toBe(REDACTED_MARKER);
      expect(sanitizedResult!.response!.body).toContain(`"access_token": "${REDACTED_MARKER}"`);
      expect(sanitizedResult!.response!.body).toContain(`"refresh_token": "${REDACTED_MARKER}"`);
      expect(sanitizedResult!.response!.body).not.toContain('secret_oauth_access_token_123');
      expect(sanitizedResult!.response!.status).toBe(200);
      expect(sanitizedResult!.timing.durationMs).toBe(45);
    });

    it('debe redactar credenciales incrustadas en mensajes de error', () => {
      const errResult: ExecuteRequestResult = {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Error al conectar con https://user:super_secret_pw@api.example.com/login?token=leak_token',
        },
        timing: {
          durationMs: 12,
          startedAt: '2026-10-15T00:00:00.000Z',
          completedAt: '2026-10-15T00:00:00.012Z',
        },
      };

      const { sanitizedResult, redactedCount } = sanitizeResult(errResult);

      expect(redactedCount).toBeGreaterThanOrEqual(1);
      expect(sanitizedResult!.error!.message).toContain(REDACTED_MARKER);
      expect(sanitizedResult!.error!.message).not.toContain('super_secret_pw');
      expect(sanitizedResult!.error!.message).not.toContain('leak_token');
      expect(sanitizedResult!.error!.code).toBe('NETWORK_ERROR');
    });
  });

  describe('Migración e Idempotencia del Historial Antiguo (Objetivo 1 y 4)', () => {
    it('debe migrar un historial antiguo con tokens, cookies y contraseñas, asegurando que no queden secretos en texto plano', () => {
      const legacyHistory: MissionHistoryItem[] = [
        {
          id: 'mission-legacy-1',
          timestamp: '2026-10-14T10:00:00.000Z',
          method: 'GET',
          url: 'https://api.example.com/v1/profile?token=plain_token_abc&apiKey=plain_key_xyz',
          durationMs: 40,
          success: true,
          payload: {
            url: 'https://api.example.com/v1/profile?token=plain_token_abc&apiKey=plain_key_xyz',
            method: 'GET',
            headers: {
              Cookie: 'session=plain_cookie_123',
              Authorization: 'Bearer plain_bearer_token_789',
            },
          },
          result: {
            success: true,
            response: {
              status: 200,
              statusText: 'OK',
              headers: { 'set-cookie': 'sid=plain_response_cookie_999' },
              contentType: 'application/json',
              body: '{"status":"ok","secretCode":"top_secret_code_123"}',
              sizeBytes: 40,
              redirectsCount: 0,
            },
            timing: { durationMs: 40, startedAt: '', completedAt: '' },
          },
        },
      ];

      const { items, modifiedCount } = migrateAndSanitizeHistory(legacyHistory);

      expect(modifiedCount).toBe(1);
      expect(items.length).toBe(1);
      expect(items[0].hasProtectedSecrets).toBe(true);

      const serialized = JSON.stringify(items);
      expect(serialized).not.toContain('plain_token_abc');
      expect(serialized).not.toContain('plain_key_xyz');
      expect(serialized).not.toContain('plain_cookie_123');
      expect(serialized).not.toContain('plain_bearer_token_789');
      expect(serialized).not.toContain('plain_response_cookie_999');
      expect(serialized).not.toContain('top_secret_code_123');
      expect(serialized).toContain(REDACTED_MARKER);
    });

    it('debe ser estrictamente IDEMPOTENTE: ejecutar la migración dos veces no debe corromper los registros ni re-modificarlos', () => {
      const legacyHistory: MissionHistoryItem[] = [
        {
          id: 'mission-idempotence-1',
          timestamp: '2026-10-14T10:00:00.000Z',
          method: 'POST',
          url: 'https://user:plain_pw@api.example.com/auth',
          durationMs: 80,
          success: true,
          payload: {
            url: 'https://user:plain_pw@api.example.com/auth',
            method: 'POST',
            headers: {
              Authorization: 'Bearer secret_token_value',
            },
            body: {
              client_secret: 'plain_client_secret',
            },
          },
        },
      ];

      const step1 = migrateAndSanitizeHistory(legacyHistory);
      expect(step1.modifiedCount).toBe(1);
      const snapshotStep1 = JSON.stringify(step1.items);

      const step2 = migrateAndSanitizeHistory(step1.items);
      expect(step2.modifiedCount).toBe(0);
      const snapshotStep2 = JSON.stringify(step2.items);

      expect(snapshotStep2).toBe(snapshotStep1);
    });

    it('debe manejar datos malformados en el historial sin borrar registros válidos indiscriminadamente', () => {
      const mixedHistory: unknown[] = [
        null,
        undefined,
        'cadena_de_texto_corrupta',
        42,
        { id: 'item-valido-1', url: 'https://api.example.com/posts/1', method: 'GET', durationMs: 30, success: true, payload: { url: 'https://api.example.com/posts/1', method: 'GET' } },
        { someCorruptedKey: true },
        {
          id: 'item-valido-2',
          url: 'https://api.example.com/login',
          method: 'POST',
          durationMs: 90,
          success: true,
          payload: {
            url: 'https://api.example.com/login',
            method: 'POST',
            headers: { Authorization: 'Bearer leaked_secret' },
          },
        },
      ];

      const { items, modifiedCount, corruptedCount } = migrateAndSanitizeHistory(mixedHistory);

      expect(corruptedCount).toBe(5);
      expect(items.length).toBe(2);
      expect(modifiedCount).toBe(1);
      expect(items[0].id).toBe('item-valido-1');
      expect(items[1].id).toBe('item-valido-2');
      expect(items[1].payload.headers!['Authorization']).toBe(REDACTED_MARKER);
    });
  });

  describe('Prevención de Fuga de Credenciales en Mensajes de Error (Objetivo 3)', () => {
    it('ValidationError no debe incluir contraseñas ni tokens en el mensaje de error de URL inválida', () => {
      const badUrlWithCreds = 'http://admin:SuperSecretPassword123@invalid hostname:99999/path?token=leaked_query_token';

      try {
        validateAndNormalizeRequest({
          url: badUrlWithCreds,
          method: 'GET',
        });
        expect.unreachable('Debería haber lanzado ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        const errMsg = (err as ValidationError).message;
        expect(errMsg).not.toContain('SuperSecretPassword123');
        expect(errMsg).not.toContain('leaked_query_token');
        expect(errMsg).toContain(REDACTED_MARKER);
      }
    });

    it('sanitizeText debe sanitizar mensajes de error arbitrarios conservando la explicación técnica', () => {
      const errorMsg = 'Fallo de conexión SSL con https://api.service.com/oauth/token (token=sec_abc_123). Timeout 5000ms.';
      const { sanitizedText, redactedCount } = sanitizeText(errorMsg);

      expect(redactedCount).toBe(1);
      expect(sanitizedText).toContain('token=[VALOR_PROTEGIDO]');
      expect(sanitizedText).toContain('Timeout 5000ms.');
      expect(sanitizedText).not.toContain('sec_abc_123');
    });
  });
});
