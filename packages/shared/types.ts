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

/* ==========================================================================
 * FASE 1G: TIPOS DE AUTENTICACIÓN HTTP (AUTH SYSTEM)
 * ========================================================================== */

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

export interface BearerAuthConfig {
  token: string;
}

export interface BasicAuthConfig {
  username: string;
  password: string;
}

export interface ApiKeyAuthConfig {
  key: string;
  value: string;
  addTo: 'header' | 'query';
}

export interface RequestAuthConfig {
  type: AuthType;
  bearer?: BearerAuthConfig;
  basic?: BasicAuthConfig;
  apiKey?: ApiKeyAuthConfig;
}

export interface HttpRequestDefinition {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
  body?: string | object | null;
  auth?: RequestAuthConfig;
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
  auth?: RequestAuthConfig;
  timeoutMs?: number;
  maxResponseSizeBytes?: number;
  maxRedirects?: number;
}

/* ==========================================================================
 * FASE 1D: CONTRATO DEL SISTEMA DE COLECCIONES (COLLECTIONS SYSTEM)
 * ========================================================================== */

export interface SavedRequestData {
  id: string;
  collectionId: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
  body?: string | object | null;
  auth?: RequestAuthConfig;
  contentType?: string;
  createdAt: string;
  updatedAt: string;
  hasProtectedSecrets?: boolean;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description?: string | null;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
  requestsCount: number;
}

export interface CollectionWithRequests extends CollectionSummary {
  requests: SavedRequestData[];
}

export interface CreateCollectionPayload {
  name: string;
  description?: string;
}

export interface UpdateCollectionPayload {
  name?: string;
  description?: string;
}

/* ==========================================================================
 * FASE 2A: CONTRATO DEL SISTEMA DE PROYECTOS (PROJECTS SYSTEM)
 * ========================================================================== */

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  collectionsCount?: number;
}

export interface ProjectWithCollections extends ProjectSummary {
  collections: CollectionSummary[];
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
}

export interface AssociateCollectionPayload {
  collectionId: string;
}

export interface CreateSavedRequestPayload {
  name: string;
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
  body?: string | object | null;
  auth?: RequestAuthConfig;
  contentType?: string;
}

export interface UpdateSavedRequestPayload {
  name?: string;
  method?: HttpMethod;
  url?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
  body?: string | object | null;
  auth?: RequestAuthConfig;
  contentType?: string;
}

/* ==========================================================================
 * FASE 1E: CONTRATO DEL SISTEMA DE VARIABLES Y ENTORNOS (ENVIRONMENTS)
 * ========================================================================== */

export interface EnvironmentVariable {
  id: string;
  name: string;
  value: string;
  isSecret?: boolean;
}

export interface EnvironmentData {
  id: string;
  name: string;
  description?: string | null;
  variables: EnvironmentVariable[];
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentSummary {
  id: string;
  name: string;
  description?: string | null;
  variablesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnvironmentPayload {
  name: string;
  description?: string;
  variables?: EnvironmentVariable[];
}

export interface UpdateEnvironmentPayload {
  name?: string;
  description?: string;
  variables?: EnvironmentVariable[];
}


