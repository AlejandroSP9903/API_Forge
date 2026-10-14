/**
 * API Forge - Pruebas de Integración de Endpoints HTTP (Fase 0)
 * Verifica GET /api/health, estructura de contrato JSON y manejo de errores.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.ts';
import { initDatabase, closeDatabase } from '../server/db/index.ts';
import { runMigrations } from '../server/db/migrate.ts';

describe('Backend API - GET /api/health', () => {
  const app = createApp();

  beforeAll(async () => {
    // Inicializar SQLite en memoria para la suite de pruebas
    await initDatabase('file::memory:?cache=shared');
    await runMigrations();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('debe devolver código HTTP 200 y JSON con estado "ok"', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'api-forge');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('debe incluir diagnóstico de base de datos SQLite y claves foráneas activas', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.database).toBeDefined();
    expect(res.body.database.status).toBe('connected');
    expect(res.body.database.dialect).toBe('sqlite');
    expect(res.body.database.foreignKeys).toBe(true);
    expect(Array.isArray(res.body.database.tablesVerified)).toBe(true);
    expect(res.body.database.tablesVerified).toContain('projects');
    expect(res.body.database.tablesVerified).toContain('api_endpoints');
    expect(res.body.database.tablesVerified).toContain('health_audit_logs');
  });

  it('debe manejar errores controlados sin exponer datos sensibles', async () => {
    const res = await request(app).get('/api/health/error-simulation');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'ERR_SIMULATION');
    expect(res.body.error).toHaveProperty('message');
    expect(res.body.error).toHaveProperty('timestamp');
  });
});
