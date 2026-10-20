/**
 * API Forge - Pruebas Automatizadas de Gestión de Proyectos y Asociación con Colecciones (Fase 2A)
 * Valida CRUD de proyectos, asociación/desasociación de colecciones existentes,
 * integridad referencial, prevención de vinculación múltiple y persistencia real en SQLite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createApp } from '../server/app.ts';
import { initDatabase, closeDatabase, getDb } from '../server/db/index.ts';
import { runMigrations } from '../server/db/migrate.ts';
import {
  createProject,
  listProjects,
  getProjectById,
  updateProject,
  deleteProject,
  associateCollectionToProject,
  dissociateCollectionFromProject,
  getProjectCollections,
  ProjectError,
} from '../server/services/projectsService.ts';
import {
  createCollection,
  getCollectionById,
  createSavedRequest,
  listCollections,
} from '../server/services/collectionsService.ts';

describe('Gestión de Proyectos y Asociación con Colecciones (Fase 2A)', () => {
  const app = createApp();

  beforeEach(async () => {
    // Usar base de datos SQLite en memoria aislada para pruebas unitarias y de servicio
    await initDatabase(':memory:');
    const mig = await runMigrations();
    expect(mig.success).toBe(true);
    expect(mig.foreignKeysActive).toBe(true);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  describe('1. CRUD de Proyectos (Servicio y Endpoints REST)', () => {
    it('1.1. debe crear un proyecto válido vía servicio y persistir en SQLite', async () => {
      const proj = await createProject({
        name: 'Hunter Gateway Core',
        description: 'Servicios de autenticación y ruteo principal',
      });

      expect(proj.id).toBeDefined();
      expect(proj.id).toMatch(/^proj_/);
      expect(proj.name).toBe('Hunter Gateway Core');
      expect(proj.description).toBe('Servicios de autenticación y ruteo principal');
      expect(proj.collectionsCount).toBe(0);
      expect(proj.createdAt).toBeDefined();
    });

    it('1.2. debe rechazar nombres vacíos o excesivamente largos al crear proyectos', async () => {
      await expect(createProject({ name: '   ' })).rejects.toThrow(
        /El nombre del proyecto es obligatorio/i
      );

      const longName = 'A'.repeat(101);
      await expect(createProject({ name: longName })).rejects.toThrow(
        /no puede superar los 100 caracteres/i
      );
    });

    it('1.3. debe rechazar descripciones mayores a 500 caracteres', async () => {
      const longDesc = 'D'.repeat(501);
      await expect(
        createProject({ name: 'Proyecto Válido', description: longDesc })
      ).rejects.toThrow(/no puede superar los 500 caracteres/i);
    });

    it('1.4. debe listar proyectos existentes con el conteo de colecciones', async () => {
      await createProject({ name: 'Proyecto Alpha' });
      await createProject({ name: 'Proyecto Beta' });

      const list = await listProjects();
      expect(list.length).toBe(2);
      const names = list.map((p) => p.name);
      expect(names).toContain('Proyecto Alpha');
      expect(names).toContain('Proyecto Beta');
    });

    it('1.5. debe consultar un proyecto por ID y retornar 404 si no existe', async () => {
      const res404 = await request(app).get('/api/projects/proj_inexistente_123');
      expect(res404.status).toBe(404);
      expect(res404.body.error?.code).toBe('PROJECT_NOT_FOUND');

      const created = await createProject({ name: 'Proyecto Consultable' });
      const res200 = await request(app).get(`/api/projects/${created.id}`);
      expect(res200.status).toBe(200);
      expect(res200.body.id).toBe(created.id);
      expect(res200.body.name).toBe('Proyecto Consultable');
      expect(Array.isArray(res200.body.collections)).toBe(true);
    });

    it('1.6. debe actualizar nombre y descripción de un proyecto existente', async () => {
      const created = await createProject({
        name: 'Nombre Antiguo',
        description: 'Descripción antigua',
      });

      const patchRes = await request(app)
        .patch(`/api/projects/${created.id}`)
        .send({ name: 'Nombre Renovado', description: 'Nueva descripción' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.name).toBe('Nombre Renovado');
      expect(patchRes.body.description).toBe('Nueva descripción');

      // Validar rechazo de nombre vacío en actualización
      const badPatch = await request(app)
        .patch(`/api/projects/${created.id}`)
        .send({ name: '   ' });

      expect(badPatch.status).toBe(400);
      expect(badPatch.body.error?.code).toBe('EMPTY_NAME');
    });

    it('1.7. debe eliminar un proyecto de manera consistente', async () => {
      const created = await createProject({ name: 'Proyecto Para Borrar' });

      const deleteRes = await request(app).delete(`/api/projects/${created.id}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      const checkRes = await request(app).get(`/api/projects/${created.id}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('2. Asociación y Desasociación de Colecciones', () => {
    it('2.1. debe asociar una colección existente a un proyecto', async () => {
      const proj = await createProject({ name: 'Proyecto E-Commerce' });
      const col = await createCollection({ name: 'Misiones de Checkout' });

      const assocRes = await request(app)
        .post(`/api/projects/${proj.id}/collections`)
        .send({ collectionId: col.id });

      expect(assocRes.status).toBe(200);
      expect(assocRes.body.success).toBe(true);
      expect(assocRes.body.collection.projectId).toBe(proj.id);

      // Verificar que el proyecto ahora lista la colección
      const projDetails = await getProjectById(proj.id);
      expect(projDetails?.collectionsCount).toBe(1);
      expect(projDetails?.collections[0].id).toBe(col.id);
    });

    it('2.2. debe rechazar asociar una colección o proyecto inexistente', async () => {
      const proj = await createProject({ name: 'Proyecto Real' });
      const col = await createCollection({ name: 'Colección Real' });

      // Proyecto inexistente
      const resBadProj = await request(app)
        .post('/api/projects/proj_fake/collections')
        .send({ collectionId: col.id });
      expect(resBadProj.status).toBe(404);
      expect(resBadProj.body.error?.code).toBe('PROJECT_NOT_FOUND');

      // Colección inexistente
      const resBadCol = await request(app)
        .post(`/api/projects/${proj.id}/collections`)
        .send({ collectionId: 'col_fake' });
      expect(resBadCol.status).toBe(404);
      expect(resBadCol.body.error?.code).toBe('COLLECTION_NOT_FOUND');
    });

    it('2.3. debe evitar que una colección pertenezca simultáneamente a varios proyectos', async () => {
      const projA = await createProject({ name: 'Proyecto Alpha' });
      const projB = await createProject({ name: 'Proyecto Beta' });
      const col = await createCollection({ name: 'Colección Exclusiva' });

      // Asociar a Proyecto Alpha
      await associateCollectionToProject(projA.id, col.id);

      // Intentar asociar a Proyecto Beta sin haberla desasociado antes
      const conflictRes = await request(app)
        .post(`/api/projects/${projB.id}/collections`)
        .send({ collectionId: col.id });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error?.code).toBe('COLLECTION_ALREADY_ASSIGNED');
      expect(conflictRes.body.error?.message).toMatch(/ya pertenece al proyecto/i);

      // Verificar que la colección sigue perteneciendo a Proyecto Alpha
      const checkCol = await getCollectionById(col.id);
      expect(checkCol?.projectId).toBe(projA.id);
    });

    it('2.4. debe ser idempotente si se reasocia al mismo proyecto', async () => {
      const proj = await createProject({ name: 'Proyecto Idempotente' });
      const col = await createCollection({ name: 'Colección Repetida' });

      await associateCollectionToProject(proj.id, col.id);

      const secondAssoc = await request(app)
        .post(`/api/projects/${proj.id}/collections`)
        .send({ collectionId: col.id });

      expect(secondAssoc.status).toBe(200);
      expect(secondAssoc.body.collection.projectId).toBe(proj.id);
    });

    it('2.5. debe desasociar una colección de un proyecto sin eliminarla', async () => {
      const proj = await createProject({ name: 'Proyecto Desasociable' });
      const col = await createCollection({ name: 'Colección Para Desasociar' });
      await associateCollectionToProject(proj.id, col.id);

      const dissocRes = await request(app).delete(
        `/api/projects/${proj.id}/collections/${col.id}`
      );
      expect(dissocRes.status).toBe(200);
      expect(dissocRes.body.success).toBe(true);

      // Verificar que la colección todavía existe en SQLite pero con projectId = null
      const checkCol = await getCollectionById(col.id);
      expect(checkCol).not.toBeNull();
      expect(checkCol?.projectId).toBeNull();

      // Verificar que el proyecto ya no la lista
      const projDetails = await getProjectById(proj.id);
      expect(projDetails?.collectionsCount).toBe(0);
    });

    it('2.6. debe rechazar desasociar una colección que no pertenece al proyecto', async () => {
      const projA = await createProject({ name: 'Proyecto A' });
      const projB = await createProject({ name: 'Proyecto B' });
      const col = await createCollection({ name: 'Colección de A' });
      await associateCollectionToProject(projA.id, col.id);

      // Intentar desasociar desde Proyecto B
      const badDissoc = await request(app).delete(
        `/api/projects/${projB.id}/collections/${col.id}`
      );
      expect(badDissoc.status).toBe(400);
      expect(badDissoc.body.error?.code).toBe('COLLECTION_NOT_ASSOCIATED');
    });
  });

  describe('3. Integridad de Datos y Persistencia Real en SQLite', () => {
    it('3.1. al eliminar un proyecto, sus colecciones y solicitudes guardadas continúan intactas', async () => {
      const proj = await createProject({ name: 'Proyecto Temporal' });
      const col = await createCollection({
        name: 'Colección Sobreviviente',
        description: 'No debe desaparecer',
      });
      await associateCollectionToProject(proj.id, col.id);

      // Guardar solicitudes dentro de la colección
      const req1 = await createSavedRequest(col.id, {
        name: 'Endpoint Vital 1',
        method: 'GET',
        url: 'https://api.example.com/v1/alive',
      });
      const req2 = await createSavedRequest(col.id, {
        name: 'Endpoint Vital 2',
        method: 'POST',
        url: 'https://api.example.com/v1/alive',
      });

      // Eliminar el proyecto
      await deleteProject(proj.id);

      // 1. El proyecto ya no existe
      const projCheck = await getProjectById(proj.id);
      expect(projCheck).toBeNull();

      // 2. La colección sigue existiendo y su projectId quedó desasociado (null)
      const colCheck = await getCollectionById(col.id);
      expect(colCheck).not.toBeNull();
      expect(colCheck?.id).toBe(col.id);
      expect(colCheck?.name).toBe('Colección Sobreviviente');
      expect(colCheck?.projectId).toBeNull();

      // 3. Sus solicitudes guardadas continúan existiendo y operables
      expect(colCheck?.requestsCount).toBe(2);
      expect(colCheck?.requests.map((r) => r.id)).toContain(req1.id);
      expect(colCheck?.requests.map((r) => r.id)).toContain(req2.id);

      // 4. listCollections también reporta la colección
      const allCols = await listCollections();
      expect(allCols.some((c) => c.id === col.id)).toBe(true);
    });

    it('3.2. debe comprobar persistencia real en disco tras cerrar y reabrir la base de datos', async () => {
      // Crear base de datos física temporal en disco
      const tempDir = path.join(os.tmpdir(), `api-forge-phase2a-${Date.now()}`);
      const diskDbPath = path.join(tempDir, 'phase2a_test.db');
      const diskDbUrl = `file:${diskDbPath}`;

      try {
        await initDatabase(diskDbUrl);
        await runMigrations();

        // Crear proyecto y colección asociada en disco
        const proj = await createProject({
          name: 'Proyecto Persistente',
          description: 'Probando durabilidad tras reinicio',
        });
        const col = await createCollection({
          name: 'Colección Persistente',
        });
        await associateCollectionToProject(proj.id, col.id);

        const savedReq = await createSavedRequest(col.id, {
          name: 'Misión Persistente',
          method: 'GET',
          url: 'https://api.example.com/status',
        });

        // Simular reinicio del backend (cerrar conexión SQLite)
        await closeDatabase();

        // Reconectar al mismo archivo en disco
        await initDatabase(diskDbUrl);

        // Consultar proyecto tras reinicio
        const projAfter = await getProjectById(proj.id);
        expect(projAfter).not.toBeNull();
        expect(projAfter?.name).toBe('Proyecto Persistente');
        expect(projAfter?.collectionsCount).toBe(1);
        expect(projAfter?.collections[0].id).toBe(col.id);

        // Consultar colección y solicitudes tras reinicio
        const colAfter = await getCollectionById(col.id);
        expect(colAfter).not.toBeNull();
        expect(colAfter?.projectId).toBe(proj.id);
        expect(colAfter?.requestsCount).toBe(1);
        expect(colAfter?.requests[0].id).toBe(savedReq.id);
        expect(colAfter?.requests[0].name).toBe('Misión Persistente');
      } finally {
        await closeDatabase();
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
    });
  });
});
