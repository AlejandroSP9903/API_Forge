/**
 * API Forge - Pruebas de Seguridad SSRF en Endpoint Público (Fase 1A)
 * Valida que POST /api/requests/execute rechace de manera estricta localhost,
 * loopback, redes privadas, representaciones alternativas de IP y metadatos cloud.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.ts';

describe('SSRF Protection - POST /api/requests/execute', () => {
  const app = createApp();

  const forbiddenTargets = [
    { label: 'localhost clásico', url: 'http://localhost:3000/api/health' },
    { label: 'loopback IPv4 127.0.0.1', url: 'http://127.0.0.1:8080/admin' },
    { label: 'loopback en notación octal (0177.0.0.1)', url: 'http://0177.0.0.1:8080' },
    { label: 'loopback en notación hexadecimal (0x7f000001)', url: 'http://0x7f000001:8080' },
    { label: 'loopback en formato entero decimal (2130706433)', url: 'http://2130706433:8080' },
    { label: 'loopback IPv6 ([::1])', url: 'http://[::1]:8080' },
    { label: 'servicio de metadatos de nube (169.254.169.254)', url: 'http://169.254.169.254/computeMetadata/v1/' },
    { label: 'hostname de metadatos de GCP (metadata.google.internal)', url: 'http://metadata.google.internal/computeMetadata/v1/' },
    { label: 'red privada clase A (10.0.0.1)', url: 'http://10.0.0.1/status' },
    { label: 'red privada clase B (172.16.0.1)', url: 'http://172.16.0.1:8000' },
    { label: 'red privada clase C (192.168.1.1)', url: 'http://192.168.1.1:8080' },
    { label: 'dirección link-local (169.254.1.1)', url: 'http://169.254.1.1' },
    { label: 'dirección 0.0.0.0', url: 'http://0.0.0.0:3000' },
  ];

  for (const target of forbiddenTargets) {
    it(`debe rechazar ${target.label} con código SSRF_BLOCKED`, async () => {
      const res = await request(app)
        .post('/api/requests/execute')
        .send({
          url: target.url,
          method: 'GET',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('SSRF_BLOCKED');
      expect(res.body.error.message).toMatch(/bloquead[ao]|restringid[ao]|seguridad/i);
    });
  }

  it('no debe permitir que el usuario eluda las protecciones mediante parámetros en el payload', async () => {
    // Intento malicioso de enviar banderas de prueba en la petición pública
    const res = await request(app)
      .post('/api/requests/execute')
      .send({
        url: 'http://127.0.0.1:3000',
        method: 'GET',
        allowLoopbackForTesting: true,
        bypassSecurity: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SSRF_BLOCKED');
  });

  it('debe rechazar solicitudes con protocolos prohibidos como file: o ftp:', async () => {
    const res = await request(app)
      .post('/api/requests/execute')
      .send({
        url: 'file:///etc/passwd',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN_PROTOCOL');
  });

  it('debe devolver HTTP 400 si el cuerpo no contiene la propiedad url requerida', async () => {
    const res = await request(app)
      .post('/api/requests/execute')
      .send({
        method: 'GET',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_URL');
  });
});
