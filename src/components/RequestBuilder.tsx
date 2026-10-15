/**
 * API Forge - Consola del Request Builder (Fase 1B)
 * Interfaz de composición y ejecución de solicitudes HTTP con estética de Solo Leveling.
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Clock,
  Layers,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCw,
  Crosshair,
} from 'lucide-react';
import type {
  HttpMethod,
  ExecuteRequestPayload,
  ExecuteRequestResult,
} from '../../packages/shared/types.ts';
import type { KeyValueItem } from '../types/hunter.ts';
import { playSound } from '../services/audioService.ts';
import { hasProtectedSecrets } from '../services/historySecurityService.ts';

interface RequestBuilderProps {
  initialPayload?: ExecuteRequestPayload | null;
  onExecuted?: (payload: ExecuteRequestPayload, result: ExecuteRequestResult) => void;
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
];

export function RequestBuilder({ initialPayload, onExecuted }: RequestBuilderProps) {
  // Estado de configuración de solicitud
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState<string>('https://jsonplaceholder.typicode.com/posts/1');
  const [activeRequestTab, setActiveRequestTab] = useState<'params' | 'headers' | 'body' | 'config'>('params');

  // Parámetros de consulta y encabezados
  const [queryParams, setQueryParams] = useState<KeyValueItem[]>([
    { id: '1', key: '', value: '', enabled: true },
  ]);
  const [headers, setHeaders] = useState<KeyValueItem[]>([
    { id: '1', key: 'Accept', value: 'application/json', enabled: true },
  ]);

  // Cuerpo y configuración
  const [bodyText, setBodyText] = useState<string>('');
  const [timeoutMs, setTimeoutMs] = useState<number>(10000);
  const [maxRedirects, setMaxRedirects] = useState<number>(5);

  // Estado de ejecución
  const [loading, setLoading] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<ExecuteRequestResult | null>(null);
  const [activeResponseTab, setActiveResponseTab] = useState<'body' | 'headers' | 'raw'>('body');
  const [copied, setCopied] = useState<boolean>(false);
  const [jsonSyntaxError, setJsonSyntaxError] = useState<string | null>(null);
  const [hasProtectedValuesWarning, setHasProtectedValuesWarning] = useState<boolean>(false);

  // AbortController para cancelación en vuelo
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cargar carga inicial si proviene del historial
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

    // 3. Procesar cuerpo si el método lo permite
    let parsedBody: string | object | null = null;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        parsedBody = bodyText;
      }
    }

    const payload: ExecuteRequestPayload = {
      url: url.trim(),
      method,
      queryParams: Object.keys(cleanParams).length > 0 ? cleanParams : undefined,
      headers: Object.keys(cleanHeaders).length > 0 ? cleanHeaders : undefined,
      body: parsedBody,
      timeoutMs,
      maxRedirects,
    };

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
        body: JSON.stringify(payload),
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
        const netErrorResult: ExecuteRequestResult = {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: err instanceof Error ? err.message : 'Error de comunicación con el backend.',
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

  const applyPreset = (preset: typeof MISSION_PRESETS[0]) => {
    setMethod(preset.method);
    setUrl(preset.url);
    if (preset.body) {
      setBodyText(preset.body);
      setActiveRequestTab('body');
    }
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

        {/* Acceso rápido a misiones de prueba */}
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
      <div className="p-3 sm:p-4 rounded-xl holo-panel space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
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
            <button
              onClick={handleExecute}
              disabled={!url.trim()}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 border border-cyan-400/50 text-slate-950 font-mono text-xs font-black tracking-wider transition flex items-center justify-center gap-2 cyan-glow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-3.5 w-3.5 fill-slate-950" />
              <span>DISPARAR MISIÓN</span>
            </button>
          )}
        </div>
      </div>

      {/* Panel de Configuración de la Solicitud (Pestañas: Params, Headers, Body, Config) */}
      <div className="rounded-xl holo-panel overflow-hidden">
        {/* Cabecera de Pestañas */}
        <div className="flex border-b border-cyan-500/20 bg-[#070b16]/70 px-4">
          <button
            onClick={() => setActiveRequestTab('params')}
            className={`px-4 py-3 text-xs font-mono font-bold transition flex items-center gap-2 relative ${
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
            className={`px-4 py-3 text-xs font-mono font-bold transition flex items-center gap-2 relative ${
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
            onClick={() => setActiveRequestTab('body')}
            className={`px-4 py-3 text-xs font-mono font-bold transition flex items-center gap-2 relative ${
              activeRequestTab === 'body'
                ? 'text-cyan-300 border-b-2 border-cyan-400 -mb-px'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>CUERPO (JSON)</span>
            {bodyText.trim() && (
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
            )}
          </button>

          <button
            onClick={() => setActiveRequestTab('config')}
            className={`px-4 py-3 text-xs font-mono font-bold transition flex items-center gap-2 relative ${
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
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px] text-cyan-400/80">// Query Parameters</span>
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
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 h-4 w-4"
                  />
                  <input
                    type="text"
                    value={p.key}
                    onChange={(e) => updateParam(p.id, 'key', e.target.value)}
                    placeholder="Clave (ej. page)"
                    className="flex-1 px-3 py-1.5 rounded bg-[#050811] border border-slate-800 focus:border-cyan-500 text-xs font-mono text-slate-200 placeholder:text-slate-600"
                  />
                  <input
                    type="text"
                    value={p.value}
                    onChange={(e) => updateParam(p.id, 'value', e.target.value)}
                    placeholder="Valor (ej. 2)"
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
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px] text-cyan-400/80">// Custom Headers (RFC 7230)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHeaders((prev) => [...prev, { id: String(Date.now()), key: 'Content-Type', value: 'application/json', enabled: true }])}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-300"
                >
                  + Content-Type
                </button>
                <button
                  onClick={addHeader}
                  className="px-2.5 py-1 rounded text-xs font-mono bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 flex items-center gap-1 transition"
                >
                  <Plus className="h-3 w-3" />
                  <span>AÑADIR ENCABEZADO</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {headers.map((h) => (
                <div key={h.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={(e) => updateHeader(h.id, 'enabled', e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 h-4 w-4"
                  />
                  <input
                    type="text"
                    value={h.key}
                    onChange={(e) => updateHeader(h.id, 'key', e.target.value)}
                    placeholder="Encabezado (ej. Authorization)"
                    className="flex-1 px-3 py-1.5 rounded bg-[#050811] border border-slate-800 focus:border-cyan-500 text-xs font-mono text-slate-200 placeholder:text-slate-600"
                  />
                  <input
                    type="text"
                    value={h.value}
                    onChange={(e) => updateHeader(h.id, 'value', e.target.value)}
                    placeholder="Valor (ej. Bearer secreto_123)"
                    className="flex-1 px-3 py-1.5 rounded bg-[#050811] border border-slate-800 focus:border-cyan-500 text-xs font-mono text-slate-200 placeholder:text-slate-600"
                  />
                  <button
                    onClick={() => removeHeader(h.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                    title="Eliminar encabezado"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contenido de Pestaña: Cuerpo JSON */}
        {activeRequestTab === 'body' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-cyan-400/80">
                // Payload JSON ({method === 'GET' ? 'No aplica en método GET' : 'Activo'})
              </span>
              <div className="flex items-center gap-2">
                {jsonSyntaxError ? (
                  <span className="text-[11px] font-mono text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Error de Sintaxis JSON</span>
                  </span>
                ) : bodyText.trim() ? (
                  <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
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
              disabled={method === 'GET'}
              rows={8}
              placeholder={
                method === 'GET'
                  ? '// Los métodos GET no suelen admitir cuerpo en peticiones HTTP.'
                  : '{\n  "clave": "valor",\n  "numero": 100\n}'
              }
              className="w-full p-3 rounded-lg bg-[#050811] border border-slate-800 focus:border-cyan-400 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none leading-relaxed resize-y disabled:opacity-40"
            />
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
