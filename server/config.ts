/**
 * API Forge - Configuración del Servidor (Fase 0)
 * Carga y valida variables de entorno de forma segura sin exponer secretos.
 */

import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno locales si existen
dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  databaseUrl: string;
  logLevel: string;
}

function parsePort(val: string | undefined, defaultPort: number): number {
  if (!val) return defaultPort;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    console.warn(`[Config] Puerto inválido "${val}", utilizando puerto por defecto: ${defaultPort}`);
    return defaultPort;
  }
  return parsed;
}

const nodeEnv = (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test')
  ? process.env.NODE_ENV
  : 'development';

export const config: ServerConfig = Object.freeze({
  port: parsePort(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv,
  // En modo test por defecto usamos base de datos en memoria para aislamiento
  databaseUrl: process.env.DATABASE_URL || (nodeEnv === 'test' ? 'file::memory:?cache=shared' : 'file:api_forge.db'),
  logLevel: process.env.LOG_LEVEL || 'info',
});
