/**
 * API Forge - Panel de Gestión de Entornos y Variables (Fase 1E)
 * Estética Hunter System inspirada en Solo Leveling con persistencia SQLite y Drizzle ORM.
 * Permite crear entornos (Desarrollo, Producción), gestionar variables con soporte para
 * secretos confidenciales (ocultos con ••••••••) e interpolación {{VARIABLE}}.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  Edit2,
  Check,
  Eye,
  EyeOff,
  Lock,
  Layers,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Database,
  ArrowRight,
  Shield,
  KeyRound,
  FileCode,
} from 'lucide-react';
import type {
  EnvironmentSummary,
  EnvironmentData,
  EnvironmentVariable,
} from '../../packages/shared/types.ts';
import {
  fetchEnvironments,
  fetchEnvironmentById,
  createEnvironmentApi,
  updateEnvironmentApi,
  deleteEnvironmentApi,
  getActiveEnvironmentId,
  setActiveEnvironmentId,
} from '../services/environmentService.ts';
import { playSound } from '../services/audioService.ts';

interface EnvironmentsPanelProps {
  activeEnvironmentId: string | null;
  onActiveEnvironmentChange: (envId: string | null, envData?: EnvironmentData | null) => void;
  onEnvironmentsCountChange?: (count: number) => void;
}

export function EnvironmentsPanel({
  activeEnvironmentId,
  onActiveEnvironmentChange,
  onEnvironmentsCountChange,
}: EnvironmentsPanelProps) {
  // Lista de entornos
  const [environments, setEnvironments] = useState<EnvironmentSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Entorno actualmente seleccionado para edición
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Variables en edición del entorno seleccionado
  const [editingVariables, setEditingVariables] = useState<EnvironmentVariable[]>([]);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  // Fila para agregar nueva variable rápidamente
  const [newVarName, setNewVarName] = useState<string>('');
  const [newVarValue, setNewVarValue] = useState<string>('');
  const [newVarIsSecret, setNewVarIsSecret] = useState<boolean>(false);

  // Modales de Entorno
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newEnvName, setNewEnvName] = useState<string>('');
  const [newEnvDescription, setNewEnvDescription] = useState<string>('');

  const [editingEnvMeta, setEditingEnvMeta] = useState<EnvironmentSummary | null>(null);
  const [editEnvName, setEditEnvName] = useState<string>('');
  const [editEnvDescription, setEditEnvDescription] = useState<string>('');

  const [deletingEnv, setDeletingEnv] = useState<EnvironmentSummary | null>(null);

  // Notificación temporal
  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Cargar lista de entornos
  const loadEnvironments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchEnvironments();
      setEnvironments(list);
      onEnvironmentsCountChange?.(list.length);

      // Si no hay entorno seleccionado y hay disponibles, seleccionar el activo o el primero
      if (list.length > 0 && !selectedEnvId) {
        const targetId = activeEnvironmentId && list.some((e) => e.id === activeEnvironmentId)
          ? activeEnvironmentId
          : list[0].id;
        setSelectedEnvId(targetId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar con SQLite.');
    } finally {
      setLoading(false);
    }
  }, [activeEnvironmentId, onEnvironmentsCountChange, selectedEnvId]);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  // Cargar detalles del entorno seleccionado
  const loadEnvironmentDetails = useCallback(async (id: string) => {
    setLoadingDetails(true);
    try {
      const data = await fetchEnvironmentById(id);
      setSelectedEnv(data);
      setEditingVariables(data.variables || []);
      setHasUnsavedChanges(false);

      // Si es el entorno activo, notificar al padre para sincronizar las variables
      if (id === activeEnvironmentId) {
        onActiveEnvironmentChange(id, data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar variables del entorno.');
    } finally {
      setLoadingDetails(false);
    }
  }, [activeEnvironmentId, onActiveEnvironmentChange]);

  useEffect(() => {
    if (selectedEnvId) {
      loadEnvironmentDetails(selectedEnvId);
    } else {
      setSelectedEnv(null);
      setEditingVariables([]);
    }
  }, [selectedEnvId, loadEnvironmentDetails]);

  // 1. CREAR ENTORNO
  const handleCreateEnvironment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnvName.trim()) return;

    try {
      const created = await createEnvironmentApi({
        name: newEnvName.trim(),
        description: newEnvDescription.trim() || undefined,
        variables: [
          { id: '1', name: 'BASE_URL', value: 'https://jsonplaceholder.typicode.com', isSecret: false },
        ],
      });

      playSound('requestSuccess');
      showFeedback(`Entorno '${created.name}' creado exitosamente.`);
      setNewEnvName('');
      setNewEnvDescription('');
      setIsCreateModalOpen(false);

      await loadEnvironments();
      setSelectedEnvId(created.id);
    } catch (err) {
      playSound('requestError');
      setError(err instanceof Error ? err.message : 'No se pudo crear el entorno.');
    }
  };

  // 2. EDITAR NOMBRE / DESCRIPCIÓN DE ENTORNO
  const handleOpenEditEnv = (env: EnvironmentSummary) => {
    setEditingEnvMeta(env);
    setEditEnvName(env.name);
    setEditEnvDescription(env.description || '');
  };

  const handleUpdateEnvMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEnvMeta || !editEnvName.trim()) return;

    try {
      const updated = await updateEnvironmentApi(editingEnvMeta.id, {
        name: editEnvName.trim(),
        description: editEnvDescription.trim(),
      });

      playSound('requestSuccess');
      showFeedback(`Entorno '${updated.name}' actualizado.`);
      setEditingEnvMeta(null);
      await loadEnvironments();

      if (selectedEnvId === updated.id) {
        setSelectedEnv((prev) => (prev ? { ...prev, name: updated.name, description: updated.description } : prev));
      }
    } catch (err) {
      playSound('requestError');
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el entorno.');
    }
  };

  // 3. ELIMINAR ENTORNO
  const handleDeleteEnvironment = async () => {
    if (!deletingEnv) return;

    try {
      await deleteEnvironmentApi(deletingEnv.id);
      playSound('requestSuccess');
      showFeedback(`Entorno '${deletingEnv.name}' eliminado.`);

      if (activeEnvironmentId === deletingEnv.id) {
        setActiveEnvironmentId(null);
        onActiveEnvironmentChange(null, null);
      }

      setDeletingEnv(null);

      if (selectedEnvId === deletingEnv.id) {
        setSelectedEnvId(null);
        setSelectedEnv(null);
      }

      await loadEnvironments();
    } catch (err) {
      playSound('requestError');
      setError(err instanceof Error ? err.message : 'Error al eliminar el entorno.');
    }
  };

  // 4. SELECCIONAR COMO ENTORNO ACTIVO
  const handleToggleActiveEnvironment = (envId: string) => {
    if (activeEnvironmentId === envId) {
      setActiveEnvironmentId(null);
      onActiveEnvironmentChange(null, null);
      showFeedback('Entorno desactivado. Ahora las solicitudes se ejecutarán sin variables.');
    } else {
      setActiveEnvironmentId(envId);
      const fullEnv = selectedEnvId === envId ? selectedEnv : null;
      onActiveEnvironmentChange(envId, fullEnv);
      playSound('requestSuccess');
      showFeedback(`Entorno activado. Las solicitudes resolverán las variables configuradas.`);
    }
  };

  // 5. GESTIÓN DE VARIABLES
  const handleAddVariable = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newVarName.trim().toUpperCase();
    if (!cleanName) return;

    // Verificar si ya existe
    if (editingVariables.some((v) => v.name === cleanName)) {
      setError(`Ya existe una variable con el nombre '${cleanName}'.`);
      return;
    }

    const newVar: EnvironmentVariable = {
      id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      value: newVarValue,
      isSecret: newVarIsSecret,
    };

    setEditingVariables((prev) => [...prev, newVar]);
    setNewVarName('');
    setNewVarValue('');
    setNewVarIsSecret(false);
    setHasUnsavedChanges(true);
  };

  const handleUpdateVariableField = (
    id: string,
    field: 'name' | 'value' | 'isSecret',
    value: string | boolean
  ) => {
    setEditingVariables((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
    setHasUnsavedChanges(true);
  };

  const handleDeleteVariable = (id: string) => {
    setEditingVariables((prev) => prev.filter((v) => v.id !== id));
    setHasUnsavedChanges(true);
  };

  const handleToggleSecretVisibility = (varId: string) => {
    setVisibleSecrets((prev) => ({
      ...prev,
      [varId]: !prev[varId],
    }));
  };

  // 6. GUARDAR TODAS LAS VARIABLES DEL ENTORNO
  const handleSaveVariables = async () => {
    if (!selectedEnvId) return;

    try {
      const updated = await updateEnvironmentApi(selectedEnvId, {
        variables: editingVariables,
      });

      playSound('requestSuccess');
      showFeedback(`Variables del entorno '${updated.name}' guardadas en SQLite.`);
      setSelectedEnv(updated);
      setEditingVariables(updated.variables);
      setHasUnsavedChanges(false);

      // Si este entorno es el activo, actualizar en memoria de App
      if (selectedEnvId === activeEnvironmentId) {
        onActiveEnvironmentChange(selectedEnvId, updated);
      }

      await loadEnvironments();
    } catch (err) {
      playSound('requestError');
      setError(err instanceof Error ? err.message : 'Error al guardar las variables en la base de datos.');
    }
  };

  const activeEnvName =
    environments.find((e) => e.id === activeEnvironmentId)?.name || 'Ninguno (Sin entorno)';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Banner Superior Holográfico Hunter */}
      <div className="holo-panel rounded-xl p-5 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-cyan-500/20 shadow-[0_0_25px_rgba(6,182,212,0.08)]">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400 uppercase tracking-widest">
            <Globe className="h-4 w-4 text-cyan-400 animate-pulse" />
            <span>SISTEMA DE ENTORNOS // VARIABLES REUTILIZABLES</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide flex items-center gap-2">
            <span>ENTORNOS Y VARIABLES</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              FASE 1E
            </span>
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Define variables dinámicas como <code className="text-cyan-300">{'{{BASE_URL}}'}</code> o{' '}
            <code className="text-cyan-300">{'{{TOKEN}}'}</code> para reutilizar solicitudes HTTP entre Desarrollo,
            Pruebas y Producción sin alterar las plantillas originales.
          </p>
        </div>

        {/* Telemetría y Botón de Creación */}
        <div className="flex flex-wrap items-center gap-3 z-10">
          <div className="px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-right">
            <div className="text-[10px] font-mono text-cyan-400/70 uppercase">ENTORNO ACTIVO</div>
            <div className="text-xs font-bold text-cyan-300 font-mono flex items-center gap-1.5 justify-end">
              <span className={`h-1.5 w-1.5 rounded-full ${activeEnvironmentId ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
              <span className="truncate max-w-[120px]">{activeEnvName}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setNewEnvName('');
              setNewEnvDescription('');
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-mono text-xs font-black tracking-wider transition flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>NUEVO ENTORNO</span>
          </button>
        </div>
      </div>

      {/* Alertas y Mensajes de Éxito */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 text-emerald-200 text-xs font-mono flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs font-mono flex items-center justify-between gap-2.5 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-white text-xs underline font-bold"
          >
            CERRAR
          </button>
        </div>
      )}

      {/* DISPOSICIÓN PRINCIPAL: LISTA DE ENTORNOS (IZQUIERDA) + DETALLE/VARIABLES (DERECHA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PANEL IZQUIERDO: LISTA DE ENTORNOS */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              Entornos Registrados ({environments.length})
            </span>
            <button
              onClick={loadEnvironments}
              title="Recargar entornos"
              className="text-cyan-400 hover:text-cyan-300 p-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-cyan-400 font-mono text-xs space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-cyan-400" />
              <p>Cargando entornos...</p>
            </div>
          ) : environments.length > 0 ? (
            <div className="space-y-2.5">
              {environments.map((env) => {
                const isSelected = selectedEnvId === env.id;
                const isActive = activeEnvironmentId === env.id;

                return (
                  <div
                    key={env.id}
                    onClick={() => setSelectedEnvId(env.id)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer relative ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-950/50 to-indigo-950/30 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                        : 'bg-[#070b16] border-cyan-500/20 hover:border-cyan-500/40 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm truncate">{env.name}</span>
                          {isActive && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                              ACTIVO
                            </span>
                          )}
                        </div>
                        {env.description && (
                          <p className="text-[11px] text-slate-400 truncate">{env.description}</p>
                        )}
                        <div className="text-[10px] font-mono text-cyan-400/80 pt-1">
                          {env.variablesCount} {env.variablesCount === 1 ? 'variable' : 'variables'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditEnv(env);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-cyan-300"
                          title="Editar entorno"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingEnv(env);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-400"
                          title="Eliminar entorno"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-[#050811] border border-dashed border-cyan-500/20 text-center space-y-3">
              <Globe className="h-8 w-8 text-cyan-500/40 mx-auto" />
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-300">No hay entornos</div>
                <p className="text-[11px] text-slate-500">
                  Crea un entorno como &quot;Desarrollo&quot; o &quot;Producción&quot; para empezar.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold"
              >
                + CREAR PRIMER ENTORNO
              </button>
            </div>
          )}
        </div>

        {/* PANEL DERECHO: DETALLE Y GESTIÓN DE VARIABLES */}
        <div className="lg:col-span-8">
          {selectedEnv ? (
            <div className="holo-panel rounded-xl border border-cyan-500/30 overflow-hidden space-y-4 p-5">
              {/* Cabecera del Entorno Seleccionado */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-cyan-500/20">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{selectedEnv.name}</h3>
                    {activeEnvironmentId === selectedEnv.id ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        ENTORNO ACTIVO
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500">INACTIVO</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {selectedEnv.description || 'Sin descripción asignada.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActiveEnvironment(selectedEnv.id)}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition flex items-center gap-1.5 ${
                      activeEnvironmentId === selectedEnv.id
                        ? 'bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/40 text-rose-300'
                        : 'bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.2)]'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>
                      {activeEnvironmentId === selectedEnv.id ? 'DESACTIVAR' : 'ACTIVAR ESTE ENTORNO'}
                    </span>
                  </button>

                  {hasUnsavedChanges && (
                    <button
                      onClick={handleSaveVariables}
                      className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition shadow-[0_0_12px_rgba(6,182,212,0.3)] animate-pulse"
                    >
                      GUARDAR CAMBIOS
                    </button>
                  )}
                </div>
              </div>

              {/* Formulario Inline para Añadir Nueva Variable */}
              <div className="p-3.5 rounded-xl bg-[#050811] border border-cyan-500/20 space-y-2">
                <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                  // AÑADIR NUEVA VARIABLE AL ENTORNO
                </div>

                <form onSubmit={handleAddVariable} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value.toUpperCase())}
                      placeholder="NOMBRE (ej: BASE_URL, TOKEN)"
                      className="w-full px-3 py-2 rounded-lg bg-[#070b16] border border-cyan-500/30 text-xs font-mono text-cyan-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={newVarValue}
                      onChange={(e) => setNewVarValue(e.target.value)}
                      placeholder="Valor de la variable"
                      className="w-full px-3 py-2 rounded-lg bg-[#070b16] border border-cyan-500/30 text-xs font-mono text-cyan-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-1.5">
                    <label className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newVarIsSecret}
                        onChange={(e) => setNewVarIsSecret(e.target.checked)}
                        className="rounded border-cyan-500 bg-slate-900 text-cyan-400 focus:ring-0"
                      />
                      <span className="flex items-center gap-1">
                        <Lock className="h-3 w-3 text-amber-400" />
                        <span>Secreto</span>
                      </span>
                    </label>
                  </div>

                  <div className="sm:col-span-1">
                    <button
                      type="submit"
                      disabled={!newVarName.trim()}
                      className="w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center justify-center disabled:opacity-50 transition"
                      title="Agregar variable"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Tabla de Variables Existentes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Variables Configuradas ({editingVariables.length})</span>
                  {hasUnsavedChanges && (
                    <span className="text-amber-400 text-[11px] animate-pulse">
                      ● Tienes cambios sin guardar
                    </span>
                  )}
                </div>

                {editingVariables.length > 0 ? (
                  <div className="border border-cyan-500/20 rounded-xl overflow-hidden bg-[#050811]/90">
                    <div className="grid grid-cols-12 gap-2 px-3.5 py-2 bg-[#070b16] border-b border-cyan-500/20 text-[10px] font-mono text-cyan-400/80 uppercase">
                      <div className="col-span-4">Nombre Variable</div>
                      <div className="col-span-5">Valor</div>
                      <div className="col-span-2 text-center">Confidencial</div>
                      <div className="col-span-1 text-right">Acción</div>
                    </div>

                    <div className="divide-y divide-slate-900">
                      {editingVariables.map((v) => {
                        const isSecret = Boolean(v.isSecret);
                        const isVisible = visibleSecrets[v.id] || false;

                        return (
                          <div
                            key={v.id}
                            className="grid grid-cols-12 gap-2 px-3.5 py-2.5 items-center hover:bg-cyan-950/10 transition"
                          >
                            {/* Nombre Variable */}
                            <div className="col-span-4">
                              <input
                                type="text"
                                value={v.name}
                                onChange={(e) =>
                                  handleUpdateVariableField(v.id, 'name', e.target.value.toUpperCase())
                                }
                                className="w-full bg-transparent text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-b border-cyan-400"
                              />
                            </div>

                            {/* Valor Variable (con ocultación si es secreto) */}
                            <div className="col-span-5 flex items-center gap-1.5">
                              {isSecret && !isVisible ? (
                                <input
                                  type="password"
                                  value={v.value}
                                  onChange={(e) =>
                                    handleUpdateVariableField(v.id, 'value', e.target.value)
                                  }
                                  className="w-full bg-[#070b16] px-2 py-1 rounded border border-amber-500/30 text-xs font-mono text-amber-200 tracking-widest focus:outline-none"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={v.value}
                                  onChange={(e) =>
                                    handleUpdateVariableField(v.id, 'value', e.target.value)
                                  }
                                  className={`w-full bg-[#070b16] px-2 py-1 rounded border text-xs font-mono focus:outline-none ${
                                    isSecret
                                      ? 'border-amber-500/40 text-amber-200'
                                      : 'border-slate-800 text-slate-200'
                                  }`}
                                />
                              )}

                              {isSecret && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleSecretVisibility(v.id)}
                                  className="p-1 rounded text-amber-400 hover:text-white"
                                  title={isVisible ? 'Ocultar secreto' : 'Mostrar secreto'}
                                >
                                  {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              )}
                            </div>

                            {/* Switch Confidencial */}
                            <div className="col-span-2 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateVariableField(v.id, 'isSecret', !v.isSecret)
                                }
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                                  v.isSecret
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300'
                                }`}
                              >
                                {v.isSecret ? '🔒 SECRETO' : 'PÚBLICA'}
                              </button>
                            </div>

                            {/* Eliminar Variable */}
                            <div className="col-span-1 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteVariable(v.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition"
                                title="Eliminar variable"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs font-mono text-slate-500 border border-dashed border-cyan-500/20 rounded-xl">
                    Este entorno no tiene variables. Usa el formulario de arriba para añadir la primera.
                  </div>
                )}
              </div>

              {/* Botón Guardar Cambios al pie */}
              <div className="flex items-center justify-between pt-3 border-t border-cyan-500/20">
                <div className="text-[11px] font-mono text-slate-500">
                  Usa <code className="text-cyan-400">{'{{NOMBRE}}'}</code> en la URL, cabeceras o cuerpo del Request Builder.
                </div>

                <button
                  onClick={handleSaveVariables}
                  disabled={!hasUnsavedChanges}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition disabled:opacity-40"
                >
                  GUARDAR VARIABLES
                </button>
              </div>
            </div>
          ) : (
            <div className="holo-panel rounded-xl border border-dashed border-cyan-500/20 p-12 text-center space-y-3">
              <Globe className="h-10 w-10 text-cyan-500/30 mx-auto" />
              <div className="text-sm font-bold text-slate-300">Selecciona o crea un entorno</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Los entornos permiten agrupar credenciales y hosts para probar tus APIs en diferentes etapas.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          MODALES DE ENTORNO
         ===================================================================== */}

      {/* MODAL 1: CREAR ENTORNO */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#070b16] border border-cyan-500/40 rounded-xl p-5 w-full max-w-md space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.2)] animate-fadeIn">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono">NUEVO ENTORNO</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEnvironment} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-cyan-400 uppercase mb-1">
                  Nombre del Entorno <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  placeholder="Ej: Desarrollo, Pruebas, Producción..."
                  maxLength={100}
                  required
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-cyan-500/30 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-cyan-400 uppercase mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={newEnvDescription}
                  onChange={(e) => setNewEnvDescription(e.target.value)}
                  placeholder="Ej: Servidores locales y base de datos de desarrollo..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-cyan-500/30 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 font-mono text-xs hover:bg-slate-800 transition"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={!newEnvName.trim()}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition disabled:opacity-50"
                >
                  CREAR ENTORNO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR METADATOS DE ENTORNO */}
      {editingEnvMeta && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#070b16] border border-cyan-500/40 rounded-xl p-5 w-full max-w-md space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.2)] animate-fadeIn">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono">EDITAR ENTORNO</h3>
              </div>
              <button
                onClick={() => setEditingEnvMeta(null)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateEnvMeta} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-cyan-400 uppercase mb-1">
                  Nombre del Entorno <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={editEnvName}
                  onChange={(e) => setEditEnvName(e.target.value)}
                  maxLength={100}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-cyan-500/30 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-cyan-400 uppercase mb-1">
                  Descripción
                </label>
                <textarea
                  value={editEnvDescription}
                  onChange={(e) => setEditEnvDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-cyan-500/30 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => setEditingEnvMeta(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 font-mono text-xs hover:bg-slate-800 transition"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={!editEnvName.trim()}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition disabled:opacity-50"
                >
                  GUARDAR CAMBIOS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRMAR ELIMINACIÓN DE ENTORNO */}
      {deletingEnv && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#070b16] border border-rose-500/50 rounded-xl p-5 w-full max-w-md space-y-4 shadow-[0_0_30px_rgba(244,63,94,0.25)] animate-fadeIn">
            <div className="flex items-center gap-3 text-rose-400 border-b border-rose-500/20 pb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  ¿ELIMINAR ENTORNO?
                </h3>
                <p className="text-[11px] font-mono text-rose-300">ESTA ACCIÓN NO SE PUEDE DESHACER</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                ¿Confirmas la eliminación del entorno{' '}
                <strong className="text-cyan-300">{deletingEnv.name}</strong>?
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Se eliminarán sus {deletingEnv.variablesCount} variables permanentemente de SQLite.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingEnv(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 font-mono text-xs hover:bg-slate-800 transition"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleDeleteEnvironment}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition shadow-[0_0_15px_rgba(244,63,94,0.4)]"
              >
                SÍ, ELIMINAR ENTORNO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
