/**
 * API Forge - Tipos Compartidos (Fase 0 y Fase 1A)
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

/* ==========================================================================
 * FASE 1A: CONTRATO DEL MOTOR HTTP (HTTP ENGINE)
 * ========================================================================== */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpRequestDefinition {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
  body?: string | object | null;
  timeoutMs?: number;
  maxResponseSizeBytes?: number;
  maxRedirects?: number;
}

export interface HttpResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  contentType: string | null;
  body: string;
  data?: unknown; // Si el Content-Type es application/json y el parseo tiene éxito
  sizeBytes: number;
  redirectsCount: number;
}

export type HttpEngineErrorCode =
  | 'INVALID_URL'
  | 'FORBIDDEN_PROTOCOL'
  | 'SSRF_BLOCKED'
  | 'DNS_RESOLUTION_FAILED'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'NETWORK_ERROR'
  | 'RESPONSE_TOO_LARGE'
  | 'INVALID_REQUEST';

export interface HttpEngineErrorData {
  code: HttpEngineErrorCode;
  message: string;
  details?: unknown;
}

export interface ExecutionTiming {
  durationMs: number;
  startedAt: string;
  completedAt: string;
}

export interface ExecuteRequestResult {
  success: boolean;
  response?: HttpResponseData;
  error?: HttpEngineErrorData;
  timing: ExecutionTiming;
}

export interface ExecuteRequestPayload {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
  body?: string | object | null;
  timeoutMs?: number;
  maxResponseSizeBytes?: number;
  maxRedirects?: number;
}
