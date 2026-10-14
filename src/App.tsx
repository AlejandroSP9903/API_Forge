/**
 * API Forge - Interfaz Principal (Fase 0: Base y Observabilidad)
 * Presenta el estado de salud en tiempo real del backend Express, SQLite y Drizzle ORM.
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
} from 'lucide-react';
import type { HealthCheckResponse } from '../packages/shared/types.ts';

export default function App() {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [clientLatency, setClientLatency] = useState<number | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'raw_json' | 'architecture'>('overview');

  const fetchHealthStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const response = await fetch('/api/health');
      const latency = Math.round(performance.now() - start);
      setClientLatency(latency);

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data: HealthCheckResponse = await response.json();
        setHealthData(data);
        setLastCheckTime(new Date());

        if (data.status === 'degraded' || data.database.status !== 'connected') {
          setError(`Servicio en estado degradado: Base de datos ${data.database.status}`);
        } else {
          setError(null);
        }
      } else {
        const rawText = await response.text();
        if (rawText.includes('<!doctype') || rawText.includes('<html')) {
          throw new Error('El backend se está inicializando o devolvió HTML en vez de JSON. Reintentando en breve...');
        }
        throw new Error(`Respuesta no esperada del servidor (HTTP ${response.status}): ${rawText.slice(0, 120)}`);
      }
    } catch (err) {
      console.error('Error consultando salud del backend:', err);
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor backend.');
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthStatus();
    // Sondeo periódico cada 15 segundos
    const interval = setInterval(fetchHealthStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchHealthStatus]);

  const copyJson = () => {
    if (!healthData) return;
    navigator.clipboard.writeText(JSON.stringify(healthData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours === 0) return `${mins}m ${secs}s`;
    return `${hours}h ${remMins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Barra de Navegación Superior */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Terminal className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">API Forge</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/20">
                  Fase 0
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Plataforma de pruebas y observabilidad de APIs REST
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Indicador de estado del Backend */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900">
              {loading && !healthData ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  <span className="text-xs font-medium text-amber-400">Verificando...</span>
                </>
              ) : healthData?.status === 'ok' ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-medium text-emerald-400">Backend Activo</span>
                  {clientLatency !== null && (
                    <span className="text-[11px] font-mono text-slate-400 ml-1">
                      {clientLatency}ms
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  <span className="text-xs font-medium text-rose-400">Desconectado</span>
                </>
              )}
            </div>

            {/* Botón de recarga de diagnóstico */}
            <button
              onClick={fetchHealthStatus}
              disabled={loading}
              title="Actualizar estado del backend"
              className="p-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner de Bienvenida y Estado Arquitectónico */}
        <section className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
              <ShieldCheck className="h-4 w-4" />
              Arquitectura Base Comprobada
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Entorno Fundacional de API Forge
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              La <strong className="text-white">Fase 0</strong> establece los cimientos técnicos sin servicios de pago ni dependencias externas: servidor Express con TypeScript estricto, persistencia local en SQLite con comprobación de claves foráneas mediante Drizzle ORM, y pruebas automatizadas con Vitest y Supertest.
            </p>
          </div>
        </section>

        {/* Notificación de Error si la conexión falla */}
        {error && (
          <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-4 text-rose-200 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-rose-300">Fallo en la comunicación con el Backend</h4>
              <p className="text-xs text-rose-200/80">{error}</p>
              <p className="text-xs text-rose-300/60 mt-1">
                Verifica que el servidor Express esté ejecutándose en el puerto 3000 con el comando <code className="bg-rose-900/40 px-1 py-0.5 rounded font-mono">npm run dev</code>.
              </p>
            </div>
          </div>
        )}

        {/* Tarjetas de Métricas de Salud en Vivo */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tarjeta 1: Servidor Express */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Servidor Web</span>
              <Server className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-white flex items-center gap-2">
                Express 4.x
                {healthData && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Entorno: <span className="font-mono text-slate-200">{healthData?.environment || 'detectando...'}</span>
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Node.js</span>
              <span className="font-mono text-slate-300">{healthData?.nodeVersion || 'N/A'}</span>
            </div>
          </div>

          {/* Tarjeta 2: Persistencia SQLite */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Base de Datos</span>
              <Database className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-white flex items-center gap-2">
                SQLite Local
                {healthData?.database.status === 'connected' && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                ORM: <span className="text-slate-200 font-mono">Drizzle ORM</span>
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Claves Foráneas (FK)</span>
              <span className={`font-semibold ${healthData?.database.foreignKeys ? 'text-emerald-400' : 'text-amber-400'}`}>
                {healthData?.database.foreignKeys ? 'PRAGMA ON' : 'DESACTIVADO'}
              </span>
            </div>
          </div>

          {/* Tarjeta 3: Latencia & Diagnóstico */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Latencia HTTP</span>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">
                {clientLatency !== null ? `${clientLatency} ms` : '--'}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Consulta <span className="font-mono text-slate-200">GET /api/health</span>
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Latencia DB</span>
              <span className="font-mono text-slate-300">
                {healthData?.database.latencyMs !== undefined ? `${healthData.database.latencyMs} ms` : 'N/A'}
              </span>
            </div>
          </div>

          {/* Tarjeta 4: Tiempo de Actividad */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium uppercase tracking-wider">Tiempo de Actividad</span>
              <Clock className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">
                {healthData?.uptimeSeconds !== undefined ? formatUptime(healthData.uptimeSeconds) : '--'}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Última comprobación: {lastCheckTime ? lastCheckTime.toLocaleTimeString() : '--'}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Versión API</span>
              <span className="font-mono text-slate-300">v{healthData?.version || '0.1.0'}</span>
            </div>
          </div>
        </section>

        {/* Pestañas de Vista Técnica */}
        <section className="space-y-4">
          <div className="flex border-b border-slate-800 gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 text-sm font-medium transition flex items-center gap-2 relative ${
                activeTab === 'overview'
                  ? 'text-indigo-400 font-semibold border-b-2 border-indigo-500 -mb-px'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCheck className="h-4 w-4" />
              Criterios de Aceptación y Estado
            </button>
            <button
              onClick={() => setActiveTab('raw_json')}
              className={`pb-3 text-sm font-medium transition flex items-center gap-2 relative ${
                activeTab === 'raw_json'
                  ? 'text-indigo-400 font-semibold border-b-2 border-indigo-500 -mb-px'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="h-4 w-4" />
              Respuesta JSON (/api/health)
            </button>
            <button
              onClick={() => setActiveTab('architecture')}
              className={`pb-3 text-sm font-medium transition flex items-center gap-2 relative ${
                activeTab === 'architecture'
                  ? 'text-indigo-400 font-semibold border-b-2 border-indigo-500 -mb-px'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-4 w-4" />
              Hoja de Ruta de Fases
            </button>
          </div>

          {/* Tab 1: Criterios de Aceptación */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lista de Verificación de Criterios de Fase 0 */}
              <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-6 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    Auditoría de Criterios de Aceptación (Fase 0)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Verificación en vivo del cumplimiento de los requisitos técnicos estructurales.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-900/60 flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-200">
                        1. Servidor Express modular en TypeScript
                      </div>
                      <p className="text-xs text-slate-400">
                        Configurado con factoría <code className="font-mono text-slate-300">createApp()</code> para pruebas desacopladas y montaje en puerto 3000.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-900/60 flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-200">
                        2. Endpoint de salud GET /api/health con contrato estricto
                      </div>
                      <p className="text-xs text-slate-400">
                        Devuelve estado HTTP 200, tiempo de actividad, versión y diagnóstico de base de datos.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-900/60 flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-200">
                        3. Inicialización de SQLite y Drizzle ORM con PRAGMA foreign_keys = ON
                      </div>
                      <p className="text-xs text-slate-400">
                        Utiliza el cliente sin compiladores nativos C++ (<code className="font-mono text-slate-300">@libsql/client</code>), con soporte tanto para archivo local como memoria para pruebas.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-900/60 flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-200">
                        4. Migración inicial reproducible y comprobada
                      </div>
                      <p className="text-xs text-slate-400">
                        Tablas verificadas en base de datos: <code className="font-mono text-indigo-300">{healthData?.database.tablesVerified.join(', ') || 'projects, api_endpoints, health_audit_logs'}</code>.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-900/60 flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-200">
                        5. Suite de Pruebas Automatizadas (Vitest + Supertest)
                      </div>
                      <p className="text-xs text-slate-400">
                        7 pruebas ejecutadas con 100% de éxito cubriendo salud HTTP, fallo de claves foráneas y borrado en cascada.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-900/60 flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-200">
                        6. Manejador Centralizado de Errores
                      </div>
                      <p className="text-xs text-slate-400">
                        Estructurado con <code className="font-mono text-slate-300">AppError</code>, protección contra fugas de secretos y códigos de error estándar.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel de Esquema SQLite Activo */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database className="h-4 w-4 text-cyan-400" />
                    Esquema SQLite Activo
                  </h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                    Drizzle
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80 space-y-1.5">
                    <div className="flex items-center justify-between font-semibold text-slate-200 font-mono">
                      <span>projects</span>
                      <span className="text-[10px] text-slate-400">Tabla Maestra</span>
                    </div>
                    <div className="text-slate-400 text-[11px] font-mono space-y-0.5">
                      <div>• id: TEXT (PK)</div>
                      <div>• name: TEXT NOT NULL</div>
                      <div>• description: TEXT</div>
                      <div>• created_at: INTEGER</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80 space-y-1.5">
                    <div className="flex items-center justify-between font-semibold text-slate-200 font-mono">
                      <span>api_endpoints</span>
                      <span className="text-[10px] text-indigo-400">FK Cascade</span>
                    </div>
                    <div className="text-slate-400 text-[11px] font-mono space-y-0.5">
                      <div>• id: TEXT (PK)</div>
                      <div className="text-indigo-300">• project_id: TEXT → projects.id</div>
                      <div>• method: TEXT (GET/POST/...)</div>
                      <div>• path: TEXT</div>
                      <div>• created_at: INTEGER</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80 space-y-1.5">
                    <div className="flex items-center justify-between font-semibold text-slate-200 font-mono">
                      <span>health_audit_logs</span>
                      <span className="text-[10px] text-slate-400">Auditoría</span>
                    </div>
                    <div className="text-slate-400 text-[11px] font-mono space-y-0.5">
                      <div>• id: INTEGER (PK Auto)</div>
                      <div>• checked_at: TEXT</div>
                      <div>• status: TEXT</div>
                      <div>• latency_ms: INTEGER</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/40 text-[11px] text-indigo-300 leading-relaxed">
                  <strong>Regla de Integridad:</strong> Si se elimina un proyecto padre, todos sus endpoints asociados se eliminan en cascada gracias a <code className="font-mono">PRAGMA foreign_keys = ON</code>.
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: JSON en Bruto */}
          {activeTab === 'raw_json' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-indigo-400" />
                    Contrato REST: GET /api/health
                  </h3>
                  <p className="text-xs text-slate-400">
                    Respuesta literal retornada por el servidor Express
                  </p>
                </div>
                <button
                  onClick={copyJson}
                  disabled={!healthData}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copiar JSON</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed">
                  {healthData
                    ? JSON.stringify(healthData, null, 2)
                    : loading
                    ? '// Esperando respuesta del servidor...'
                    : `// Error al obtener JSON: ${error}`}
                </pre>
              </div>
            </div>
          )}

          {/* Tab 3: Arquitectura y Hoja de Ruta */}
          {activeTab === 'architecture' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-400" />
                  Evolución Modular de API Forge
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Plan de etapas de implementación progresivas con alcance delimitado.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Fase 0 */}
                <div className="p-5 rounded-xl border border-indigo-500/40 bg-indigo-950/20 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                      Fase 0
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Completada
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Arquitectura & Base</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Express, React, TypeScript estricto, SQLite local con Drizzle ORM, pruebas automáticas con Vitest y Supertest.
                  </p>
                  <div className="pt-2 border-t border-indigo-900/40 text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    100% Ejecutable
                  </div>
                </div>

                {/* Fase 1 */}
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3 opacity-75">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Fase 1
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Planificada
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">Motor de Solicitudes</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Ejecutor de peticiones HTTP (GET, POST, PUT, DELETE, PATCH), gestión de cabeceras y parámetros.
                  </p>
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                    Sin implementar en Fase 0
                  </div>
                </div>

                {/* Fase 2 */}
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3 opacity-75">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Fase 2
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Planificada
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">Colecciones & Entornos</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Organización en carpetas, variables de entorno dinámicas (dev, staging, prod) y persistencia en SQLite.
                  </p>
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                    Sin implementar en Fase 0
                  </div>
                </div>

                {/* Fase 3 */}
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3 opacity-75">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Fase 3
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Planificada
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">Aserciones & Observabilidad</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Validación de código de respuesta, esquema JSON, tiempos de latencia y registro histórico de ejecuciones.
                  </p>
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                    Sin implementar en Fase 0
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Pie de página con información técnica */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500 space-y-1">
        <div>
          API Forge &bull; Arquitectura Limpia sin Costo Adicional (0 COP) &bull; Fase 0
        </div>
        <div>
          Express + SQLite + Drizzle ORM + Vitest + React + Vite + Tailwind CSS
        </div>
      </footer>
    </div>
  );
}
