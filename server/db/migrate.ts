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

    // 6. Verificar que las tablas existen
    const tablesCheck = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('projects', 'api_endpoints', 'health_audit_logs')
      ORDER BY name ASC;
    `);

    const appliedTables = tablesCheck.rows.map((r) => String(r[0]));

    // 7. Verificar estado de foreign keys
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
