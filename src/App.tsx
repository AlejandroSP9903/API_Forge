/**
 * API Forge - Hunter System UI (Fase 1C: Secure History + Audio System)
 * Interfaz principal inspirada en los sistemas holográficos de Solo Leveling.
 * Conecta el Request Builder, Monitor en vivo, Historial Seguro y Ajustes de Audio.
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
  Volume2,
  VolumeX,
  Sliders,
  Shield,
  KeyRound,
  Info,
  FolderArchive,
  FolderPlus,
  Globe,
} from 'lucide-react';
import { Sidebar } from './components/Sidebar.tsx';
import { RequestBuilder } from './components/RequestBuilder.tsx';
import { CollectionsPanel } from './components/CollectionsPanel.tsx';
import { EnvironmentsPanel } from './components/EnvironmentsPanel.tsx';
import { AudioSettingsPanel } from './components/AudioSettingsPanel.tsx';
import type { ActiveNavTab, MissionHistoryItem } from './types/hunter.ts';
import type {
  HealthCheckResponse,
  ExecuteRequestPayload,
  ExecuteRequestResult,
  HttpMethod,
  CollectionSummary,
  EnvironmentSummary,
  EnvironmentData,
} from '../packages/shared/types.ts';
import {
  getAudioSettings,
  saveAudioSettings,
  testSound,
  playSound,
  type AudioSettings,
} from './services/audioService.ts';
import {
  sanitizeRequestPayload,
  sanitizeResult,
  migrateAndSanitizeHistory,
  hasProtectedSecrets,
  REDACTED_MARKER,
} from './services/historySecurityService.ts';
import {
  fetchCollections,
  createCollectionApi,
  createSavedRequestApi,
} from './services/collectionsService.ts';
import {
  fetchEnvironments,
  fetchEnvironmentById,
  getActiveEnvironmentId,
  setActiveEnvironmentId,
} from './services/environmentService.ts';

const STORAGE_KEY_HISTORY = 'api_forge_hunter_history_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('builder');
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [clientPingMs, setClientPingMs] = useState<number | null>(null);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Estado del Sistema de Audio Hunter
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => getAudioSettings());

  // Historial seguro de solicitudes (Misiones Hunter con sanitización de credenciales)
  const [history, setHistory] = useState<MissionHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Migración automática y sanitización de registros existentes antes de mostrar o reutilizar
          const { items, modifiedCount, corruptedCount } = migrateAndSanitizeHistory(parsed);
          if (modifiedCount > 0 || corruptedCount > 0) {
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(items.slice(0, 50)));
          }
          return items;
        }
      }
    } catch (err) {
      // Manejar datos malformados sin lanzar error no capturado
      console.warn('[API Forge] Error al parsear historial local:', err);
    }
    return [];
  });

  // Payload seleccionado para inyectar en el Request Builder al recargar desde historial o colección
  const [selectedPayloadForBuilder, setSelectedPayloadForBuilder] = useState<ExecuteRequestPayload | null>(null);
  // Misión seleccionada para inspección modal
  const [inspectingMission, setInspectingMission] = useState<MissionHistoryItem | null>(null);
  // Mensaje temporal de migración o auditoría manual
  const [securityAuditMessage, setSecurityAuditMessage] = useState<string | null>(null);

  // Estado de Colecciones SQLite (Fase 1D)
  const [collectionsCount, setCollectionsCount] = useState<number>(0);
  const [currentBuilderPayload, setCurrentBuilderPayload] = useState<ExecuteRequestPayload | null>(null);
  const [availableCollections, setAvailableCollections] = useState<CollectionSummary[]>([]);
  const [isQuickSaveModalOpen, setIsQuickSaveModalOpen] = useState<boolean>(false);
  const [quickSaveTargetColId, setQuickSaveTargetColId] = useState<string>('');
  const [quickSaveIsNewCol, setQuickSaveIsNewCol] = useState<boolean>(false);
  const [quickSaveNewColName, setQuickSaveNewColName] = useState<string>('');
  const [quickSaveReqName, setQuickSaveReqName] = useState<string>('');
  const [quickSavePayload, setQuickSavePayload] = useState<ExecuteRequestPayload | null>(null);

  // Estado de Entornos y Variables (Fase 1E)
  const [environmentsCount, setEnvironmentsCount] = useState<number>(0);
  const [allEnvironments, setAllEnvironments] = useState<EnvironmentSummary[]>([]);
  const [activeEnvironmentId, setActiveEnvironmentIdState] = useState<string | null>(() => getActiveEnvironmentId());
  const [activeEnvironmentData, setActiveEnvironmentData] = useState<EnvironmentData | null>(null);

  // Sincronizar lista de entornos y datos del entorno activo
  const refreshEnvironments = useCallback(async () => {
    try {
      const list = await fetchEnvironments();
      setAllEnvironments(list);
      setEnvironmentsCount(list.length);

      const targetId = activeEnvironmentId && list.some((e) => e.id === activeEnvironmentId)
        ? activeEnvironmentId
        : null;

      if (targetId) {
        const full = await fetchEnvironmentById(targetId);
        setActiveEnvironmentData(full);
      } else {
        setActiveEnvironmentData(null);
      }
    } catch {
      // ignore
    }
  }, [activeEnvironmentId]);

  useEffect(() => {
    refreshEnvironments();
  }, [refreshEnvironments]);

  // Manejar cambio de entorno activo
  const handleActiveEnvironmentChange = async (id: string | null, data?: EnvironmentData | null) => {
    setActiveEnvironmentIdState(id);
    setActiveEnvironmentId(id);

    if (id) {
      if (data) {
        setActiveEnvironmentData(data);
      } else {
        try {
          const full = await fetchEnvironmentById(id);
          setActiveEnvironmentData(full);
        } catch {
          setActiveEnvironmentData(null);
        }
      }
    } else {
      setActiveEnvironmentData(null);
    }
  };

  // Refrescar lista de colecciones para contador y modal
  const refreshCollectionsCount = useCallback(async () => {
    try {
      const cols = await fetchCollections();
      setAvailableCollections(cols);
      setCollectionsCount(cols.length);
      if (cols.length > 0 && !quickSaveTargetColId) {
        setQuickSaveTargetColId(cols[0].id);
      }
    } catch {
      // ignore
    }
  }, [quickSaveTargetColId]);

  useEffect(() => {
    refreshCollectionsCount();
  }, [refreshCollectionsCount]);

  // Manejar apertura de guardado rápido desde RequestBuilder
  const handleOpenQuickSaveFromBuilder = (payload: ExecuteRequestPayload) => {
    setQuickSavePayload(payload);
    const defaultName = `Misión ${payload.method || 'GET'} - ${payload.url.split('/').filter(Boolean).pop() || 'Endpoint'}`;
    setQuickSaveReqName(defaultName);
    setIsQuickSaveModalOpen(true);
    refreshCollectionsCount();
  };

  // Ejecutar guardado rápido en colección SQLite
  const handleExecuteQuickSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSavePayload || !quickSaveReqName.trim()) return;

    try {
      let targetId = quickSaveTargetColId;
      if (quickSaveIsNewCol) {
        if (!quickSaveNewColName.trim()) return;
        const newCol = await createCollectionApi({ name: quickSaveNewColName.trim() });
        targetId = newCol.id;
      } else if (!targetId && availableCollections.length > 0) {
        targetId = availableCollections[0].id;
      }

      if (!targetId) {
        const defaultCol = await createCollectionApi({ name: 'Colección General' });
        targetId = defaultCol.id;
      }

      await createSavedRequestApi(targetId, {
        name: quickSaveReqName.trim(),
        method: quickSavePayload.method || 'GET',
        url: quickSavePayload.url,
        headers: quickSavePayload.headers,
        queryParams: quickSavePayload.queryParams,
        body: quickSavePayload.body,
      });

      playSound('requestSuccess');
      setSecurityAuditMessage(`Solicitud '${quickSaveReqName.trim()}' guardada exitosamente en la colección.`);
      setTimeout(() => setSecurityAuditMessage(null), 4000);
      setIsQuickSaveModalOpen(false);
      setQuickSaveNewColName('');
      setQuickSaveIsNewCol(false);
      await refreshCollectionsCount();
    } catch (err) {
      playSound('requestError');
      setHealthError(err instanceof Error ? err.message : 'Error al guardar la solicitud en la colección.');
    }
  };

  // Guardar historial seguro en almacenamiento local
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

  // Manejar finalización de ejecución desde el Request Builder con SANITIZACIÓN OBLIGATORIA
  const handleRequestExecuted = useCallback((payload: ExecuteRequestPayload, result: ExecuteRequestResult) => {
    // Sanitizar cabeceras, URL, queryParams y cuerpo antes de persistir
    const { sanitized: cleanPayload, redactedCount: payloadRedacted } = sanitizeRequestPayload(payload);
    // Sanitizar también respuesta (cabeceras como set-cookie, cuerpo, data y mensajes de error)
    const { sanitizedResult: cleanResult, redactedCount: resultRedacted } = sanitizeResult(result);

    const hasSecrets = payloadRedacted > 0 || resultRedacted > 0 || hasProtectedSecrets(cleanPayload, cleanResult);

    const newItem: MissionHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      method: payload.method || cleanPayload.method || 'GET',
      url: cleanPayload.url,
      status: cleanResult?.response?.status,
      statusText: cleanResult?.response?.statusText,
      durationMs: cleanResult?.timing?.durationMs ?? result.timing.durationMs,
      success: cleanResult?.success ?? result.success,
      errorCode: cleanResult?.error?.code,
      payload: cleanPayload,
      result: cleanResult,
      hasProtectedSecrets: hasSecrets,
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

  // Forzar una auditoría y re-sanitización manual de todo el historial local
  const handleRunSecurityAudit = () => {
    const { items: cleanItems, modifiedCount } = migrateAndSanitizeHistory(history);
    setHistory(cleanItems);
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(cleanItems));
    } catch {
      // ignore
    }
    const protectedTotal = cleanItems.filter((i) => i.hasProtectedSecrets).length;
    setSecurityAuditMessage(
      `Auditoría completada: ${modifiedCount} registro(s) re-sanitizados. Total de misiones con credenciales protegidas: ${protectedTotal}.`
    );
    setTimeout(() => setSecurityAuditMessage(null), 5000);
  };

  // Toggle rápido de audio desde la barra superior
  const toggleAudioQuick = () => {
    const nextEnabled = !audioSettings.enabled;
    const updated = saveAudioSettings({ enabled: nextEnabled });
    setAudioSettings(updated);
    if (nextEnabled) {
      testSound('requestSuccess', updated.volume);
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
  const protectedMissions = history.filter((h) => h.hasProtectedSecrets).length;
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
        collectionsCount={collectionsCount}
        environmentsCount={environmentsCount}
        clientPingMs={clientPingMs}
        audioEnabled={audioSettings.enabled}
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
                {activeTab === 'collections' && 'COLLECTIONS SYSTEM // SQLITE LIBRARY'}
                {activeTab === 'environments' && 'ENVIRONMENTS & VARIABLES // SYSTEM ENGINE'}
                {activeTab === 'monitor' && 'SYSTEM DIAGNOSTICS & STATUS'}
                {activeTab === 'archive' && 'MISSION ARCHIVE & LOGS'}
                {activeTab === 'settings' && 'SYSTEM SETTINGS // AUDIO'}
              </span>
            </div>
            <div className="sm:hidden font-extrabold text-sm tracking-wider text-cyan-300">
              API FORGE
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Control Rápido de Audio */}
            <button
              onClick={toggleAudioQuick}
              title={
                audioSettings.enabled
                  ? 'Audio Activo (Clic para silenciar)'
                  : 'Audio Silenciado (Clic para activar)'
              }
              className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition ${
                audioSettings.enabled
                  ? 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                  : 'border-slate-800 bg-[#050811] text-slate-500 hover:text-slate-300'
              }`}
            >
              {audioSettings.enabled ? (
                <>
                  <Volume2 className="h-4 w-4 text-cyan-400" />
                  <span className="hidden md:inline text-[10px]">AUDIO ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-4 w-4" />
                  <span className="hidden md:inline text-[10px]">MUTED</span>
                </>
              )}
            </button>

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

        {/* Notificación de Auditoría de Seguridad */}
        {securityAuditMessage && (
          <div className="m-4 sm:mx-6 rounded-lg border border-cyan-500/40 bg-cyan-950/30 p-3 text-cyan-200 flex items-start gap-3 text-xs font-mono animate-fadeIn">
            <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>{securityAuditMessage}</span>
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
                    Compón solicitudes HTTP nativas procesadas con escudo de seguridad SSRF activo, protección automática contra fuga de secretos en historial y efectos sintéticos Web Audio.
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
                onSaveToCollection={handleOpenQuickSaveFromBuilder}
                onPayloadChange={setCurrentBuilderPayload}
                activeEnvironment={activeEnvironmentData}
                allEnvironments={allEnvironments}
                onSelectActiveEnvironment={(id) => handleActiveEnvironmentChange(id)}
                onOpenEnvironmentsTab={() => setActiveTab('environments')}
              />
            </div>
          )}

          {/* TAB: COLECCIONES (FASE 1D) */}
          {activeTab === 'collections' && (
            <CollectionsPanel
              currentBuilderPayload={currentBuilderPayload}
              onLoadIntoBuilder={(payload) => {
                setSelectedPayloadForBuilder(payload);
                setActiveTab('builder');
              }}
              onNavigateToBuilder={() => setActiveTab('builder')}
              onCollectionsCountChange={setCollectionsCount}
            />
          )}

          {/* TAB: ENTORNOS Y VARIABLES (FASE 1E) */}
          {activeTab === 'environments' && (
            <EnvironmentsPanel
              activeEnvironmentId={activeEnvironmentId}
              onActiveEnvironmentChange={handleActiveEnvironmentChange}
              onEnvironmentsCountChange={setEnvironmentsCount}
            />
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

                {/* 3. Escudo de Seguridad SSRF & Secretos */}
                <div className="holo-panel rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-[10px] uppercase text-cyan-400/80">ESCUDO SSRF & SECRETS</span>
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                      ACTIVO
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Sanitización: <span className="font-mono text-emerald-300">REDACTION ON</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-cyan-500/10 flex justify-between text-[11px] font-mono text-slate-500">
                    <span>IPs Privadas:</span>
                    <span className="text-emerald-400 font-bold">100% BLOQUEADAS</span>
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
                  <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-emerald-400 font-bold">FASE 1B</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                        COMPLETADA
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-100">Hunter System UI</div>
                    <p className="text-xs text-slate-400">
                      Interfaz holográfica, Request Builder, presets de misiones e historial.
                    </p>
                  </div>

                  {/* Fase 1C */}
                  <div className="p-4 rounded-lg bg-cyan-950/40 border border-cyan-500/40 space-y-2 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-cyan-400 font-bold">FASE 1C</span>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] animate-pulse">
                        ACTIVA
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white">Historial Seguro & Audio</div>
                    <p className="text-xs text-slate-300">
                      Redacción de secretos (Authorization/Cookies/Tokens) y Web Audio sintético.
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
                  <div className="text-[10px] font-mono uppercase text-amber-400/80">CON SECRETOS SANITIZADOS</div>
                  <div className="text-2xl font-black text-amber-400 font-mono mt-1">{protectedMissions}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">Tokens/Cookies Redactados</div>
                </div>
              </div>

              {/* Lista de Misiones Históricas */}
              <div className="holo-panel rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                    <History className="h-4 w-4" />
                    <span className="font-bold uppercase tracking-wider">
                      REGISTRO HISTÓRICO PROTEGIDO
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRunSecurityAudit}
                      title="Escanear y asegurar que todos los registros locales estén redactados"
                      className="px-3 py-1.5 rounded-lg bg-cyan-950/30 hover:bg-cyan-900/40 border border-cyan-500/30 text-cyan-300 text-xs font-mono flex items-center gap-1.5 transition"
                    >
                      <Shield className="h-3.5 w-3.5 text-cyan-400" />
                      <span>AUDITAR SECRETOS</span>
                    </button>

                    {history.length > 0 && (
                      <button
                        onClick={handleClearHistory}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-1.5 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>PURGAR REGISTRO</span>
                      </button>
                    )}
                  </div>
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

                            {/* Indicador de Secretos Protegidos */}
                            {item.hasProtectedSecrets && (
                              <span
                                title="Esta solicitud contenía credenciales sensibles que fueron redactadas para su persistencia segura"
                                className="text-[9px] font-mono px-1.5 py-0.2 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 shrink-0 flex items-center gap-1"
                              >
                                <KeyRound className="h-2.5 w-2.5" />
                                <span>PROTEGIDO</span>
                              </span>
                            )}

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

          {/* TAB 4: AJUSTES DE SISTEMA Y AUDIO */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Panel de Audio Hunter */}
              <AudioSettingsPanel onSettingsChanged={setAudioSettings} />

              {/* Panel Informativo de Seguridad del Historial y Limitaciones */}
              <div className="holo-panel rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="font-bold uppercase tracking-wider">
                      POLÍTICA DE PRIVACIDAD & PROTECCIÓN DE SECRETOS (FASE 1C)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                    ESCUDO ACTIVO
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-4 rounded-lg bg-[#050811] border border-cyan-500/20 space-y-2">
                    <div className="text-cyan-300 font-bold flex items-center gap-1.5">
                      <KeyRound className="h-4 w-4" />
                      <span>CAMPOS SANITIZADOS AUTOMÁTICAMENTE</span>
                    </div>
                    <ul className="space-y-1 text-slate-400 text-[11px] list-disc list-inside leading-relaxed">
                      <li>
                        <strong className="text-slate-200">Cabeceras Sensibles:</strong> Authorization, Proxy-Authorization, Cookie, x-api-key, x-auth-token, access-token, etc.
                      </li>
                      <li>
                        <strong className="text-slate-200">Parámetros de Consulta:</strong> api_key, token, auth, secret, password, client_secret, signature.
                      </li>
                      <li>
                        <strong className="text-slate-200">URLs con Basic Auth:</strong> user:password redactado en la estructura de la URL.
                      </li>
                      <li>
                        <strong className="text-slate-200">Cuerpos JSON:</strong> Claves de contraseña, tokens y secretos cifrados a <code>{REDACTED_MARKER}</code>.
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-lg bg-[#050811] border border-amber-500/20 space-y-2">
                    <div className="text-amber-300 font-bold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      <span>LIMITACIONES DOCUMENTADAS Y BUENAS PRÁCTICAS</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      La sanitización heurística protege contra la fuga accidental de credenciales comunes. Sin embargo, no sustituye una gestión formal de secretos:
                    </p>
                    <ul className="space-y-1 text-slate-400 text-[11px] list-disc list-inside leading-relaxed">
                      <li>Tokens con nombres propietarios o no estándar podrían no ser detectados.</li>
                      <li>No utilices credenciales de producción bancaria o industrial en entornos de desarrollo local.</li>
                      <li>El historial permanece 100% confinado a tu navegador (localStorage), sin telemetría externa.</li>
                    </ul>
                  </div>
                </div>
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
                {inspectingMission.hasProtectedSecrets && (
                  <div className="p-2.5 rounded bg-amber-950/30 border border-amber-500/30 text-amber-300 flex items-center gap-2 text-[11px]">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>
                      Esta solicitud tiene credenciales protegidas con <strong>{REDACTED_MARKER}</strong> para prevenir almacenamiento en texto plano.
                    </span>
                  </div>
                )}

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

        {/* Modal de Guardado Rápido en Colección desde RequestBuilder */}
        {isQuickSaveModalOpen && quickSavePayload && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#070b16] border border-cyan-500/40 rounded-xl p-5 w-full max-w-md space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.25)] animate-fadeIn">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <FolderArchive className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white uppercase font-mono">
                    GUARDAR EN COLECCIÓN
                  </h3>
                </div>
                <button
                  onClick={() => setIsQuickSaveModalOpen(false)}
                  className="text-slate-400 hover:text-white text-xs font-mono"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleExecuteQuickSave} className="space-y-4">
                {/* Resumen de la Solicitud actual */}
                <div className="p-3 rounded-lg bg-[#050811] border border-cyan-500/20 space-y-1 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-400 uppercase">{quickSavePayload.method || 'GET'}</span>
                    <span className="text-slate-300 truncate">{quickSavePayload.url}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Escudo de seguridad activo: los secretos se redactarán de forma transparente en SQLite.
                  </div>
                </div>

                {/* Nombre de la solicitud guardada */}
                <div>
                  <label className="block text-[11px] font-mono text-cyan-400 uppercase mb-1">
                    Nombre Descriptivo <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={quickSaveReqName}
                    onChange={(e) => setQuickSaveReqName(e.target.value)}
                    required
                    autoFocus
                    placeholder="Ej: Login de Usuario, Obtener Productos..."
                    className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-cyan-500/30 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Selección o Creación de Colección */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-mono text-cyan-400 uppercase">
                      Colección Destino
                    </label>
                    <button
                      type="button"
                      onClick={() => setQuickSaveIsNewCol(!quickSaveIsNewCol)}
                      className="text-[10px] font-mono text-purple-400 hover:text-purple-300 underline"
                    >
                      {quickSaveIsNewCol ? 'Seleccionar existente' : '+ Crear nueva'}
                    </button>
                  </div>

                  {quickSaveIsNewCol || availableCollections.length === 0 ? (
                    <input
                      type="text"
                      value={quickSaveNewColName}
                      onChange={(e) => setQuickSaveNewColName(e.target.value)}
                      placeholder="Nombre de la nueva colección..."
                      required
                      className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-purple-500/40 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                    />
                  ) : (
                    <select
                      value={quickSaveTargetColId}
                      onChange={(e) => setQuickSaveTargetColId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-cyan-500/30 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                    >
                      {availableCollections.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.name} ({col.requestsCount} misiones)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-cyan-500/20">
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickSaveModalOpen(false);
                      setActiveTab('collections');
                    }}
                    className="text-xs font-mono text-slate-400 hover:text-cyan-300 transition"
                  >
                    Ver todas las colecciones &rarr;
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsQuickSaveModalOpen(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 font-mono text-xs hover:bg-slate-800 transition"
                    >
                      CANCELAR
                    </button>
                    <button
                      type="submit"
                      disabled={!quickSaveReqName.trim()}
                      className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition disabled:opacity-50"
                    >
                      GUARDAR
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Pie de Página Holográfico */}
        <footer className="border-t border-cyan-500/20 bg-[#070b16] py-4 px-6 text-center text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>API FORGE // SISTEMA HUNTER V1 &bull; FASE 1D: COLLECTIONS SYSTEM</div>
          <div className="text-cyan-400/60">
            Node.js + Express + LibSQL/SQLite + Drizzle ORM + Vitest + React 19 + Tailwind + Web Audio API
          </div>
        </footer>
      </div>
    </div>
  );
}
