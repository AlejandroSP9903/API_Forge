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
let activeDatabaseUrl: string | null = null;

/**
 * Sanitiza una URL de base de datos ocultando contraseñas o tokens si estuviesen presentes
 */
export function sanitizeDatabaseUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/\/[^@]+@/, '//***@');
}

/**
 * Retorna la URL de la base de datos actualmente activa
 */
export function getActiveDatabaseUrl(): string | null {
  return activeDatabaseUrl;
}

/**
 * Asegura que el directorio contenedor del archivo SQLite exista antes de abrir la conexión.
 * Si no se puede crear, arroja un error explícito sin ocultarlo.
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
          console.error(`[Database] Error fatal creando el directorio '${dir}':`, err);
          throw new Error(`Fallo al crear directorio de almacenamiento SQLite en '${dir}': ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }
}

/**
 * Inicializa la conexión SQLite de forma transparente y activa la comprobación de claves foráneas.
 * No realiza fallback silencioso: si la base configurada no se puede abrir, arroja el error correspondiente.
 */
export async function initDatabase(customUrl?: string): Promise<{ db: LibSQLDatabase<typeof schema>; client: Client }> {
  const url = customUrl || config.databaseUrl;

  if (clientInstance && !customUrl && activeDatabaseUrl === url) {
    return { db: dbInstance!, client: clientInstance };
  }

  // Si hay una conexión previa y se solicita una nueva URL (ej. pruebas con base en memoria), cerramos la anterior
  if (clientInstance && customUrl && activeDatabaseUrl !== customUrl) {
    await closeDatabase();
  }

  // 1. Asegurar existencia del directorio padre si es archivo local
  ensureDirectoryExists(url);

  // 2. Crear cliente SQLite/LibSQL
  let client: Client;
  try {
    client = createClient({ url });

    // Habilitar estrictamente las claves foráneas en SQLite
    await client.execute('PRAGMA foreign_keys = ON;');

    // Verificar ejecución básica
    await client.execute('SELECT 1 as alive;');
  } catch (error) {
    activeDatabaseUrl = null;
    clientInstance = null;
    dbInstance = null;
    console.error(`[Database] Error crítico conectando a la base de datos '${url}':`, error);
    throw error;
  }

  const db = drizzle(client, { schema });

  activeDatabaseUrl = url;
  clientInstance = client;
  dbInstance = db;

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
 * Realiza un diagnóstico en vivo del estado de SQLite, claves foráneas y tablas esenciales
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now();

  // Si no hay una conexión activa inicializada, reportar desconectado inmediatamente
  if (!clientInstance) {
    return {
      status: 'disconnected',
      foreignKeys: false,
      dialect: 'sqlite',
      driver: '@libsql/client',
      databaseUrl: sanitizeDatabaseUrl(activeDatabaseUrl || config.databaseUrl),
      tablesVerified: [],
      latencyMs: Date.now() - startTime,
    };
  }

  try {
    const client = clientInstance;

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
      databaseUrl: sanitizeDatabaseUrl(activeDatabaseUrl || config.databaseUrl),
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
      databaseUrl: sanitizeDatabaseUrl(activeDatabaseUrl || config.databaseUrl),
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
    try {
      clientInstance.close();
    } catch (closeErr) {
      console.warn('[Database] Advertencia al cerrar conexión SQLite:', closeErr);
    }
    clientInstance = null;
    dbInstance = null;
    activeDatabaseUrl = null;
  }
}
