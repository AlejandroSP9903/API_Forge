/**
 * API Forge - Módulo Independiente de Migración Inicial (Fase 0)
 * Aplica el esquema inicial reproducible con validación de integridad referencial.
 */

import { getClient } from './index.ts';

export interface MigrationResult {
  success: boolean;
  appliedTables: string[];
  foreignKeysActive: boolean;
  error?: string;
}

/**
 * Ejecuta la migración inicial estructurada para SQLite
 */
export async function runMigrations(): Promise<MigrationResult> {
  const client = await getClient();

  try {
    // 1. Asegurar PRAGMA foreign_keys
    await client.execute('PRAGMA foreign_keys = ON;');

    // 2. Crear tabla projects
    await client.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    // 3. Crear tabla api_endpoints con clave foránea hacia projects y borrado en cascada
    await client.execute(`
      CREATE TABLE IF NOT EXISTS api_endpoints (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);

    // 4. Crear índices para rendimiento de consultas relacionales
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_api_endpoints_project_id ON api_endpoints(project_id);
    `);

    // 5. Crear tabla health_audit_logs
    await client.execute(`
      CREATE TABLE IF NOT EXISTS health_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        checked_at TEXT NOT NULL,
        status TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        details TEXT
      );
    `);

    // 6. Crear tabla collections (Fase 1D)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // 7. Crear tabla saved_requests (Fase 1D) con clave foránea hacia collections y borrado en cascada
    await client.execute(`
      CREATE TABLE IF NOT EXISTS saved_requests (
        id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL,
        name TEXT NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        headers TEXT,
        query_params TEXT,
        body TEXT,
        auth TEXT,
        content_type TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      );
    `);

    // Intentar agregar columna auth si la tabla ya existía en versiones anteriores
    try {
      await client.execute(`ALTER TABLE saved_requests ADD COLUMN auth TEXT;`);
    } catch {
      // Ignorar si la columna ya existe
    }

    // 8. Crear índice para optimizar consultas de solicitudes por colección
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_saved_requests_collection_id ON saved_requests(collection_id);
    `);

    // 9. Crear tabla environments (Fase 1E)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS environments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        variables TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // 10. Verificar que las tablas existen
    const tablesCheck = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('projects', 'api_endpoints', 'health_audit_logs', 'collections', 'saved_requests', 'environments')
      ORDER BY name ASC;
    `);

    const appliedTables = tablesCheck.rows.map((r) => String(r[0]));

    // 11. Verificar estado de foreign keys
    const fkCheck = await client.execute('PRAGMA foreign_keys;');
    const foreignKeysActive = fkCheck.rows.length > 0 && Number(fkCheck.rows[0][0]) === 1;

    return {
      success: appliedTables.length >= 3,
      appliedTables,
      foreignKeysActive,
    };
  } catch (error) {
    console.error('[Migrations] Error ejecutando migraciones iniciales:', error);
    return {
      success: false,
      appliedTables: [],
      foreignKeysActive: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
