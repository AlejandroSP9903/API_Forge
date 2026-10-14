/**
 * API Forge - Pruebas Unitarias y de Integración del Motor HTTP (Fase 1A)
 * Servidor de prueba local determinista para validar métodos, encabezados,
 * normalización, timeouts, límites de tamaño y cancelación.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { HttpEngine } from '../server/engine/httpEngine.ts';

describe('HTTP Engine - Pruebas Funcionales con Servidor Local', () => {
  let server: http.Server;
  let baseUrl: string;
  let testEngine: HttpEngine;

  beforeAll(async () => {
    // 1. Configurar servidor HTTP local para pruebas deterministas
    server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);

      if (parsedUrl.pathname === '/hello-json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'hola mundo', count: 42 }));
        return;
      }

      if (parsedUrl.pathname === '/hello-text') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Respuesta en texto plano');
        return;
      }

      if (parsedUrl.pathname === '/echo' && req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          const bodyStr = Buffer.concat(chunks).toString('utf8');
          res.writeHead(201, {
            'Content-Type': 'application/json',
            'X-Echo-Header': req.headers['x-custom-test'] || 'none',
          });
          res.end(JSON.stringify({ received: JSON.parse(bodyStr || '{}'), method: req.method }));
        });
        return;
      }

      if (parsedUrl.pathname === '/query') {
        const queryObj: Record<string, string> = {};
        parsedUrl.searchParams.forEach((val, key) => {
          queryObj[key] = val;
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ query: queryObj }));
        return;
      }

      if (parsedUrl.pathname === '/status/404') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Recurso no encontrado' }));
        return;
      }

      if (parsedUrl.pathname === '/status/500') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Fallo interno simulado en destino');
        return;
      }

      if (parsedUrl.pathname === '/slow') {
        setTimeout(() => {
          if (!res.writableEnded) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ delayed: true }));
          }
        }, 500);
        return;
      }

      if (parsedUrl.pathname === '/large') {
        // Generar respuesta de 50 KB
        const bigPayload = 'A'.repeat(50 * 1024);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(bigPayload);
        return;
      }

      if (parsedUrl.pathname === '/redirect-valid') {
        res.writeHead(302, { Location: '/hello-json' });
        res.end();
        return;
      }

      if (parsedUrl.pathname === '/redirect-to-forbidden') {
        // Intento de redirección a servicio de metadatos de nube
        res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data' });
        res.end();
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    // 2. Iniciar en puerto dinámico asignado por el SO (puerto 0)
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // 3. Crear instancia del motor autorizada explícitamente solo para loopback en la suite de pruebas
    testEngine = new HttpEngine({ allowLoopbackForTesting: true });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('debe ejecutar una petición GET exitosa y parsear JSON correctamente', async () => {
    const result = await testEngine.execute({
      url: `${baseUrl}/hello-json`,
      method: 'GET',
    });

    expect(result.success).toBe(true);
    expect(result.response).toBeDefined();
    expect(result.response?.status).toBe(200);
    expect(result.response?.statusText).toBe('OK');
    expect(result.response?.contentType).toContain('application/json');
    expect(result.response?.data).toEqual({ message: 'hola mundo', count: 42 });
    expect(result.timing.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('debe ejecutar una petición GET con respuesta en texto plano', async () => {
    const result = await testEngine.execute({
      url: `${baseUrl}/hello-text`,
      method: 'GET',
    });

    expect(result.success).toBe(true);
    expect(result.response?.status).toBe(200);
    expect(result.response?.contentType).toContain('text/plain');
    expect(result.response?.body).toBe('Respuesta en texto plano');
    expect(result.response?.data).toBeUndefined();
  });

  it('debe ejecutar una petición POST enviando cuerpo JSON y encabezados personalizados', async () => {
    const payload = { item: 'teclado', price: 99 };

    const result = await testEngine.execute({
      url: `${baseUrl}/echo`,
      method: 'POST',
      headers: {
        'X-Custom-Test': 'clave-secreta-prueba',
      },
      body: payload,
    });

    expect(result.success).toBe(true);
    expect(result.response?.status).toBe(201);
    expect(result.response?.headers['x-echo-header']).toBe('clave-secreta-prueba');
    expect(result.response?.data).toEqual({
      received: payload,
      method: 'POST',
    });
  });

  it('debe normalizar e incorporar parámetros de consulta (queryParams) a la URL', async () => {
    const result = await testEngine.execute({
      url: `${baseUrl}/query`,
      method: 'GET',
      queryParams: {
        search: 'observabilidad',
        page: 2,
        active: true,
      },
    });

    expect(result.success).toBe(true);
    expect(result.response?.status).toBe(200);
    expect(result.response?.data).toEqual({
      query: {
        search: 'observabilidad',
        page: '2',
        active: 'true',
      },
    });
  });

  it('debe clasificar una respuesta 404 del destino como respuesta observada (success: true)', async () => {
    const result = await testEngine.execute({
      url: `${baseUrl}/status/404`,
      method: 'GET',
    });

    expect(result.success).toBe(true);
    expect(result.response?.status).toBe(404);
    expect(result.response?.data).toEqual({ error: 'Recurso no encontrado' });
    expect(result.error).toBeUndefined();
  });

  it('debe clasificar una respuesta 500 del destino como respuesta observada (success: true)', async () => {
    const result = await testEngine.execute({
      url: `${baseUrl}/status/500`,
      method: 'GET',
    });

    expect(result.success).toBe(true);
    expect(result.response?.status).toBe(500);
    expect(result.response?.body).toBe('Fallo interno simulado en destino');
    expect(result.error).toBeUndefined();
  });

  it('debe cancelar por Timeout si la respuesta del servidor tarda más que el límite configurado', async () => {
    const result = await testEngine.execute({
      url: `${baseUrl}/slow`,
      method: 'GET',
      timeoutMs: 150, // Servidor tarda 500ms
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('TIMEOUT');
    expect(result.error?.message).toContain('Tiempo de espera agotado');
  });

  it('debe soportar cancelación mediante AbortController externo', async () => {
    const abortController = new AbortController();

    // Cancelar casi inmediatamente
    setTimeout(() => {
      abortController.abort();
    }, 20);

    const result = await testEngine.execute(
      {
        url: `${baseUrl}/slow`,
        method: 'GET',
        timeoutMs: 5000,
      },
      abortController.signal
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('ABORTED');
  });

  it('debe rechazar una URL sintácticamente inválida con error INVALID_URL', async () => {
    const result = await testEngine.execute({
      url: 'direccion-invalida-sin-protocolo-ni-formato',
      method: 'GET',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_URL');
  });

  it('debe rechazar protocolos prohibidos como ftp:, file:, javascript: con FORBIDDEN_PROTOCOL', async () => {
    const resultFtp = await testEngine.execute({
      url: 'ftp://servidor-archivos.com/doc.pdf',
      method: 'GET',
    });

    expect(resultFtp.success).toBe(false);
    expect(resultFtp.error?.code).toBe('FORBIDDEN_PROTOCOL');

    const resultFile = await testEngine.execute({
      url: 'file:///etc/passwd',
      method: 'GET',
    });

    expect(resultFile.success).toBe(false);
    expect(resultFile.error?.code).toBe('FORBIDDEN_PROTOCOL');
  });

  it('debe abortar la conexión si el cuerpo de respuesta supera maxResponseSizeBytes', async () => {
    const result = await testEngine.execute({
      url: `${baseUrl}/large`,
      method: 'GET',
      maxResponseSizeBytes: 10 * 1024, // 10 KB límite, servidor devuelve 50 KB
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('RESPONSE_TOO_LARGE');
  });

  it('debe seguir redirecciones válidas transparentemente', async () => {
    const result = await testEngine.execute({
      url: `${baseUrl}/redirect-valid`,
      method: 'GET',
    });

    expect(result.success).toBe(true);
    expect(result.response?.status).toBe(200);
    expect(result.response?.redirectsCount).toBe(1);
    expect(result.response?.data).toEqual({ message: 'hola mundo', count: 42 });
  });

  it('debe bloquear redirecciones que conduzcan a destinos prohibidos (SSRF)', async () => {
    const result = await testEngine.execute({
      url: `${baseUrl}/redirect-to-forbidden`,
      method: 'GET',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SSRF_BLOCKED');
    expect(result.error?.message).toMatch(/bloquead[ao]|metadatos|restringid[ao]/i);
  });
});
