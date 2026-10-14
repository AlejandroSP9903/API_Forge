/**
 * API Forge - Pruebas Unitarias de Base de Datos y Drizzle ORM (Fase 0)
 * Verifica inicialización de SQLite, migraciones, claves foráneas y operaciones Drizzle.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { initDatabase, closeDatabase, checkDatabaseHealth, getDb } from '../server/db/index.ts';
import { runMigrations } from '../server/db/migrate.ts';
import { projects, apiEndpoints } from '../server/db/schema.ts';
import { eq } from 'drizzle-orm';

describe('SQLite & Drizzle ORM - Módulo de Persistencia', () => {
  beforeEach(async () => {
    // Inicializar base de datos en memoria para aislamiento
    await initDatabase('file::memory:?cache=shared');
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('debe inicializar SQLite y reportar estado conectado', async () => {
    const health = await checkDatabaseHealth();
    expect(health.status).toBe('connected');
    expect(health.dialect).toBe('sqlite');
    expect(health.foreignKeys).toBe(true);
  });

  it('debe aplicar la migración inicial reproducible sin errores', async () => {
    const migration = await runMigrations();
    expect(migration.success).toBe(true);
    expect(migration.foreignKeysActive).toBe(true);
    expect(migration.appliedTables).toContain('projects');
    expect(migration.appliedTables).toContain('api_endpoints');
    expect(migration.appliedTables).toContain('health_audit_logs');
  });

  it('debe aplicar la regla de claves foráneas y rechazar relaciones rotas', async () => {
    await runMigrations();
    const db = await getDb();

    // Intentar insertar un endpoint con project_id inexistente debe fallar
    await expect(async () => {
      await db.insert(apiEndpoints).values({
        id: 'ep-invalido-1',
        projectId: 'proyecto-que-no-existe',
        method: 'GET',
        path: '/test',
        createdAt: new Date(),
      });
    }).rejects.toThrow();
  });

  it('debe permitir insertar un proyecto y endpoint válido, y aplicar borrado en cascada', async () => {
    await runMigrations();
    const db = await getDb();

    const projectId = `proj-${Date.now()}`;
    const endpointId = `ep-${Date.now()}`;

    // 1. Insertar proyecto padre
    await db.insert(projects).values({
      id: projectId,
      name: 'API Pagos',
      description: 'Microservicio de pasarela',
      createdAt: new Date(),
    });

    // 2. Insertar endpoint hijo
    await db.insert(apiEndpoints).values({
      id: endpointId,
      projectId,
      method: 'POST',
      path: '/v1/charge',
      createdAt: new Date(),
    });

    // 3. Verificar que ambos existen
    const foundEndpoints = await db.select().from(apiEndpoints).where(eq(apiEndpoints.id, endpointId));
    expect(foundEndpoints.length).toBe(1);
    expect(foundEndpoints[0].path).toBe('/v1/charge');

    // 4. Borrar el proyecto padre
    await db.delete(projects).where(eq(projects.id, projectId));

    // 5. Verificar borrado en cascada del endpoint hijo
    const remainingEndpoints = await db.select().from(apiEndpoints).where(eq(apiEndpoints.id, endpointId));
    expect(remainingEndpoints.length).toBe(0);
  });
});
