/**
 * API Forge - Pruebas de Persistencia Real en Disco y Manejo Explícito de Errores (Fase 0)
 * Valida la creación automática de directorios, persistencia tras reconexión,
 * rechazo de rutas inválidas sin fallback silencioso y limpieza de recursos temporales.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  initDatabase,
  closeDatabase,
  checkDatabaseHealth,
  getDb,
  getActiveDatabaseUrl,
} from '../server/db/index.ts';
import { runMigrations } from '../server/db/migrate.ts';
import { projects } from '../server/db/schema.ts';
import { eq } from 'drizzle-orm';

describe('SQLite & Drizzle - Persistencia Real en Disco y Rutas Explícitas', () => {
  // Directorio temporal compatible con Windows, Linux y macOS
  const testBaseDir = path.join(os.tmpdir(), `api-forge-persistence-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
  const nestedSubDir = path.join(testBaseDir, 'storage', 'databases');
  const diskDbPath = path.join(nestedSubDir, 'persistent_forge.db');
  const diskDbUrl = `file:${diskDbPath}`;

  beforeAll(async () => {
    // Asegurar que cerramos conexiones previas
    await closeDatabase();
  });

  afterAll(async () => {
    // 1. Cerrar conexión para no dejar handles abiertos (especialmente crítico en Windows)
    await closeDatabase();

    // 2. Limpiar directorio temporal
    try {
      if (fs.existsSync(testBaseDir)) {
        fs.rmSync(testBaseDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.warn('[Tests Cleanup] Advertencia al limpiar directorio temporal:', cleanupErr);
    }
  });

  it('debe crear automáticamente el directorio padre anidado y abrir la base de datos', async () => {
    // Comprobar que el directorio anidado aún no existe
    expect(fs.existsSync(nestedSubDir)).toBe(false);

    // Inicializar conexión con ruta que requiere creación de carpetas
    const { client } = await initDatabase(diskDbUrl);
    expect(client).toBeDefined();

    // El directorio padre debe haberse creado automáticamente
    expect(fs.existsSync(nestedSubDir)).toBe(true);

    // Aplicar migraciones en disco
    const migration = await runMigrations();
    expect(migration.success).toBe(true);

    // La URL activa debe coincidir exactamente con la solicitada
    expect(getActiveDatabaseUrl()).toBe(diskDbUrl);

    // El diagnóstico debe reflejar el archivo en disco
    const health = await checkDatabaseHealth();
    expect(health.status).toBe('connected');
    expect(health.foreignKeys).toBe(true);
    expect(health.databaseUrl).toContain('persistent_forge.db');
  });

  it('debe persistir datos en disco y conservarlos tras cerrar y reabrir la conexión', async () => {
    const testProjectId = `proj-disk-${Date.now()}`;
    const testProjectName = 'API de Facturación Real';

    // 1. Insertar registro en la conexión activa
    const db1 = await getDb();
    await db1.insert(projects).values({
      id: testProjectId,
      name: testProjectName,
      description: 'Prueba de durabilidad de almacenamiento en disco',
      createdAt: new Date(),
    });

    // 2. Cerrar la conexión por completo
    await closeDatabase();
    expect(getActiveDatabaseUrl()).toBeNull();

    // 3. Reabrir la conexión al MISMO archivo SQLite en disco
    await initDatabase(diskDbUrl);
    expect(getActiveDatabaseUrl()).toBe(diskDbUrl);

    // 4. Leer el registro y comprobar que persiste físicamente
    const db2 = await getDb();
    const rows = await db2.select().from(projects).where(eq(projects.id, testProjectId));

    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(testProjectId);
    expect(rows[0].name).toBe(testProjectName);
  });

  it('debe fallar de manera explícita ante una ruta inválida y NO aplicar fallback silencioso', async () => {
    // Cerrar conexión activa
    await closeDatabase();

    // Crear un archivo regular y luego intentar crear un subdirectorio usando ese archivo como si fuera carpeta (falla con ENOTDIR / EEXIST)
    const regularFilePath = path.join(testBaseDir, 'dummy-file.txt');
    fs.writeFileSync(regularFilePath, 'este es un archivo plano, no un directorio');

    const invalidPath = path.join(regularFilePath, 'subfolder', 'invalid.db');
    const invalidUrl = `file:${invalidPath}`;

    // La llamada debe fallar arrojando error explícito sin atraparlo ni conmutar a memoria
    await expect(async () => {
      await initDatabase(invalidUrl);
    }).rejects.toThrow();

    // No debe haber quedado ninguna conexión activa ni conmutada a memoria
    expect(getActiveDatabaseUrl()).toBeNull();

    // El diagnóstico debe reportar estado desconectado
    const health = await checkDatabaseHealth();
    expect(health.status).toBe('disconnected');
    expect(health.foreignKeys).toBe(false);
  });

  it('debe mantener el aislamiento cuando se solicita explícitamente una base en memoria', async () => {
    await closeDatabase();

    const memoryUrl = 'file::memory:?cache=shared';
    await initDatabase(memoryUrl);

    expect(getActiveDatabaseUrl()).toBe(memoryUrl);

    const health = await checkDatabaseHealth();
    expect(health.status).toBe('connected');
    expect(health.databaseUrl).toBe(memoryUrl);

    await closeDatabase();
  });
});
