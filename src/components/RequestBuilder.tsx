/**
 * API Forge - Consola del Request Builder (Fase 1B)
 * Interfaz de composición y ejecución de solicitudes HTTP con estética de Solo Leveling.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send,
  Square,
  Plus,
  Trash2,
  Copy,
  Check,
  Code2,
  Sparkles,
  Sliders,
  AlertTriangle,
  ShieldAlert,
  Shield,
  Clock,
  Layers,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCw,
  Crosshair,
  FolderArchive,
  Globe,
  ExternalLink,
  Key,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import type {
  HttpMethod,
  ExecuteRequestPayload,
  ExecuteRequestResult,
  EnvironmentData,
  EnvironmentSummary,
  RequestAuthConfig,
  AuthType,
} from '../../packages/shared/types.ts';
import type { KeyValueItem } from '../types/hunter.ts';
import { playSound } from '../services/audioService.ts';
import { hasProtectedSecrets, sanitizeText, isSensitiveHeader, isVariableReference } from '../services/historySecurityService.ts';
import {
  interpolateRequest,
  interpolateString,
  VARIABLE_REGEX,
} from '../services/environmentService.ts';

/**
 * Normaliza un token Bearer evitando prefijos redundantes (Fase 1G)
 */
export function formatBearerToken(rawToken: string): string {
  const trimmed = (rawToken || '').trim();
  if (!trimmed) return '';
  if (/^bearer\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Bearer ${trimmed}`;
}

/**
 * Codifica credenciales en Base64 seguro para UTF-8 (Fase 1G)
 */
export function encodeBasicAuth(username: string, password: string): string {
  try {
    return btoa(unescape(encodeURIComponent(`${username}:${password}`)));
  } catch {
    return btoa(`${username}:${password}`);
  }
}

interface RequestBuilderProps {
  initialPayload?: ExecuteRequestPayload | null;
  onExecuted?: (payload: ExecuteRequestPayload, result: ExecuteRequestResult) => void;
  onSaveToCollection?: (payload: ExecuteRequestPayload) => void;
  onPayloadChange?: (payload: ExecuteRequestPayload) => void;
  activeEnvironment?: EnvironmentData | null;
  allEnvironments?: EnvironmentSummary[];
  onSelectActiveEnvironment?: (envId: string | null) => void;
  onOpenEnvironmentsTab?: () => void;
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const METHOD_COLORS: Record<HttpMethod, { text: string; bg: string; border: string }> = {
  GET: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  POST: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  PUT: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  PATCH: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  DELETE: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
};

// Misiones preconfiguradas seguras para pruebas rápidas
const MISSION_PRESETS = [
  {
    name: 'GET Post Público',
    method: 'GET' as HttpMethod,
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    description: 'API REST pública con respuesta JSON estándar',
  },
  {
    name: 'GET con Parámetros (?userId=1&_limit=5)',
    method: 'GET' as HttpMethod,
    url: 'https://jsonplaceholder.typicode.com/posts',
    queryParams: { userId: '1', _limit: '5' } as Record<string, string>,
    description: 'Prueba la adición de parámetros tras ? en la URL',
  },
  {
    name: 'POST con JSON',
    method: 'POST' as HttpMethod,
    url: 'https://jsonplaceholder.typicode.com/posts',
    body: JSON.stringify({ title: 'Nueva Misión', body: 'Contenido verificado', userId: 1 }, null, 2),
    description: 'Prueba de envío de cuerpo JSON',
  },
  {
    name: 'Destino 404 Not Found',
    method: 'GET' as HttpMethod,
    url: 'https://jsonplaceholder.typicode.com/posts/999999',
    description: 'Comprueba clasificación de respuesta 404',
  },
  {
    name: 'Trampa SSRF (Bloqueada)',
    method: 'GET' as HttpMethod,
    url: 'http://localhost:3000/api/health',
    description: 'Prueba el escudo SSRF contra loopback interno',
  },
  {
    name: 'GET con {{BASE_URL}}',
    method: 'GET' as HttpMethod,
    url: '{{BASE_URL}}/posts/1',
    description: 'Prueba la interpolación de variables del entorno activo',
  },
];

export function RequestBuilder({
  initialPayload,
  onExecuted,
  onSaveToCollection,
  onPayloadChange,
  activeEnvironment,
  allEnvironments,
  onSelectActiveEnvironment,
  onOpenEnvironmentsTab,
}: RequestBuilderProps) {
  // Estado de configuración de solicitud
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState<string>('https://jsonplaceholder.typicode.com/posts/1');
  const [activeRequestTab, setActiveRequestTab] = useState<'params' | 'headers' | 'auth' | 'body' | 'config'>('params');

  // Parámetros de consulta y encabezados
  const [queryParams, setQueryParams] = useState<KeyValueItem[]>([
    { id: '1', key: '', value: '', enabled: true },
  ]);
  const [headers, setHeaders] = useState<KeyValueItem[]>([
    { id: '1', key: 'Accept', value: 'application/json', enabled: true },
  ]);

  // Estado de Autenticación HTTP (Fase 1G)
  const [authConfig, setAuthConfig] = useState<RequestAuthConfig>({
    type: 'none',
    bearer: { token: '' },
    basic: { username: '', password: '' },
    apiKey: { key: 'X-API-Key', value: '', addTo: 'header' },
  });
  const [showBasicPassword, setShowBasicPassword] = useState<boolean>(false);

  // Cuerpo y configuración
  const [bodyText, setBodyText] = useState<string>('');
  const [timeoutMs, setTimeoutMs] = useState<number>(10000);
  const [maxRedirects, setMaxRedirects] = useState<number>(5);

  // Helper para construir el payload actual
  const buildCurrentPayload = useCallback((): ExecuteRequestPayload => {
    const cleanParams: Record<string, string> = {};
    for (const p of queryParams) {
      if (p.enabled && p.key.trim()) {
        cleanParams[p.key.trim()] = p.value;
      }
    }

    const cleanHeaders: Record<string, string> = {};
    for (const h of headers) {
      if (h.enabled && h.key.trim()) {
        cleanHeaders[h.key.trim()] = h.value;
      }
    }

    let parsedBody: string | object | null = null;
    // Métodos GET nunca deben enviar cuerpo de solicitud
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        parsedBody = bodyText;
      }
    }

    return {
      url: url.trim(),
      method,
      queryParams: Object.keys(cleanParams).length > 0 ? cleanParams : undefined,
      headers: Object.keys(cleanHeaders).length > 0 ? cleanHeaders : undefined,
      body: parsedBody,
      auth: authConfig.type !== 'none' ? authConfig : undefined,
      timeoutMs,
      maxRedirects,
    };
  }, [url, method, queryParams, headers, bodyText, authConfig, timeoutMs, maxRedirects]);

  // Cálculo de vista previa de URL resultante en tiempo real (Base + Query Params + API Key Query + Interpolación)
  const effectiveUrlPreview = useMemo(() => {
    const cleanBase = url.trim();
    const enabledParams: KeyValueItem[] = [...queryParams.filter((p) => p.enabled && p.key.trim())];

    // Si la autenticación es API Key en Query Param, incorporarla al cálculo de la URL efectiva
    if (authConfig.type === 'apikey' && authConfig.apiKey?.addTo === 'query' && authConfig.apiKey.key.trim()) {
      enabledParams.push({
        id: 'auth_apikey_preview',
        key: authConfig.apiKey.key.trim(),
        value: authConfig.apiKey.value || '',
        enabled: true,
      });
    }

    const hasParams = enabledParams.length > 0;

    if (!cleanBase) {
      return { rawUrlWithParams: '', resolvedUrlWithParams: undefined, hasParams: false };
    }

    let rawUrlWithParams = cleanBase;
    if (hasParams) {
      const separator = cleanBase.includes('?') ? '&' : '?';
      const queryString = enabledParams
        .map((p) => `${p.key.trim()}=${p.value}`)
        .join('&');
      rawUrlWithParams = `${cleanBase}${separator}${queryString}`;
    }

    let resolvedUrlWithParams: string | undefined = undefined;
    if (activeEnvironment?.variables && activeEnvironment.variables.length > 0) {
      try {
        const varsMap = new Map<string, string>();
        for (const v of activeEnvironment.variables) {
          if (v.name?.trim()) {
            varsMap.set(v.name.trim(), v.value ?? '');
          }
        }
        resolvedUrlWithParams = interpolateString(rawUrlWithParams, varsMap);
      } catch {
        resolvedUrlWithParams = undefined;
      }
    }

    return {
      rawUrlWithParams,
      resolvedUrlWithParams,
      hasParams,
    };
  }, [url, queryParams, authConfig, activeEnvironment]);

  // Sincronizar hacia afuera el payload actual cuando cambia
  useEffect(() => {
    if (onPayloadChange) {
      onPayloadChange(buildCurrentPayload());
    }
  }, [buildCurrentPayload, onPayloadChange]);

  // Estado de ejecución
  const [loading, setLoading] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<ExecuteRequestResult | null>(null);
  const [activeResponseTab, setActiveResponseTab] = useState<'body' | 'headers' | 'raw'>('body');
  const [copied, setCopied] = useState<boolean>(false);
  const [jsonSyntaxError, setJsonSyntaxError] = useState<string | null>(null);
  const [hasProtectedValuesWarning, setHasProtectedValuesWarning] = useState<boolean>(false);

  // AbortController para cancelación en vuelo
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cargar carga inicial si proviene del historial o colección
  useEffect(() => {
    if (initialPayload) {
      setMethod(initialPayload.method || 'GET');
      setUrl(initialPayload.url);
      setHasProtectedValuesWarning(hasProtectedSecrets(initialPayload));
      if (initialPayload.queryParams) {
        const qList = Object.entries(initialPayload.queryParams).map(([k, v], i) => ({
          id: String(i + 1),
          key: k,
          value: String(v),
          enabled: true,
        }));
        setQueryParams(qList.length > 0 ? qList : [{ id: '1', key: '', value: '', enabled: true }]);
      }
      if (initialPayload.headers) {
        const hList = Object.entries(initialPayload.headers).map(([k, v], i) => ({
          id: String(i + 1),
          key: k,
          value: v,
          enabled: true,
        }));
        setHeaders(hList.length > 0 ? hList : [{ id: '1', key: '', value: '', enabled: true }]);
      }
      if (initialPayload.body) {
        setBodyText(typeof initialPayload.body === 'object' ? JSON.stringify(initialPayload.body, null, 2) : String(initialPayload.body));
      }
      if (initialPayload.auth) {
        setAuthConfig({
          type: initialPayload.auth.type || 'none',
          bearer: { token: initialPayload.auth.bearer?.token || '' },
          basic: {
            username: initialPayload.auth.basic?.username || '',
            password: initialPayload.auth.basic?.password || '',
          },
          apiKey: {
            key: initialPayload.auth.apiKey?.key || 'X-API-Key',
            value: initialPayload.auth.apiKey?.value || '',
            addTo: initialPayload.auth.apiKey?.addTo || 'header',
          },
        });
      } else {
        setAuthConfig({
          type: 'none',
          bearer: { token: '' },
          basic: { username: '', password: '' },
          apiKey: { key: 'X-API-Key', value: '', addTo: 'header' },
        });
      }
    } else {
      setHasProtectedValuesWarning(false);
    }
  }, [initialPayload]);

  // Validar JSON al escribir en la pestaña de body
  useEffect(() => {
    if (!bodyText.trim()) {
      setJsonSyntaxError(null);
      return;
    }
    try {
      JSON.parse(bodyText);
      setJsonSyntaxError(null);
    } catch (err) {
      setJsonSyntaxError(err instanceof Error ? err.message : 'JSON inválido');
    }
  }, [bodyText]);

  // Manejo de tabla de Parámetros y Encabezados
  const addParam = () => setQueryParams((prev) => [...prev, { id: String(Date.now()), key: '', value: '', enabled: true }]);
  const updateParam = (id: string, field: 'key' | 'value' | 'enabled', val: string | boolean) => {
    setQueryParams((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: val } : p)));
  };
  const removeParam = (id: string) => setQueryParams((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : [{ id: '1', key: '', value: '', enabled: true }]));

  const addHeader = () => setHeaders((prev) => [...prev, { id: String(Date.now()), key: '', value: '', enabled: true }]);
  const updateHeader = (id: string, field: 'key' | 'value' | 'enabled', val: string | boolean) => {
    setHeaders((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: val } : h)));
  };
  const removeHeader = (id: string) => setHeaders((prev) => (prev.length > 1 ? prev.filter((h) => h.id !== id) : [{ id: '1', key: '', value: '', enabled: true }]));

  // Formatear JSON
  const formatJson = () => {
    if (!bodyText.trim()) return;
    try {
      const parsed = JSON.parse(bodyText);
      setBodyText(JSON.stringify(parsed, null, 2));
      setJsonSyntaxError(null);
    } catch (e) {
      // syntax error ya está en pantalla
    }
  };

  // Ejecución de la Solicitud
  const handleExecute = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setExecutionResult(null);

    // 1. Construir parámetros de consulta limpios
    const cleanParams: Record<string, string> = {};
    for (const p of queryParams) {
      if (p.enabled && p.key.trim()) {
        cleanParams[p.key.trim()] = p.value;
      }
    }

    // 2. Construir encabezados limpios
    const cleanHeaders: Record<string, string> = {};
    for (const h of headers) {
      if (h.enabled && h.key.trim()) {
        cleanHeaders[h.key.trim()] = h.value;
      }
    }

    // 3. Procesar cuerpo si el método lo permite (GET nunca lleva cuerpo)
    let parsedBody: string | object | null = null;
    const varPattern = /\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/;

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch (jsonErr) {
        // Si no contiene variables de entorno {{...}}, rechazar inmediatamente por JSON inválido
        if (!varPattern.test(bodyText)) {
          playSound('requestError');
          const errResult: ExecuteRequestResult = {
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: `El cuerpo de la solicitud no es un JSON válido. Revisa la sintaxis en la pestaña 'CUERPO (JSON)': ${jsonErr instanceof Error ? jsonErr.message : 'Error de formato JSON'}`,
            },
            timing: {
              durationMs: 0,
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
            },
          };
          setExecutionResult(errResult);
          setLoading(false);
          return;
        }
        // Si contiene variables, se conservará como texto para ser interpolado en el paso 3.5
        parsedBody = bodyText;
      }
    }

    const payload: ExecuteRequestPayload = {
      url: url.trim(),
      method,
      queryParams: Object.keys(cleanParams).length > 0 ? cleanParams : undefined,
      headers: Object.keys(cleanHeaders).length > 0 ? cleanHeaders : undefined,
      body: method === 'GET' ? null : parsedBody,
      auth: authConfig.type !== 'none' ? authConfig : undefined,
      timeoutMs,
      maxRedirects,
    };

    // 3.5. Detección e interpolación de variables {{VARIABLE}} (Fase 1E & 1G)
    let payloadToSend: ExecuteRequestPayload = payload;
    const hasVarInUrl = varPattern.test(url);
    const hasVarInParams = queryParams.some(
      (p) => p.enabled && (varPattern.test(p.key) || varPattern.test(p.value))
    );
    const hasVarInHeaders = headers.some(
      (h) => h.enabled && (varPattern.test(h.key) || varPattern.test(h.value))
    );
    const hasVarInBody = varPattern.test(bodyText);
    const hasVarInAuth =
      authConfig.type === 'bearer'
        ? varPattern.test(authConfig.bearer?.token || '')
        : authConfig.type === 'basic'
        ? varPattern.test(authConfig.basic?.username || '') || varPattern.test(authConfig.basic?.password || '')
        : authConfig.type === 'apikey'
        ? varPattern.test(authConfig.apiKey?.key || '') || varPattern.test(authConfig.apiKey?.value || '')
        : false;
    const hasVariables = hasVarInUrl || hasVarInParams || hasVarInHeaders || hasVarInBody || hasVarInAuth;

    if (hasVariables) {
      if (!activeEnvironment) {
        playSound('requestError');
        const errResult: ExecuteRequestResult = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message:
              'La solicitud contiene variables sin resolver (ej: {{...}}), pero no hay ningún entorno activo seleccionado. Selecciona un entorno en el selector superior antes de ejecutar.',
          },
          timing: {
            durationMs: 0,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        };
        setExecutionResult(errResult);
        setLoading(false);
        return;
      }

      try {
        const { interpolatedPayload, secretVarsUsed } = interpolateRequest(
          payload,
          activeEnvironment.variables
        );
        payloadToSend = interpolatedPayload;

        // Validar que el cuerpo resultante tras interpolar sea JSON válido si el método lo requiere
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && payloadToSend.body) {
          if (typeof payloadToSend.body === 'string') {
            try {
              payloadToSend.body = JSON.parse(payloadToSend.body);
            } catch (afterInterpErr) {
              playSound('requestError');
              const errResult: ExecuteRequestResult = {
                success: false,
                error: {
                  code: 'INVALID_REQUEST',
                  message: `El cuerpo de la solicitud no es un JSON válido tras resolver las variables. Revisa la sintaxis en la pestaña 'CUERPO (JSON)': ${afterInterpErr instanceof Error ? afterInterpErr.message : 'Error de formato JSON'}`,
                },
                timing: {
                  durationMs: 0,
                  startedAt: new Date().toISOString(),
                  completedAt: new Date().toISOString(),
                },
              };
              setExecutionResult(errResult);
              setLoading(false);
              return;
            }
          }
        }

        if (secretVarsUsed.length > 0) {
          setHasProtectedValuesWarning(true);
        }
      } catch (interpErr) {
        playSound('requestError');
        const errResult: ExecuteRequestResult = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message:
              interpErr instanceof Error
                ? interpErr.message
                : 'Error al resolver las variables del entorno activo.',
          },
          timing: {
            durationMs: 0,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        };
        setExecutionResult(errResult);
        setLoading(false);
        return;
      }
    }

    // 3.6. Inyectar credenciales de autenticación HTTP en encabezados o query params (Fase 1G)
    const effectiveAuth = payloadToSend.auth;
    if (effectiveAuth && effectiveAuth.type !== 'none') {
      if (effectiveAuth.type === 'bearer' && effectiveAuth.bearer?.token) {
        const formattedBearer = formatBearerToken(effectiveAuth.bearer.token);
        payloadToSend.headers = {
          ...(payloadToSend.headers || {}),
          Authorization: formattedBearer,
        };
      } else if (effectiveAuth.type === 'basic' && effectiveAuth.basic) {
        const u = effectiveAuth.basic.username || '';
        const p = effectiveAuth.basic.password || '';
        const encoded = encodeBasicAuth(u, p);
        payloadToSend.headers = {
          ...(payloadToSend.headers || {}),
          Authorization: `Basic ${encoded}`,
        };
      } else if (effectiveAuth.type === 'apikey' && effectiveAuth.apiKey) {
        const key = (effectiveAuth.apiKey.key || '').trim();
        const val = effectiveAuth.apiKey.value || '';
        if (key) {
          if (effectiveAuth.apiKey.addTo === 'query') {
            payloadToSend.queryParams = {
              ...(payloadToSend.queryParams || {}),
              [key]: val,
            };
          } else {
            payloadToSend.headers = {
              ...(payloadToSend.headers || {}),
              [key]: val,
            };
          }
        }
      }
    }

    // 4. Instanciar controlador de cancelación y reproducir inicio de solicitud
    const controller = new AbortController();
    abortControllerRef.current = controller;
    playSound('requestStart');

    try {
      const response = await fetch('/api/requests/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadToSend),
        signal: controller.signal,
      });

      const result: ExecuteRequestResult = await response.json();
      setExecutionResult(result);

      // Reproducir sonido adecuado según el resultado
      if (result.success) {
        playSound('requestSuccess');
      } else if (result.error?.code === 'SSRF_BLOCKED') {
        playSound('securityBlocked');
      } else if (result.error?.code !== 'ABORTED') {
        playSound('requestError');
      }

      if (onExecuted) {
        onExecuted(payload, result);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        const abortedResult: ExecuteRequestResult = {
          success: false,
          error: {
            code: 'ABORTED',
            message: 'La misión fue cancelada por el usuario en el cliente.',
          },
          timing: {
            durationMs: 0,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        };
        setExecutionResult(abortedResult);
      } else {
        playSound('requestError');
        const rawMsg = err instanceof Error ? err.message : 'Error de comunicación con el backend.';
        const { sanitizedText: safeErrMsg } = sanitizeText(rawMsg);
        const netErrorResult: ExecuteRequestResult = {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: safeErrMsg,
          },
          timing: {
            durationMs: 0,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        };
        setExecutionResult(netErrorResult);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const insertQuickHeader = (key: string, value: string) => {
    setHeaders((prev) => {
      const existing = prev.find((h) => h.key.trim().toLowerCase() === key.toLowerCase());
      if (existing) {
        return prev.map((h) =>
          h.id === existing.id ? { ...h, key, value, enabled: true } : h
        );
      }
      const existingEmpty = prev.find((h) => !h.key.trim());
      if (existingEmpty) {
        return prev.map((h) =>
          h.id === existingEmpty.id ? { ...h, key, value, enabled: true } : h
        );
      }
      return [...prev, { id: String(Date.now()), key, value, enabled: true }];
    });
  };

  const applyPreset = (preset: typeof MISSION_PRESETS[0]) => {
    setMethod(preset.method);
    setUrl(preset.url);
    if (preset.body) {
      setBodyText(preset.body);
      setActiveRequestTab('body');
    } else {
      setBodyText('');
    }

    if ('queryParams' in preset && preset.queryParams) {
      const qList = Object.entries(preset.queryParams).map(([k, v], i) => ({
        id: String(i + 1),
        key: k,
        value: String(v),
        enabled: true,
      }));
      setQueryParams(qList.length > 0 ? qList : [{ id: '1', key: '', value: '', enabled: true }]);
      setActiveRequestTab('params');
    } else {
      setQueryParams([{ id: '1', key: '', value: '', enabled: true }]);
    }

    setAuthConfig({
      type: 'none',
      bearer: { token: '' },
      basic: { username: '', password: '' },
      apiKey: { key: 'X-API-Key', value: '', addTo: 'header' },
    });
  };

  return (
    <div className="space-y-6">
      {/* Título de la Sección con Estilo de Misión */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>MISION ACTIVA // REQUEST BUILDER</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
            CONSOLA DE DISPARO DE SOLICITUDES
          </h2>
        </div>

        {/* Selector de Entorno Activo y Acceso rápido a misiones de prueba */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Entorno Activo */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#070b16] border border-cyan-500/30 text-xs font-mono shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            <Globe className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] text-cyan-400/80 font-bold uppercase hidden sm:inline">ENTORNO:</span>
            <select
              value={activeEnvironment?.id || ''}
              onChange={(e) => onSelectActiveEnvironment?.(e.target.value || null)}
              className="bg-transparent text-cyan-300 font-bold text-xs focus:outline-none cursor-pointer pr-1"
              title="Seleccionar Entorno Activo para Interpolación {{VARIABLE}}"
            >
              <option value="" className="bg-[#070b16] text-slate-400">
                -- Sin Entorno (Inactivo) --
              </option>
              {allEnvironments?.map((env) => (
                <option key={env.id} value={env.id} className="bg-[#070b16] text-slate-100">
                  {env.name} ({env.variablesCount} vars)
                </option>
              ))}
            </select>
            {onOpenEnvironmentsTab && (
              <button
                type="button"
                onClick={onOpenEnvironmentsTab}
                className="text-[10px] text-cyan-400 hover:text-cyan-200 underline font-bold"
                title="Configurar variables de entorno"
              >
                [CONFIG]
              </button>
            )}
          </div>

          {/* Preajustes */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[10px] font-mono text-slate-400 uppercase shrink-0">Preajustes:</span>
            {MISSION_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="px-2.5 py-1 rounded text-[11px] font-mono bg-slate-900/80 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition whitespace-nowrap"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Aviso de valores protegidos / redactados */}
      {hasProtectedValuesWarning && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 flex items-start justify-between gap-3 text-xs font-mono text-amber-200">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-300">
                AVISO DE SEGURIDAD // VALORES CONFIDENCIALES PROTEGIDOS:
              </span>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Esta solicitud se cargó desde el historial con secretos redactados (<code className="bg-amber-950/70 px-1 py-0.5 rounded text-amber-300 font-bold">[VALOR_PROTEGIDO]</code>) en sus cabeceras, parámetros o cuerpo. Por seguridad, debes ingresar nuevamente tus credenciales reales antes de ejecutar la misión.
              </p>
            </div>
          </div>
          <button
            onClick={() => setHasProtectedValuesWarning(false)}
            className="text-amber-400 hover:text-white px-2 py-1 rounded bg-amber-950/50 border border-amber-500/30 text-[10px] shrink-0"
          >
            ENTENDIDO
          </button>
        </div>
      )}

      {/* Barra Principal de Entrada (Método + URL + Botón Disparo) */}
      <div className="p-3 sm:p-4 rounded-xl holo-panel space-y-3">
        <div className="sm:flex sm:items-center sm:gap-3 space-y-3 sm:space-y-0">
          {/* Selector de Método HTTP */}
          <div className="relative shrink-0">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              disabled={loading}
              className={`w-full sm:w-auto px-3.5 py-2.5 rounded-lg font-mono text-xs font-black uppercase tracking-wider border transition appearance-none cursor-pointer pr-8 ${METHOD_COLORS[method].bg} ${METHOD_COLORS[method].text} ${METHOD_COLORS[method].border}`}
            >
              {METHODS.map((m) => (
                <option key={m} value={m} className="bg-[#070b16] text-slate-100">
                  {m}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-cyan-400">
              ▼
            </div>
          </div>

          {/* Entrada de URL */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleExecute()}
              placeholder="https://api.destino.com/v1/recurso"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-lg bg-[#050811]/90 border border-cyan-500/20 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 text-xs sm:text-sm font-mono text-cyan-100 placeholder:text-slate-600 transition"
            />
          </div>

          {/* Botón de Ejecutar o Cancelar */}
          <div className="shrink-0 flex items-center gap-2">
            {loading ? (
              <button
                onClick={handleCancel}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/50 text-rose-300 font-mono text-xs font-bold tracking-wider transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(244,63,94,0.3)] cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 fill-rose-400" />
                <span>CANCELAR</span>
              </button>
            ) : (
              <>
                {onSaveToCollection && (
                  <button
                    type="button"
                    onClick={() => onSaveToCollection(buildCurrentPayload())}
                    disabled={!url.trim()}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold tracking-wider transition flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(6,182,212,0.15)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Guardar solicitud en una colección SQLite"
                  >
                    <FolderArchive className="h-3.5 w-3.5" />
                    <span>GUARDAR</span>
                  </button>
                )}
                <button
                  onClick={handleExecute}
                  disabled={!url.trim()}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 border border-cyan-400/50 text-slate-950 font-mono text-xs font-black tracking-wider transition flex items-center justify-center gap-2 cyan-glow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-3.5 w-3.5 fill-slate-950" />
                  <span>DISPARAR MISIÓN</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Vista Previa de URL Resultante (URL Base + Parámetros tras ? + Variables) */}
        <div className="pt-2 border-t border-cyan-500/10 space-y-1.5 text-xs font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] font-bold uppercase tracking-wider">
              <Globe className="h-3 w-3 text-cyan-400" />
              <span>URL EFECTIVA RESULTANTE:</span>
            </div>
            {effectiveUrlPreview.hasParams && (
              <span className="text-[10px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                +{queryParams.filter((p) => p.enabled && p.key.trim()).length} parámetro(s) agregados tras '?'
              </span>
            )}
          </div>

          <div className="p-2 rounded bg-[#03060d] border border-cyan-500/20 text-slate-200 text-xs font-mono break-all select-all flex items-center justify-between gap-2">
            <span>
              {effectiveUrlPreview.rawUrlWithParams || (
                <span className="text-slate-600">Introduce una URL de destino...</span>
              )}
            </span>
            {effectiveUrlPreview.rawUrlWithParams && (
              <button
                type="button"
                onClick={() => copyToClipboard(effectiveUrlPreview.rawUrlWithParams)}
                className="text-slate-400 hover:text-cyan-300 shrink-0 p-1"
                title="Copiar URL efectiva"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Si hay entorno activo y variables en la URL, mostrar la versión resuelta */}
          {effectiveUrlPreview.resolvedUrlWithParams &&
            effectiveUrlPreview.resolvedUrlWithParams !== effectiveUrlPreview.rawUrlWithParams && (
              <div className="p-2 rounded bg-emerald-950/20 border border-emerald-500/30 text-[11px] font-mono text-emerald-300 flex items-center gap-2 break-all select-all">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-[10px] font-bold uppercase text-emerald-400/80 shrink-0">
                  Resuelta con {activeEnvironment?.name}:
                </span>
                <span className="font-bold">{effectiveUrlPreview.resolvedUrlWithParams}</span>
              </div>
            )}
        </div>
      </div>

      {/* Panel de Configuración de la Solicitud (Pestañas: Params, Headers, Body, Config) */}
      <div className="rounded-xl holo-panel overflow-hidden">
        {/* Cabecera de Pestañas */}
        <div className="flex border-b border-cyan-500/20 bg-[#070b16]/70 px-4 overflow-x-auto">
          <button
            onClick={() => setActiveRequestTab('params')}
            className={`px-4 py-3 text-xs font-mono font-bold transition flex items-center gap-2 relative whitespace-nowrap ${
              activeRequestTab === 'params'
                ? 'text-cyan-300 border-b-2 border-cyan-400 -mb-px'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>PARÁMETROS</span>
            {queryParams.filter((p) => p.enabled && p.key.trim()).length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {queryParams.filter((p) => p.enabled && p.key.trim()).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveRequestTab('headers')}
            className={`px-4 py-3 text-xs font-mono font-bold transition flex items-center gap-2 relative whitespace-nowrap ${
              activeRequestTab === 'headers'
                ? 'text-cyan-300 border-b-2 border-cyan-400 -mb-px'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>ENCABEZADOS</span>
            {headers.filter((h) => h.enabled && h.key.trim()).length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {headers.filter((h) => h.enabled && h.key.trim()).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveRequestTab('auth')}
            className={`px-4 py-3 text-xs font-mono font-bold transition flex items-center gap-2 relative whitespace-nowrap ${
              activeRequestTab === 'auth'
                ? 'text-cyan-300 border-b-2 border-cyan-400 -mb-px'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="h-3.5 w-3.5" />
            <span>AUTENTICACIÓN</span>
            {authConfig.type !== 'none' && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                {authConfig.type === 'bearer' ? 'BEARER' : authConfig.type === 'basic' ? 'BASIC' : 'API KEY'}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveRequestTab('body')}
            className={`px-4 py-3 text-xs font-mono font-bold transition flex items-center gap-2 relative whitespace-nowrap ${
              activeRequestTab === 'body'
                ? 'text-cyan-300 border-b-2 border-cyan-400 -mb-px'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>CUERPO (JSON)</span>
            {method !== 'GET' && bodyText.trim() && (
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
            )}
            {method === 'GET' && (
              <span className="text-[10px] text-slate-500 uppercase font-normal">(No aplica)</span>
            )}
          </button>

          <button
            onClick={() => setActiveRequestTab('config')}
            className={`px-4 py-3 text-xs font-mono font-bold transition flex items-center gap-2 relative whitespace-nowrap ${
              activeRequestTab === 'config'
                ? 'text-cyan-300 border-b-2 border-cyan-400 -mb-px'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>LIMITES & AJUSTES</span>
          </button>
        </div>

        {/* Contenido de Pestaña: Parámetros */}
        {activeRequestTab === 'params' && (
          <div className="p-4 space-y-3">
            {/* Banner explicativo de Parámetros de Consulta */}
            <div className="p-3 rounded-lg bg-[#070b16] border border-cyan-500/20 text-xs font-mono space-y-1">
              <div className="flex items-center justify-between text-[11px] text-cyan-300 font-bold">
                <span>// Parámetros de Consulta (Query Params)</span>
                <span className="text-[10px] text-slate-400 font-normal">Se agregan tras '?' en la URL</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Los parámetros representan datos que se adjuntan a la URL tras el carácter <code className="text-cyan-300 font-bold">?</code> y se concatenan con <code className="text-cyan-300 font-bold">&</code> (ej: <code className="text-cyan-300 font-bold">?userId=1&_limit=5</code>). Son independientes de los encabezados HTTP y admiten variables <code className="text-cyan-300 font-bold">{'{{VARIABLE}}'}</code>.
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span className="font-mono text-[11px] text-cyan-400/80">
                Pares Clave-Valor ({queryParams.filter((p) => p.enabled && p.key.trim()).length} activos)
              </span>
              <button
                onClick={addParam}
                className="px-2.5 py-1 rounded text-xs font-mono bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 flex items-center gap-1 transition"
              >
                <Plus className="h-3 w-3" />
                <span>AÑADIR PARÁMETRO</span>
              </button>
            </div>

            <div className="space-y-2">
              {queryParams.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => updateParam(p.id, 'enabled', e.target.checked)}
                    title={p.enabled ? 'Parámetro habilitado' : 'Parámetro deshabilitado'}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 h-4 w-4 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={p.key}
                    onChange={(e) => updateParam(p.id, 'key', e.target.value)}
                    placeholder="Clave (ej. userId)"
                    className="flex-1 px-3 py-1.5 rounded bg-[#050811] border border-slate-800 focus:border-cyan-500 text-xs font-mono text-slate-200 placeholder:text-slate-600"
                  />
                  <input
                    type="text"
                    value={p.value}
                    onChange={(e) => updateParam(p.id, 'value', e.target.value)}
                    placeholder="Valor (ej. 1 o {{POST_ID}})"
                    className="flex-1 px-3 py-1.5 rounded bg-[#050811] border border-slate-800 focus:border-cyan-500 text-xs font-mono text-slate-200 placeholder:text-slate-600"
                  />
                  <button
                    onClick={() => removeParam(p.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                    title="Eliminar fila"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contenido de Pestaña: Encabezados */}
        {activeRequestTab === 'headers' && (
          <div className="p-4 space-y-3">
            {/* Banner explicativo de Encabezados HTTP */}
            <div className="p-3 rounded-lg bg-[#070b16] border border-indigo-500/20 text-xs font-mono space-y-1">
              <div className="flex items-center justify-between text-[11px] text-indigo-300 font-bold">
                <span>// Metadatos HTTP (Encabezados / Headers - RFC 7230)</span>
                <span className="text-[10px] text-slate-400 font-normal">Viajan en la cabecera, no en la URL</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Los encabezados son metadatos que describen la solicitud (como <code className="text-indigo-300 font-bold">Content-Type</code> o credenciales de autenticación <code className="text-indigo-300 font-bold">Authorization</code>). Los encabezados confidenciales quedan automáticamente enmascarados en el historial de misiones.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-slate-500 uppercase">Insertar rápido:</span>
                <button
                  onClick={() => insertQuickHeader('Content-Type', 'application/json')}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-300"
                >
                  + Content-Type
                </button>
                <button
                  onClick={() => insertQuickHeader('Authorization', 'Bearer {{TOKEN}}')}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-300"
                >
                  + Bearer Token
                </button>
                <button
                  onClick={() => insertQuickHeader('Accept', 'application/json')}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300"
                >
                  + Accept
                </button>
              </div>
              <button
                onClick={addHeader}
                className="px-2.5 py-1 rounded text-xs font-mono bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 flex items-center gap-1 transition"
              >
                <Plus className="h-3 w-3" />
                <span>AÑADIR ENCABEZADO</span>
              </button>
            </div>

            <div className="space-y-2">
              {headers.map((h) => {
                const isSensitive = isSensitiveHeader(h.key);
                return (
                  <div key={h.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={h.enabled}
                      onChange={(e) => updateHeader(h.id, 'enabled', e.target.checked)}
                      title={h.enabled ? 'Encabezado habilitado' : 'Encabezado deshabilitado'}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 h-4 w-4 cursor-pointer"
                    />
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={h.key}
                        onChange={(e) => updateHeader(h.id, 'key', e.target.value)}
                        placeholder="Encabezado (ej. Authorization)"
                        className="w-full px-3 py-1.5 rounded bg-[#050811] border border-slate-800 focus:border-cyan-500 text-xs font-mono text-slate-200 placeholder:text-slate-600"
                      />
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={h.value}
                        onChange={(e) => updateHeader(h.id, 'value', e.target.value)}
                        placeholder="Valor (ej. Bearer {{TOKEN}})"
                        className="w-full px-3 py-1.5 rounded bg-[#050811] border border-slate-800 focus:border-cyan-500 text-xs font-mono text-slate-200 placeholder:text-slate-600"
                      />
                    </div>
                    {isSensitive && (
                      <span
                        title="Encabezado de credenciales confidenciales: se redactará en el historial"
                        className="flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-950/50 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0"
                      >
                        <Shield className="h-2.5 w-2.5" />
                        <span className="hidden sm:inline">Protegido</span>
                      </span>
                    )}
                    <button
                      onClick={() => removeHeader(h.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                      title="Eliminar encabezado"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contenido de Pestaña: Autenticación HTTP (Fase 1G) */}
        {activeRequestTab === 'auth' && (
          <div className="p-4 space-y-4">
            {/* Selector de Tipo de Autenticación */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-cyan-400 font-bold flex items-center gap-2">
                <Key className="h-3.5 w-3.5" />
                <span>// TIPO DE AUTENTICACIÓN HTTP</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'none', label: 'Sin autenticación', icon: Shield },
                  { id: 'bearer', label: 'Bearer Token', icon: Key },
                  { id: 'basic', label: 'Basic Auth', icon: Lock },
                  { id: 'apikey', label: 'API Key', icon: ShieldCheck },
                ].map((item) => {
                  const isSelected = authConfig.type === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setAuthConfig((prev) => ({
                          ...prev,
                          type: item.id as AuthType,
                        }))
                      }
                      className={`p-2.5 rounded-lg border text-xs font-mono flex items-center gap-2 transition ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)] font-bold'
                          : 'bg-[#070b16] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configuración Dinámica según Tipo */}
            {authConfig.type === 'none' && (
              <div className="p-4 rounded-lg bg-[#070b16] border border-slate-800 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                  <Shield className="h-4 w-4" />
                  <span>SOLICITUD PÚBLICA // SIN CREDENCIALES</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  No se inyectará ningún encabezado ni parámetro de autenticación en la solicitud. Si el servidor remoto requiere autenticación personalizada, puedes configurar encabezados manuales en la pestaña <code className="text-cyan-300 font-bold">ENCABEZADOS</code> o seleccionar un método arriba.
                </p>
              </div>
            )}

            {authConfig.type === 'bearer' && (
              <div className="space-y-4 p-4 rounded-lg bg-[#070b16] border border-cyan-500/20">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <label className="text-slate-300 font-bold flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Token Bearer:</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Admite variables ej: {'{{TOKEN}}'}</span>
                  </div>
                  <input
                    type="text"
                    value={authConfig.bearer?.token || ''}
                    onChange={(e) =>
                      setAuthConfig((prev) => ({
                        ...prev,
                        bearer: { token: e.target.value },
                      }))
                    }
                    placeholder="eyJhbGciOiJIUzI1Ni... o {{TOKEN}}"
                    className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-slate-800 focus:border-cyan-400 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none"
                  />
                  <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                    Introduce únicamente el token. API Forge añadirá automáticamente el prefijo <code className="text-cyan-300 font-bold">Bearer </code> (y no lo duplicará si ya lo incluyes).
                  </p>
                </div>

                {/* Previsualización en tiempo real del encabezado Bearer */}
                <div className="p-3 rounded-lg bg-black/40 border border-slate-800/80 text-[11px] font-mono space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">// Encabezado HTTP que se generará:</div>
                  <div className="text-cyan-300 flex items-center gap-2 overflow-x-auto">
                    <span className="text-slate-400 font-bold">Authorization:</span>
                    <span>
                      {authConfig.bearer?.token ? formatBearerToken(authConfig.bearer.token) : '<Bearer [TOKEN]>'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {authConfig.type === 'basic' && (
              <div className="space-y-4 p-4 rounded-lg bg-[#070b16] border border-cyan-500/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <label className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Usuario (Username):</span>
                      </label>
                      <span className="text-[10px] text-slate-400">Admite {'{{USER}}'}</span>
                    </div>
                    <input
                      type="text"
                      value={authConfig.basic?.username || ''}
                      onChange={(e) =>
                        setAuthConfig((prev) => ({
                          ...prev,
                          basic: {
                            username: e.target.value,
                            password: prev.basic?.password || '',
                          },
                        }))
                      }
                      placeholder="admin o {{USUARIO}}"
                      className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-slate-800 focus:border-cyan-400 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <label className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Contraseña (Password):</span>
                      </label>
                      <span className="text-[10px] text-slate-400">Admite {'{{PASS}}'}</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showBasicPassword ? 'text' : 'password'}
                        value={authConfig.basic?.password || ''}
                        onChange={(e) =>
                          setAuthConfig((prev) => ({
                            ...prev,
                            basic: {
                              username: prev.basic?.username || '',
                              password: e.target.value,
                            },
                          }))
                        }
                        placeholder="•••••••• o {{PASSWORD}}"
                        className="w-full pl-3 pr-10 py-2 rounded-lg bg-[#050811] border border-slate-800 focus:border-cyan-400 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBasicPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 transition"
                        title={showBasicPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      >
                        {showBasicPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                  Las credenciales se codificarán en Base64 según el estándar RFC 7617 antes de enviarse.
                </p>

                {/* Previsualización en tiempo real del encabezado Basic */}
                <div className="p-3 rounded-lg bg-black/40 border border-slate-800/80 text-[11px] font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">// Encabezado HTTP que se generará:</span>
                    {!showBasicPassword && authConfig.basic?.password && !isVariableReference(authConfig.basic.password) && (
                      <span className="text-[10px] text-amber-400/80 font-mono">// Contraseña enmascarada en vista previa</span>
                    )}
                  </div>
                  <div className="text-cyan-300 flex items-center gap-2 overflow-x-auto">
                    <span className="text-slate-400 font-bold">Authorization:</span>
                    <span>
                      {authConfig.basic?.username || authConfig.basic?.password ? (
                        showBasicPassword ? (
                          `Basic ${encodeBasicAuth(authConfig.basic.username || '', authConfig.basic.password || '')}`
                        ) : isVariableReference(authConfig.basic.password || '') ? (
                          `Basic <base64(${authConfig.basic.username || 'usuario'}:${authConfig.basic.password})>`
                        ) : (
                          `Basic <base64(${authConfig.basic.username || 'usuario'}:••••••••)>`
                        )
                      ) : (
                        '<Basic base64(usuario:contraseña)>'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {authConfig.type === 'apikey' && (
              <div className="space-y-4 p-4 rounded-lg bg-[#070b16] border border-cyan-500/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <label className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Nombre / Clave (Key Name):</span>
                      </label>
                      <span className="text-[10px] text-slate-400">ej: X-API-Key</span>
                    </div>
                    <input
                      type="text"
                      value={authConfig.apiKey?.key || ''}
                      onChange={(e) =>
                        setAuthConfig((prev) => ({
                          ...prev,
                          apiKey: {
                            key: e.target.value,
                            value: prev.apiKey?.value || '',
                            addTo: prev.apiKey?.addTo || 'header',
                          },
                        }))
                      }
                      placeholder="X-API-Key o api_key"
                      className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-slate-800 focus:border-cyan-400 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <label className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Valor (Value):</span>
                      </label>
                      <span className="text-[10px] text-slate-400">Admite {'{{API_KEY}}'}</span>
                    </div>
                    <input
                      type="text"
                      value={authConfig.apiKey?.value || ''}
                      onChange={(e) =>
                        setAuthConfig((prev) => ({
                          ...prev,
                          apiKey: {
                            key: prev.apiKey?.key || 'X-API-Key',
                            value: e.target.value,
                            addTo: prev.apiKey?.addTo || 'header',
                          },
                        }))
                      }
                      placeholder="hunter_live_key_xxx o {{API_KEY}}"
                      className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-slate-800 focus:border-cyan-400 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Selector Añadir a (Add to) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 font-bold block">
                    Añadir a (Add To):
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAuthConfig((prev) => ({
                          ...prev,
                          apiKey: {
                            key: prev.apiKey?.key || 'X-API-Key',
                            value: prev.apiKey?.value || '',
                            addTo: 'header',
                          },
                        }))
                      }
                      className={`flex-1 py-2 px-3 rounded-lg border text-xs font-mono transition flex items-center justify-center gap-2 ${
                        authConfig.apiKey?.addTo === 'header'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                          : 'bg-[#050811] border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>Encabezado HTTP (Header)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setAuthConfig((prev) => ({
                          ...prev,
                          apiKey: {
                            key: prev.apiKey?.key || 'api_key',
                            value: prev.apiKey?.value || '',
                            addTo: 'query',
                          },
                        }))
                      }
                      className={`flex-1 py-2 px-3 rounded-lg border text-xs font-mono transition flex items-center justify-center gap-2 ${
                        authConfig.apiKey?.addTo === 'query'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                          : 'bg-[#050811] border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>Parámetro de consulta (Query Params)</span>
                    </button>
                  </div>
                </div>

                {/* Previsualización en tiempo real de API Key */}
                <div className="p-3 rounded-lg bg-black/40 border border-slate-800/80 text-[11px] font-mono space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    // Inyección activa en {authConfig.apiKey?.addTo === 'query' ? 'Parámetros de Consulta (URL)' : 'Encabezados HTTP'}:
                  </div>
                  <div className="text-cyan-300 flex items-center gap-2 overflow-x-auto">
                    {authConfig.apiKey?.addTo === 'query' ? (
                      <>
                        <span className="text-slate-400 font-bold">Query:</span>
                        <span>?{authConfig.apiKey.key || 'key'}={authConfig.apiKey.value || '[VALOR]'}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-400 font-bold">{authConfig.apiKey?.key || 'X-API-Key'}:</span>
                        <span>{authConfig.apiKey?.value || '[VALOR]'}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contenido de Pestaña: Cuerpo JSON */}
        {activeRequestTab === 'body' && (
          <div className="p-4 space-y-3">
            {method === 'GET' ? (
              <div className="p-4 rounded-lg bg-[#070b16] border border-slate-800 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                  <FileText className="h-4 w-4" />
                  <span>MÉTODO GET: CUERPO DE SOLICITUD DESHABILITADO</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Según el estándar HTTP (RFC 7231), las solicitudes <code className="text-cyan-300 font-bold">GET</code> se utilizan exclusivamente para consultar recursos remotos sin enviar carga útil en el cuerpo.
                </p>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Para enviar parámetros de consulta, utiliza la pestaña <code className="text-cyan-300 font-bold">PARÁMETROS</code>. Si necesitas enviar un cuerpo estructurado en JSON, selecciona en el selector superior <code className="text-indigo-300 font-bold">POST</code>, <code className="text-amber-300 font-bold">PUT</code> o <code className="text-purple-300 font-bold">PATCH</code>.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-[11px] text-cyan-400/80">
                    // Payload JSON para método {method}
                  </span>
                  <div className="flex items-center gap-2">
                    {jsonSyntaxError ? (
                      <span className="text-[11px] font-mono text-rose-400 flex items-center gap-1 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Sintaxis Inválida: {jsonSyntaxError}</span>
                      </span>
                    ) : bodyText.trim() ? (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>JSON Válido</span>
                      </span>
                    ) : null}
                    <button
                      onClick={formatJson}
                      disabled={!bodyText.trim() || !!jsonSyntaxError}
                      className="px-2.5 py-1 rounded text-xs font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 disabled:opacity-40"
                    >
                      <Sparkles className="h-3 w-3 text-cyan-400" />
                      <span>FORMATEAR</span>
                    </button>
                  </div>
                </div>

                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={8}
                  placeholder={'{\n  "nombre": "{{USER_NAME}}",\n  "activo": true\n}'}
                  className="w-full p-3 rounded-lg bg-[#050811] border border-slate-800 focus:border-cyan-400 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none leading-relaxed resize-y"
                />
              </>
            )}
          </div>
        )}

        {/* Contenido de Pestaña: Configuración y Límites */}
        {activeRequestTab === 'config' && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <label className="text-slate-400 flex items-center justify-between">
                <span>Tiempo Límite (Timeout):</span>
                <span className="text-cyan-400 font-bold">{timeoutMs} ms</span>
              </label>
              <input
                type="range"
                min="500"
                max="30000"
                step="500"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <span className="text-[10px] text-slate-500">Mínimo: 100 ms | Máximo: 30 000 ms</span>
            </div>

            <div className="space-y-1.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <label className="text-slate-400 flex items-center justify-between">
                <span>Límite de Redirecciones:</span>
                <span className="text-cyan-400 font-bold">{maxRedirects}</span>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={maxRedirects}
                onChange={(e) => setMaxRedirects(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <span className="text-[10px] text-slate-500">0 desactiva redirecciones automáticas</span>
            </div>
          </div>
        )}
      </div>

      {/* Panel Holográfico de Respuesta */}
      <div className="rounded-xl holo-panel overflow-hidden space-y-0">
        {/* Barra de Estado de la Respuesta */}
        <div className="p-4 bg-[#070b16] border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-cyan-400" />
              INFORME DE RESPUESTA
            </span>

            {/* Código de Estado HTTP */}
            {executionResult && (
              <>
                {executionResult.success && executionResult.response ? (
                  <div
                    className={`px-3 py-1 rounded text-xs font-mono font-black flex items-center gap-1.5 border ${
                      executionResult.response.status >= 200 && executionResult.response.status < 300
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(52,211,153,0.3)]'
                        : executionResult.response.status >= 400 && executionResult.response.status < 500
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    <span>{executionResult.response.status}</span>
                    <span>{executionResult.response.statusText || 'HTTP'}</span>
                  </div>
                ) : (
                  <div className="px-3 py-1 rounded text-xs font-mono font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>{executionResult.error?.code || 'FALLO'}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Métricas de Latencia y Tamaño */}
          {executionResult && (
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-cyan-300">{executionResult.timing.durationMs} ms</span>
              </div>
              {executionResult.response && (
                <>
                  <div>
                    <span>TAMAÑO: </span>
                    <span className="text-slate-200">
                      {(executionResult.response.sizeBytes / 1024).toFixed(2)} KB
                    </span>
                  </div>
                  <div>
                    <span>SALTOS: </span>
                    <span className="text-slate-200">{executionResult.response.redirectsCount}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Pestañas del Panel de Respuesta */}
        {executionResult && (
          <div className="flex border-b border-cyan-500/20 bg-[#070b16]/60 px-4 justify-between items-center">
            <div className="flex">
              <button
                onClick={() => setActiveResponseTab('body')}
                className={`px-4 py-2.5 text-xs font-mono font-bold transition ${
                  activeResponseTab === 'body'
                    ? 'text-cyan-300 border-b-2 border-cyan-400 -mb-px'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                CUERPO DE RESPUESTA
              </button>

              <button
                onClick={() => setActiveResponseTab('headers')}
                className={`px-4 py-2.5 text-xs font-mono font-bold transition ${
                  activeResponseTab === 'headers'
                    ? 'text-cyan-300 border-b-2 border-cyan-400 -mb-px'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ENCABEZADOS (
                {executionResult.response ? Object.keys(executionResult.response.headers).length : 0}
                )
              </button>

              <button
                onClick={() => setActiveResponseTab('raw')}
                className={`px-4 py-2.5 text-xs font-mono font-bold transition ${
                  activeResponseTab === 'raw'
                    ? 'text-cyan-300 border-b-2 border-cyan-400 -mb-px'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                CONTRATO JSON PURO
              </button>
            </div>

            <button
              onClick={() => {
                const text =
                  activeResponseTab === 'body'
                    ? executionResult.response?.body || ''
                    : activeResponseTab === 'headers'
                    ? JSON.stringify(executionResult.response?.headers, null, 2)
                    : JSON.stringify(executionResult, null, 2);
                copyToClipboard(text);
              }}
              className="px-2.5 py-1 rounded text-[11px] font-mono bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">COPIADO</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>COPIAR</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Visor de Respuesta */}
        <div className="p-4">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="relative inline-flex">
                <span className="h-10 w-10 rounded-full bg-cyan-500/20 animate-ping absolute" />
                <RotateCw className="h-10 w-10 text-cyan-400 animate-spin relative" />
              </div>
              <div className="font-mono text-xs text-cyan-300 uppercase tracking-widest">
                // CONECTANDO CON EL DESTINO Y EVALUANDO BARRERAS DE RED...
              </div>
            </div>
          ) : !executionResult ? (
            <div className="py-16 text-center text-slate-500 font-mono text-xs space-y-2">
              <Crosshair className="h-8 w-8 text-cyan-500/30 mx-auto" />
              <div>// SISTEMA EN ESPERA: CONFIGURA LA URL Y DISPARA LA MISIÓN</div>
            </div>
          ) : !executionResult.success ? (
            /* Visualización de Error / Bloqueo SSRF / Timeout */
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/40 space-y-3">
              <div className="flex items-center gap-2 text-rose-300 font-bold font-mono text-sm">
                <ShieldAlert className="h-5 w-5 text-rose-400" />
                <span>MISIÓN ABORTADA POR POLÍTICA DE SEGURIDAD O RED</span>
              </div>
              <p className="text-xs font-mono text-rose-200/90 leading-relaxed">
                {executionResult.error?.message}
              </p>
              <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-rose-900/40 flex items-center justify-between">
                <span>CÓDIGO DE FALLO:</span>
                <span className="px-2 py-0.5 rounded bg-rose-900/40 text-rose-300 font-bold">
                  {executionResult.error?.code}
                </span>
              </div>
            </div>
          ) : activeResponseTab === 'body' ? (
            /* Cuerpo de la Respuesta */
            <div>
              <pre className="p-4 rounded-lg bg-[#050811] border border-cyan-950 text-cyan-300 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed">
                {executionResult.response?.data
                  ? JSON.stringify(executionResult.response.data, null, 2)
                  : executionResult.response?.body || '// Respuesta con cuerpo vacío.'}
              </pre>
            </div>
          ) : activeResponseTab === 'headers' ? (
            /* Tabla de Encabezados de Respuesta */
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#050811] text-cyan-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">ENCABEZADO</th>
                    <th className="py-2.5 px-4 font-bold">VALOR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-[#070b16]">
                  {executionResult.response &&
                    Object.entries(executionResult.response.headers).map(([k, v]) => (
                      <tr key={k} className="hover:bg-cyan-950/20 transition">
                        <td className="py-2 px-4 text-cyan-300 font-semibold">{k}</td>
                        <td className="py-2 px-4 text-slate-300 break-all">{v}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Contrato JSON Completo */
            <pre className="p-4 rounded-lg bg-[#050811] border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-96">
              {JSON.stringify(executionResult, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
