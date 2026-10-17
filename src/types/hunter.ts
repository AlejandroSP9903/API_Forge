/**
 * API Forge - Tipos de la Interfaz del Sistema Hunter (Fase 1B)
 */

import type { HttpMethod, ExecuteRequestPayload, ExecuteRequestResult } from '../../packages/shared/types.ts';

export interface KeyValueItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface MissionHistoryItem {
  id: string;
  timestamp: string;
  method: HttpMethod;
  url: string;
  status?: number;
  statusText?: string;
  durationMs: number;
  success: boolean;
  errorCode?: string;
  payload: ExecuteRequestPayload;
  result?: ExecuteRequestResult;
  hasProtectedSecrets?: boolean;
}

export type ActiveNavTab = 'builder' | 'collections' | 'environments' | 'monitor' | 'archive' | 'settings';
