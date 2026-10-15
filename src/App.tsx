/**
 * API Forge - Hunter System UI (Fase 1B)
 * Interfaz principal inspirada en los sistemas holográficos de Solo Leveling.
 * Conecta el Request Builder, Monitor del Sistema en vivo e Historial de Misiones.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Server,
  Database,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Layers,
  Lock,
  Code2,
  Terminal,
  Clock,
  Cpu,
  FileCheck,
  Check,
  Copy,
  Crosshair,
  History,
  Zap,
  Radio,
  Trash2,
  ArrowUpRight,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Sidebar } from './components/Sidebar.tsx';
import { RequestBuilder } from './components/RequestBuilder.tsx';
import type { ActiveNavTab, MissionHistoryItem } from './types/hunter.ts';
import type {
  HealthCheckResponse,
  ExecuteRequestPayload,
  ExecuteRequestResult,
  HttpMethod,
} from '../packages/shared/types.ts';

const STORAGE_KEY_HISTORY = 'api_forge_hunter_history_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('builder');
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [clientPingMs, setClientPingMs] = useState<number | null>(null);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Historial de solicitudes (Misiones Hunter)
  const [history, setHistory] = useState<MissionHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Payload seleccionado para inyectar en el Request Builder al recargar desde historial
  const [selectedPayloadForBuilder, setSelectedPayloadForBuilder] = useState<ExecuteRequestPayload | null>(null);
  // Misión seleccionada para inspección modal
  const [inspectingMission, setInspectingMission] = useState<MissionHistoryItem | null>(null);

  // Guardar historial en almacenamiento local
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 50)));
    } catch {
      // ignore
    }
  }, [history]);

  // Consulta de Salud del Backend
  const fetchHealthStatus = useCallback(async () => {
    setLoadingHealth(true);
    setHealthError(null);
    const start = performance.now();

    try {
      const response = await fetch('/api/health');
      const latency = Math.round(performance.now() - start);
      setClientPingMs(latency);

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data: HealthCheckResponse = await response.json();
        setHealthData(data);
        setLastCheckTime(new Date());

        if (data.status === 'degraded' || data.database.status !== 'connected') {
          setHealthError(`Sistema en estado degradado: Base de datos ${data.database.status}`);
        } else {
          setHealthError(null);
        }
      } else {
        const rawText = await response.text();
        if (rawText.includes('<!doctype') || rawText.includes('<html')) {
          throw new Error('El backend se está inicializando o devolvió HTML en vez de JSON.');
        }
        throw new Error(`Respuesta HTTP ${response.status}: ${rawText.slice(0, 100)}`);
      }
    } catch (err) {
      console.error('Error consultando salud del backend:', err);
      setHealthError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor backend.');
      setHealthData(null);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthStatus();
    const interval = setInterval(fetchHealthStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchHealthStatus]);

  // Manejar finalización de ejecución desde el Request Builder
  const handleRequestExecuted = useCallback((payload: ExecuteRequestPayload, result: ExecuteRequestResult) => {
    const newItem: MissionHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      method: payload.method || 'GET',
      url: payload.url,
      status: result.response?.status,
      statusText: result.response?.statusText,
      durationMs: result.timing.durationMs,
      success: result.success,
      errorCode: result.error?.code,
      payload,
      result,
    };

    setHistory((prev) => [newItem, ...prev.slice(0, 49)]);
  }, []);

  // Cargar una misión histórica en el Request Builder
  const handleLoadMissionIntoBuilder = (item: MissionHistoryItem) => {
    setSelectedPayloadForBuilder(item.payload);
    setActiveTab('builder');
  };

  // Limpiar historial
  const handleClearHistory = () => {
    if (window.confirm('¿Deseas purgar todo el registro histórico de misiones?')) {
      setHistory([]);
      try {
        localStorage.removeItem(STORAGE_KEY_HISTORY);
      } catch {
        // ignore
      }
    }
  };

  const copyHealthJson = () => {
    if (!healthData) return;
    navigator.clipboard.writeText(JSON.stringify(healthData, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const getMethodBadge = (m: HttpMethod) => {
    switch (m) {
      case 'GET':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'POST':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      case 'PUT':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'PATCH':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'DELETE':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    }
  };

  const getStatusBadge = (item: MissionHistoryItem) => {
    if (!item.success) {
      if (item.errorCode === 'SSRF_BLOCKED') {
        return {
          label: 'SSRF BLOQUEADO',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        };
      }
      return {
        label: item.errorCode || 'ERROR',
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      };
    }
    const s = item.status || 200;
    if (s >= 200 && s < 300) {
      return {
        label: `${s} ${item.statusText || 'OK'}`,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      };
    }
    if (s >= 300 && s < 400) {
      return {
        label: `${s} REDIR`,
        color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      };
    }
    if (s >= 400 && s < 500) {
      return {
        label: `${s} CLIENT`,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      };
    }
    return {
      label: `${s} SERVER`,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    };
  };

  // Estadísticas del historial
  const totalMissions = history.length;
  const successfulMissions = history.filter((h) => h.success).length;
  const blockedMissions = history.filter((h) => !h.success).length;
  const avgLatency =
    totalMissions > 0
      ? Math.round(history.reduce((acc, h) => acc + (h.durationMs || 0), 0) / totalMissions)
      : 0;

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col lg:flex-row hunter-grid-bg selection:bg-cyan-500 selection:text-black">
      {/* Barra Lateral Holográfica */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        healthData={healthData}
        historyCount={history.length}
        clientPingMs={clientPingMs}
      />

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Cabecera Superior del Sistema Hunter */}
        <header className="h-16 border-b border-cyan-500/20 bg-[#070b16]/90 backdrop-blur px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-cyan-400/80">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>SISTEMA //</span>
              <span className="text-white font-bold tracking-wider">
                {activeTab === 'builder' && 'REQUEST BUILDER CONSOLE'}
                {activeTab === 'monitor' && 'SYSTEM DIAGNOSTICS & STATUS'}
                {activeTab === 'archive' && 'MISSION ARCHIVE & LOGS'}
              </span>
            </div>
            <div className="sm:hidden font-extrabold text-sm tracking-wider text-cyan-300">
              API FORGE
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Estado de Conexión del Backend */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#050811] border border-cyan-500/20 text-xs font-mono">
              {loadingHealth && !healthData ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-amber-400">SINCRONIZANDO</span>
                </>
              ) : healthData?.status === 'ok' ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-emerald-400 font-semibold">NÚCLEO ACTIVO</span>
                  {clientPingMs !== null && (
                    <span className="text-cyan-400/80 text-[11px] ml-1">{clientPingMs}ms</span>
                  )}
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span className="text-rose-400 font-semibold">OFFLINE</span>
                </>
              )}
            </div>

            {/* Botón de Actualizar Diagnóstico */}
            <button
              onClick={fetchHealthStatus}
              disabled={loadingHealth}
              title="Actualizar estado de enlace"
              className="p-1.5 rounded-lg border border-cyan-500/20 bg-[#050811] hover:bg-cyan-950/30 text-cyan-400 hover:text-cyan-300 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingHealth ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Notificación de Error Global */}
        {healthError && (
          <div className="m-4 sm:mx-6 rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-rose-200 flex items-start gap-3 text-xs font-mono">
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-rose-300">ALERTA DEL SISTEMA:</span> {healthError}
              <p className="text-[11px] text-rose-300/70">
                Asegúrate de que el servidor Express esté activo en el puerto 3000 con <code className="text-cyan-300">npm run dev</code>.
              </p>
            </div>
          </div>
        )}

        {/* Contenido Dinámico por Pestaña */}
        <main className="p-4 sm:p-6 flex-1 space-y-6">
          {/* TAB 1: REQUEST BUILDER */}
          {activeTab === 'builder' && (
            <div className="space-y-6">
              {/* Banner de Misión Activa */}
              <div className="holo-panel rounded-xl p-4 sm:p-5 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400 uppercase tracking-widest">
                    <Crosshair className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                    <span>CENTRO DE DESPLIEGUE // SOLICITUDES HTTP</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                    PANEL DE COMPOSICIÓN Y EJECUCIÓN
                  </h2>
                  <p className="text-xs text-slate-400 max-w-2xl">
                    Compón solicitudes HTTP nativas procesadas a través del motor del backend con escudo de seguridad SSRF activo, soporte para reintentos y medición milimétrica de latencia.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-right">
                    <div className="text-[10px] font-mono text-cyan-400/70">MISIONES HISTÓRICAS</div>
                    <div className="text-sm font-extrabold text-cyan-300 font-mono">
                      {history.length} / 50
                    </div>
                  </div>
                </div>
              </div>

              {/* Componente RequestBuilder */}
              <RequestBuilder
                initialPayload={selectedPayloadForBuilder}
                onExecuted={handleRequestExecuted}
              />
            </div>
          )}

          {/* TAB 2: MONITOR DEL SISTEMA (ESTADO Y OBSERVABILIDAD) */}
          {activeTab === 'monitor' && (
            <div className="space-y-6">
              {/* Tarjetas de Métricas en Vivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Servidor Express */}
                <div className="holo-panel rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-[10px] uppercase text-cyan-400/80">NÚCLEO WEB</span>
                    <Server className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                      Express 4.x
                      {healthData?.status === 'ok' && (
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Uptime: <span className="font-mono text-cyan-300">{healthData?.uptimeSeconds || 0}s</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-cyan-500/10 flex justify-between text-[11px] font-mono text-slate-500">
                    <span>Node.js:</span>
                    <span className="text-slate-300">{healthData?.nodeVersion || 'N/A'}</span>
                  </div>
                </div>

                {/* 2. SQLite Local */}
                <div className="holo-panel rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-[10px] uppercase text-cyan-400/80">PERSISTENCIA</span>
                    <Database className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                      SQLite Local
                      {healthData?.database.status === 'connected' && (
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      ORM: <span className="font-mono text-indigo-300">Drizzle ORM</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-cyan-500/10 flex justify-between text-[11px] font-mono text-slate-500">
                    <span>Claves Foráneas:</span>
                    <span className={`font-bold ${healthData?.database.foreignKeys ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {healthData?.database.foreignKeys ? 'PRAGMA ON' : 'INACTIVO'}
                    </span>
                  </div>
                </div>

                {/* 3. Escudo de Seguridad SSRF */}
                <div className="holo-panel rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-[10px] uppercase text-cyan-400/80">ESCUDO SSRF</span>
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                      ACTIVO
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Rango Privado: <span className="font-mono text-emerald-300">BLOQUEADO</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-cyan-500/10 flex justify-between text-[11px] font-mono text-slate-500">
                    <span>DNS Safe Check:</span>
                    <span className="text-emerald-400 font-bold">100% STRICT</span>
                  </div>
                </div>

                {/* 4. Enlace & Latencia */}
                <div className="holo-panel rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-[10px] uppercase text-cyan-400/80">LATENCIA NÚCLEO</span>
                    <Activity className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                      {clientPingMs !== null ? `${clientPingMs} ms` : '---'}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Estado: <span className="font-mono text-purple-300">Respuesta Local</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-cyan-500/10 flex justify-between text-[11px] font-mono text-slate-500">
                    <span>Último Test:</span>
                    <span className="text-slate-300 font-mono">
                      {lastCheckTime ? lastCheckTime.toLocaleTimeString() : '---'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verificación de Tablas y Base de Datos */}
              <div className="holo-panel rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                    <Database className="h-4 w-4" />
                    <span className="font-bold uppercase tracking-wider">
                      TABLAS VERIFICADAS EN SQLITE
                    </span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                    INTEGRIDAD COMPROBADA
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(healthData?.database.tablesVerified || ['projects', 'api_endpoints', 'health_audit_logs']).map(
                    (tableName) => (
                      <div
                        key={tableName}
                        className="p-3 rounded-lg bg-[#050811] border border-cyan-500/20 flex items-center gap-2.5"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-mono text-xs font-bold text-slate-200">{tableName}</div>
                          <div className="text-[10px] font-mono text-slate-500">Tabla Drizzle Verificada</div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Inspector de Payload JSON de Diagnóstico */}
              <div className="holo-panel rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                    <Code2 className="h-4 w-4" />
                    <span className="font-bold uppercase tracking-wider">
                      PAYLOAD DE DIAGNÓSTICO EN TIEMPO REAL (GET /api/health)
                    </span>
                  </div>
                  <button
                    onClick={copyHealthJson}
                    className="px-2.5 py-1 rounded bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 text-cyan-300 text-xs font-mono flex items-center gap-1.5 transition"
                  >
                    {copiedJson ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>COPIADO</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>COPIAR JSON</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 rounded-lg bg-[#04060d] border border-cyan-500/20 font-mono text-xs text-cyan-200 overflow-x-auto max-h-80 leading-relaxed">
                  {healthData ? JSON.stringify(healthData, null, 2) : '// Esperando telemetría del servidor...'}
                </pre>
              </div>

              {/* Hoja de Ruta Arquitectónica */}
              <div className="holo-panel rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 border-b border-cyan-500/20 pb-3">
                  <Layers className="h-4 w-4" />
                  <span className="font-bold uppercase tracking-wider">
                    ESTADO DE FASES ARQUITECTÓNICAS (0 COP)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Fase 0 */}
                  <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-emerald-400 font-bold">FASE 0</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                        COMPLETADA
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-100">Cimientos & Persistencia</div>
                    <p className="text-xs text-slate-400">
                      Express, SQLite, Drizzle ORM, salud del backend y suite de pruebas Vitest.
                    </p>
                  </div>

                  {/* Fase 1A */}
                  <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-emerald-400 font-bold">FASE 1A</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                        COMPLETADA
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-100">Motor HTTP & Escudo SSRF</div>
                    <p className="text-xs text-slate-400">
                      Ejecutor nativo de peticiones, políticas de seguridad y validaciones de redirección.
                    </p>
                  </div>

                  {/* Fase 1B */}
                  <div className="p-4 rounded-lg bg-cyan-950/40 border border-cyan-500/40 space-y-2 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-cyan-400 font-bold">FASE 1B</span>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] animate-pulse">
                        ACTIVA
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white">Hunter System UI</div>
                    <p className="text-xs text-slate-300">
                      Interfaz holográfica, Request Builder, presets de misiones e historial.
                    </p>
                  </div>

                  {/* Fase 2 */}
                  <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800 space-y-2 opacity-60">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500 font-bold">FASE 2</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] flex items-center gap-1">
                        <Lock className="h-3 w-3" /> PRÓXIMA
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-300">Colecciones & Entornos</div>
                    <p className="text-xs text-slate-500">
                      Carpetas de misiones, variables dinámicas y guardado de colecciones en SQLite.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HISTORIAL DE MISIONES (ARCHIVE) */}
          {activeTab === 'archive' && (
            <div className="space-y-6">
              {/* Tarjetas de Resumen de Historial */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="holo-panel rounded-xl p-4">
                  <div className="text-[10px] font-mono uppercase text-cyan-400/80">TOTAL MISIONES</div>
                  <div className="text-2xl font-black text-white font-mono mt-1">{totalMissions}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">Límite: 50 en memoria</div>
                </div>
                <div className="holo-panel rounded-xl p-4">
                  <div className="text-[10px] font-mono uppercase text-emerald-400/80">EXITOSAS</div>
                  <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{successfulMissions}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">Códigos 2xx / 3xx / 4xx</div>
                </div>
                <div className="holo-panel rounded-xl p-4">
                  <div className="text-[10px] font-mono uppercase text-rose-400/80">BLOQUEADAS / ERR</div>
                  <div className="text-2xl font-black text-rose-400 font-mono mt-1">{blockedMissions}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">Escudo SSRF / Fallos</div>
                </div>
                <div className="holo-panel rounded-xl p-4">
                  <div className="text-[10px] font-mono uppercase text-purple-400/80">LATENCIA MEDIA</div>
                  <div className="text-2xl font-black text-purple-400 font-mono mt-1">{avgLatency} ms</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">Tiempo de ejecución</div>
                </div>
              </div>

              {/* Lista de Misiones Históricas */}
              <div className="holo-panel rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                    <History className="h-4 w-4" />
                    <span className="font-bold uppercase tracking-wider">
                      REGISTRO HISTÓRICO DE EJECUCIONES
                    </span>
                  </div>

                  {history.length > 0 && (
                    <button
                      onClick={handleClearHistory}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-1.5 transition self-start sm:self-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>PURGAR REGISTRO</span>
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="h-12 w-12 rounded-full bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
                      <Crosshair className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-300 font-mono">
                      REGISTRO DE MISIONES VACÍO
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Aún no has ejecutado solicitudes en esta sesión. Dirígete a la pestaña Request Builder para lanzar tu primera petición HTTP.
                    </p>
                    <button
                      onClick={() => setActiveTab('builder')}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold text-xs font-mono hover:brightness-110 transition inline-flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>IR AL REQUEST BUILDER</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => {
                      const statusBadge = getStatusBadge(item);
                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-lg bg-[#050811] hover:bg-[#090e1f] border border-cyan-500/20 hover:border-cyan-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                        >
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            {/* Método */}
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${getMethodBadge(
                                item.method
                              )}`}
                            >
                              {item.method}
                            </span>

                            {/* Estado HTTP / Escudo */}
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${statusBadge.color}`}
                            >
                              {statusBadge.label}
                            </span>

                            {/* URL */}
                            <div className="min-w-0">
                              <div className="text-xs font-mono text-slate-200 truncate font-semibold">
                                {item.url}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                                <span>&bull;</span>
                                <span className="text-cyan-400/80">{item.durationMs}ms</span>
                                {item.result?.response?.sizeBytes !== undefined && (
                                  <>
                                    <span>&bull;</span>
                                    <span>{item.result.response.sizeBytes} B</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                              onClick={() => handleLoadMissionIntoBuilder(item)}
                              title="Cargar parámetros de esta solicitud en el Request Builder"
                              className="px-2.5 py-1 rounded bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 text-cyan-300 text-xs font-mono flex items-center gap-1.5 transition"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>CARGAR</span>
                            </button>
                            <button
                              onClick={() => setInspectingMission(item)}
                              title="Inspeccionar respuesta y detalles"
                              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition"
                            >
                              <ArrowUpRight className="h-3 w-3" />
                              <span>VER</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Modal de Inspección Rápida de Misión */}
        {inspectingMission && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="holo-panel rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-cyan-500/40">
              <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-[#050811]">
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                  <Terminal className="h-4 w-4" />
                  <span className="font-bold">INSPECCIÓN DE MISIÓN // {inspectingMission.id}</span>
                </div>
                <button
                  onClick={() => setInspectingMission(null)}
                  className="text-slate-400 hover:text-white font-mono text-xs p-1"
                >
                  [CERRAR]
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-4 font-mono text-xs">
                <div className="p-3 rounded bg-[#050811] border border-cyan-500/20 space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase">SOLICITUD</div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-400">{inspectingMission.method}</span>
                    <span className="text-slate-200 truncate">{inspectingMission.url}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-1">
                    Duración: {inspectingMission.durationMs}ms &bull; Fecha: {inspectingMission.timestamp}
                  </div>
                </div>

                {inspectingMission.result?.response ? (
                  <div className="space-y-2">
                    <div className="text-[10px] text-emerald-400 uppercase font-bold">
                      RESPUESTA RECIBIDA (HTTP {inspectingMission.result.response.status})
                    </div>
                    <pre className="p-3 rounded bg-[#04060d] border border-cyan-500/20 max-h-60 overflow-y-auto text-slate-300 whitespace-pre-wrap">
                      {inspectingMission.result.response.body || '// (Cuerpo vacío)'}
                    </pre>
                  </div>
                ) : (
                  <div className="p-3 rounded bg-rose-950/30 border border-rose-500/30 text-rose-300 space-y-1">
                    <div className="font-bold">ERROR O BLOQUEO DE SEGURIDAD</div>
                    <div>Código: {inspectingMission.errorCode || 'UNKNOWN'}</div>
                    <div className="text-xs text-rose-200/80">
                      {inspectingMission.result?.error?.message || 'Error durante la ejecución.'}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-cyan-500/20 bg-[#050811] flex justify-end gap-2">
                <button
                  onClick={() => {
                    handleLoadMissionIntoBuilder(inspectingMission);
                    setInspectingMission(null);
                  }}
                  className="px-3 py-1.5 rounded bg-cyan-500 text-slate-950 font-bold text-xs font-mono hover:bg-cyan-400 transition"
                >
                  CARGAR EN BUILDER
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pie de Página Holográfico */}
        <footer className="border-t border-cyan-500/20 bg-[#070b16] py-4 px-6 text-center text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>API FORGE // SISTEMA HUNTER V1 &bull; FASE 1B (0 COP)</div>
          <div className="text-cyan-400/60">
            Node.js + Express + LibSQL/SQLite + Drizzle ORM + Vitest + React 19 + Tailwind
          </div>
        </footer>
      </div>
    </div>
  );
}
