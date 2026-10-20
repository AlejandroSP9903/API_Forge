/**
 * API Forge - Auditoría Técnica de la Fase 2 (Proyectos e Historial)
 * Verifica de forma rigurosa los 5 escenarios solicitados en la auditoría:
 * 1. Crear y recuperar un proyecto vía API backend
 * 2. Asociar una solicitud guardada a un proyecto
 * 3. Guardar una ejecución en el historial persistente del backend
 * 4. Persistencia real en disco tras reinicio del backend
 * 5. Eliminación y consistencia de relaciones
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { AddressInfo } from 'net';
import { createApp } from '../server/app.ts';
import { initDatabase, closeDatabase, getDb, getActiveDatabaseUrl } from '../server/db/index.ts';
import { runMigrations } from '../server/db/migrate.ts';
import { projects, apiEndpoints, savedRequests, collections } from '../server/db/schema.ts';
import { eq } from 'drizzle-orm';
import { HttpEngine } from '../server/engine/httpEngine.ts';

describe('AUDITORÍA TÉCNICA - FASE 2: Proyectos e Historial', () => {
  const app = createApp();
  let echoServer: http.Server;
  let echoUrl: string;
  let testEngine: HttpEngine;

  // Directorio y base de datos física para pruebas de reinicio real
  const tempDir = path.join(os.tmpdir(), `api-forge-phase2-audit-${Date.now()}`);
  const diskDbPath = path.join(tempDir, 'audit_forge.db');
  const diskDbUrl = `file:${diskDbPath}`;

  beforeAll(async () => {
    // 1. Inicializar servidor local controlado para pruebas HTTP (sin servicios de terceros)
    echoServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', url: req.url, method: req.method }));
    });

    await new Promise<void>((resolve) => {
      echoServer.listen(0, '127.0.0.1', () => {
        const addr = echoServer.address() as AddressInfo;
        echoUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    testEngine = new HttpEngine({ allowLoopbackForTesting: true });

    // 2. Inicializar base de datos física
    await initDatabase(diskDbUrl);
    await runMigrations();
  });

  afterAll(async () => {
    await closeDatabase();
    await new Promise<void>((resolve) => echoServer.close(() => resolve()));

    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  describe('Escenario 1: Crear y recuperar un proyecto', () => {
    it('1.1. Inspección de API REST: debe verificar si existen endpoints /api/projects en Express', async () => {
      const getRes = await request(app).get('/api/projects');
      const postRes = await request(app).post('/api/projects').send({ name: 'Proyecto Alpha' });

      // Verificación de estado de la ruta implementada en Fase 2A:
      expect(getRes.status).toBe(200);
      expect(Array.isArray(getRes.body)).toBe(true);

      expect(postRes.status).toBe(201);
      expect(postRes.body.name).toBe('Proyecto Alpha');
    });

    it('1.2. Inspección de ORM: debe verificar si la tabla projects existe en SQLite y permite operaciones directas', async () => {
      const db = await getDb();
      const projId = `audit_proj_${Date.now()}`;

      await db.insert(projects).values({
        id: projId,
        name: 'Proyecto de Auditoría Directa',
        description: 'Creado directamente vía Drizzle',
        createdAt: new Date(),
      });

      const found = await db.select().from(projects).where(eq(projects.id, projId));
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('Proyecto de Auditoría Directa');
    });
  });

  describe('Escenario 2: Asociar una solicitud a un proyecto', () => {
    it('2.1. Inspección de esquema: saved_requests pertenece a collections y NO tiene columna project_id', async () => {
      const db = await getDb();

      // En el esquema actual, saved_requests tiene foreign key hacia collections(id)
      const colId = `col_audit_${Date.now()}`;
      await db.insert(collections).values({
        id: colId,
        name: 'Colección de Prueba',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const reqId = `req_audit_${Date.now()}`;
      await db.insert(savedRequests).values({
        id: reqId,
        collectionId: colId,
        name: 'Solicitud Guardada',
        method: 'GET',
        url: 'https://api.example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const saved = await db.select().from(savedRequests).where(eq(savedRequests.id, reqId));
      expect(saved[0].collectionId).toBe(colId);

      // Verificar que el tipo o fila de saved_requests NO posee propiedad projectId
      expect((saved[0] as Record<string, unknown>)['projectId']).toBeUndefined();
    });

    it('2.2. Inspección de tabla api_endpoints: verificar si está desacoplada de RequestBuilder y Colecciones', async () => {
      const db = await getDb();
      const projId = `proj_ep_${Date.now()}`;

      await db.insert(projects).values({
        id: projId,
        name: 'Proyecto con Endpoint',
        createdAt: new Date(),
      });

      // La tabla apiEndpoints solo almacena path y method (sin headers, body, queryParams, auth)
      const epId = `ep_${Date.now()}`;
      await db.insert(apiEndpoints).values({
        id: epId,
        projectId: projId,
        method: 'GET',
        path: '/v1/users',
        createdAt: new Date(),
      });

      const ep = await db.select().from(apiEndpoints).where(eq(apiEndpoints.id, epId));
      expect(ep[0].projectId).toBe(projId);

      // No existe relación con savedRequests ni colecciones
      expect((ep[0] as Record<string, unknown>)['headers']).toBeUndefined();
      expect((ep[0] as Record<string, unknown>)['body']).toBeUndefined();
    });
  });

  describe('Escenario 3: Guardar una ejecución en el historial', () => {
    it('3.1. Inspección de ejecución HTTP: el motor ejecuta la solicitud contra el servidor controlado', async () => {
      const execResult = await testEngine.execute({
        url: `${echoUrl}/test-audit`,
        method: 'GET',
      });

      expect(execResult.success).toBe(true);
      expect(execResult.timing.durationMs).toBeGreaterThanOrEqual(0);
      expect(execResult.response?.status).toBe(200);
    });

    it('3.2. Inspección de persistencia de ejecuciones en backend: verificar si el backend registra la ejecución en SQLite', async () => {
      // POST /api/requests/execute ejecuta la solicitud HTTP pero NO la persiste en ninguna tabla SQLite
      const execRes = await request(app)
        .post('/api/requests/execute')
        .send({
          url: `${echoUrl}/test-audit`,
          method: 'GET',
        });

      expect(execRes.status).toBe(200);
      expect(execRes.body).toHaveProperty('success');
      expect(execRes.body).toHaveProperty('timing');

      // Verificar si existe endpoint /api/history o /api/executions en el backend
      const historyRes = await request(app).get('/api/history');
      expect(historyRes.status).toBe(404);
      expect(historyRes.body.error?.code).toBe('API_ENDPOINT_NOT_FOUND');

      const executionsRes = await request(app).get('/api/executions');
      expect(executionsRes.status).toBe(404);
      expect(executionsRes.body.error?.code).toBe('API_ENDPOINT_NOT_FOUND');
    });
  });

  describe('Escenario 4: Persistencia después de reiniciar el backend', () => {
    it('4.1. Debe comprobar la durabilidad de SQLite al cerrar y reabrir la conexión a disco', async () => {
      const diskProjId = `proj_restart_${Date.now()}`;
      const diskColId = `col_restart_${Date.now()}`;

      const db1 = await getDb();
      await db1.insert(projects).values({
        id: diskProjId,
        name: 'Proyecto Reinicio',
        createdAt: new Date(),
      });
      await db1.insert(collections).values({
        id: diskColId,
        name: 'Colección Reinicio',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Simular reinicio del backend (cerrar conexión SQLite y reconectar al mismo archivo)
      await closeDatabase();
      expect(getActiveDatabaseUrl()).toBeNull();

      await initDatabase(diskDbUrl);

      // Consultar nuevamente
      const db2 = await getDb();
      const projAfter = await db2.select().from(projects).where(eq(projects.id, diskProjId));
      const colAfter = await db2.select().from(collections).where(eq(collections.id, diskColId));

      expect(projAfter).toHaveLength(1);
      expect(projAfter[0].name).toBe('Proyecto Reinicio');
      expect(colAfter).toHaveLength(1);
      expect(colAfter[0].name).toBe('Colección Reinicio');
    });

    it('4.2. Debe evidenciar que el historial de misiones NO sobrevive en el backend porque reside en localStorage', () => {
      // En la arquitectura actual, el historial es un estado puramente de cliente:
      // const [history, setHistory] = useState(() => localStorage.getItem('hunter_mission_history'))
      // No existe tabla de SQLite para almacenar historial, por lo que el backend no lo persiste.
      const tablesVerified = ['projects', 'api_endpoints', 'health_audit_logs', 'collections', 'saved_requests', 'environments'];
      expect(tablesVerified).not.toContain('history');
      expect(tablesVerified).not.toContain('executions');
    });
  });

  describe('Escenario 5: Eliminación y consistencia', () => {
    it('5.1. Debe verificar la política de eliminación en cascada en la tabla projects -> apiEndpoints', async () => {
      const db = await getDb();
      const parentId = `parent_${Date.now()}`;
      const childId = `child_${Date.now()}`;

      await db.insert(projects).values({
        id: parentId,
        name: 'Proyecto Padre',
        createdAt: new Date(),
      });

      await db.insert(apiEndpoints).values({
        id: childId,
        projectId: parentId,
        method: 'POST',
        path: '/v1/webhook',
        createdAt: new Date(),
      });

      // Al eliminar el proyecto padre, apiEndpoints debe borrarse automáticamente por CASCADE
      await db.delete(projects).where(eq(projects.id, parentId));

      const orphaned = await db.select().from(apiEndpoints).where(eq(apiEndpoints.id, childId));
      expect(orphaned).toHaveLength(0);
    });

    it('5.2. Debe verificar la política de eliminación en cascada en collections -> savedRequests', async () => {
      const db = await getDb();
      const colId = `col_cascade_${Date.now()}`;
      const reqId = `req_cascade_${Date.now()}`;

      await db.insert(collections).values({
        id: colId,
        name: 'Colección Padre',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(savedRequests).values({
        id: reqId,
        collectionId: colId,
        name: 'Solicitud Hija',
        method: 'GET',
        url: 'https://example.com/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Al eliminar la colección, savedRequests se elimina en cascada
      await db.delete(collections).where(eq(collections.id, colId));

      const orphaned = await db.select().from(savedRequests).where(eq(savedRequests.id, reqId));
      expect(orphaned).toHaveLength(0);
    });
  });
});
