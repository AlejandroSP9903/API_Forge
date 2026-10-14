/**
 * API Forge - Tipos Compartidos (Fase 0)
 * Contrato de datos entre Backend (Express) y Frontend (React)
 */

export type ServiceStatus = 'ok' | 'degraded' | 'error';
export type DatabaseConnectionStatus = 'connected' | 'disconnected' | 'uninitialized';

export interface DatabaseHealth {
  status: DatabaseConnectionStatus;
  foreignKeys: boolean;
  dialect: 'sqlite';
  driver: string;
  databaseUrl?: string;
  tablesVerified: string[];
  latencyMs?: number;
}

export interface HealthCheckResponse {
  status: ServiceStatus;
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  nodeVersion: string;
  database: DatabaseHealth;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  timestamp: string;
  details?: unknown;
}

export interface ApiResponseError {
  error: ApiErrorPayload;
}
