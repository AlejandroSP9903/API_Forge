/**
 * API Forge - Conexión e Inicialización de SQLite con Drizzle (Fase 0)
 * Responsable de la inicialización de SQLite, activación de PRAGMA foreign_keys
 * y comprobación de salud del almacenamiento local.
 */

import fs from 'fs';
import path from 'path';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema.ts';
import { config } from '../config.ts';
import type { DatabaseHealth } from '../../packages/shared/types.ts';

let clientInstance: Client | null = null;
let dbInstance: LibSQLDatabase<typeof schema> | null = null;

/**
 * Asegura que el directorio contenedor del archivo SQLite exista antes de abrir la conexión
 */
function ensureDirectoryExists(url: string): void {
  if (url.startsWith('file:')) {
    const rawPath = url.replace(/^file:/, '').split('?')[0];
    if (rawPath && rawPath !== ':memory:' && !rawPath.startsWith(':memory:')) {
      const dir = path.dirname(path.resolve(rawPath));
      if (dir && !fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`[Database] Directorio para SQLite creado exitosamente: ${dir}`);
        } catch (err) {
          console.warn(`[Database] No se pudo crear el directorio ${dir}:`, err);
        }
      }
    }
  }
}

/**
 * Inicializa la conexión SQLite y activa la comprobación de claves foráneas
 */
export async function initDatabase(customUrl?: string): Promise<{ db: LibSQLDatabase<typeof schema>; client: Client }> {
  let url = customUrl || config.databaseUrl;

  if (clientInstance && !customUrl) {
    return { db: dbInstance!, client: clientInstance };
  }

  ensureDirectoryExists(url);

  let client: Client;
  try {
    client = createClient({ url });
    // Habilitar estrictamente las claves foráneas en SQLite
    await client.execute('PRAGMA foreign_keys = ON;');
  } catch (primaryErr) {
    console.warn(`[Database] Fallo conectando a ${url}: ${primaryErr}. Intentando fallback a 'file:api_forge.db'...`);
    url = 'file:api_forge.db';
    ensureDirectoryExists(url);
    try {
      client = createClient({ url });
      await client.execute('PRAGMA foreign_keys = ON;');
    } catch (fallbackErr) {
      console.warn(`[Database] Fallo con archivo local, utilizando SQLite en memoria (:memory:):`, fallbackErr);
      url = 'file::memory:?cache=shared';
      client = createClient({ url });
      await client.execute('PRAGMA foreign_keys = ON;');
    }
  }

  const db = drizzle(client, { schema });

  if (!customUrl) {
    clientInstance = client;
    dbInstance = db;
  }

  return { db, client };
}

/**
 * Obtiene la instancia activa de la base de datos o la inicializa si no existe
 */
export async function getDb(): Promise<LibSQLDatabase<typeof schema>> {
  if (!dbInstance) {
    const { db } = await initDatabase();
    return db;
  }
  return dbInstance;
}

/**
 * Obtiene el cliente nativo SQLite/LibSQL
 */
export async function getClient(): Promise<Client> {
  if (!clientInstance) {
    const { client } = await initDatabase();
    return client;
  }
  return clientInstance;
}

/**
 * Realiza un diagnóstico en vivo del estado de SQLite y claves foráneas
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now();
  try {
    const client = await getClient();

    // 1. Probar conectividad con SELECT 1
    await client.execute('SELECT 1 as alive;');

    // 2. Verificar estado de claves foráneas
    const fkResult = await client.execute('PRAGMA foreign_keys;');
    const isFkEnabled = fkResult.rows.length > 0 && Number(fkResult.rows[0][0]) === 1;

    // 3. Inspeccionar tablas creadas en sqlite_master
    const tablesResult = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%'
      ORDER BY name ASC;
    `);

    const verifiedTables = tablesResult.rows.map((row) => String(row[0]));
    const latencyMs = Date.now() - startTime;

    return {
      status: 'connected',
      foreignKeys: isFkEnabled,
      dialect: 'sqlite',
      driver: '@libsql/client (pure TS/Wasm & local file)',
      databaseUrl: config.databaseUrl.replace(/\/\/[^@]+@/, '//***@'), // Ofuscar credenciales si las hubiera
      tablesVerified: verifiedTables,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('[Database Health] Error verificando SQLite:', error);
    return {
      status: 'disconnected',
      foreignKeys: false,
      dialect: 'sqlite',
      driver: '@libsql/client',
      tablesVerified: [],
      latencyMs,
    };
  }
}

/**
 * Cierra la conexión de SQLite para limpieza de recursos (útil en pruebas)
 */
export async function closeDatabase(): Promise<void> {
  if (clientInstance) {
    clientInstance.close();
    clientInstance = null;
    dbInstance = null;
  }
}
