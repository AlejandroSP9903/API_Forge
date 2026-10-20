/**
 * API Forge - Panel de Gestión de Colecciones (Fase 1D)
 * Estética Hunter System inspirada en Solo Leveling con persistencia SQLite y Drizzle ORM.
 * Permite organizar, guardar, editar, cargar y eliminar solicitudes reutilizables.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderArchive,
  FolderPlus,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ArrowLeft,
  Send,
  Sliders,
  Layers,
  FileCode,
  Sparkles,
  Database,
  Lock,
  ChevronRight,
  RotateCw,
} from 'lucide-react';
import type {
  CollectionSummary,
  CollectionWithRequests,
  SavedRequestData,
  HttpMethod,
  ExecuteRequestPayload,
} from '../../packages/shared/types.ts';
import {
  fetchCollections,
  fetchCollectionById,
  createCollectionApi,
  updateCollectionApi,
  deleteCollectionApi,
  createSavedRequestApi,
  updateSavedRequestApi,
  deleteSavedRequestApi,
} from '../services/collectionsService.ts';
import { playSound } from '../services/audioService.ts';

interface CollectionsPanelProps {
  currentBuilderPayload: ExecuteRequestPayload | null;
  onLoadIntoBuilder: (payload: ExecuteRequestPayload) => void;
  onNavigateToBuilder: () => void;
  onCollectionsCountChange?: (count: number) => void;
  initialSelectedCollectionId?: string | null;
}

const METHOD_COLORS: Record<HttpMethod, { text: string; bg: string; border: string }> = {
  GET: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  POST: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  PUT: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  PATCH: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  DELETE: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
};

export function CollectionsPanel({
  currentBuilderPayload,
  onLoadIntoBuilder,
  onNavigateToBuilder,
  onCollectionsCountChange,
  initialSelectedCollectionId,
}: CollectionsPanelProps) {
  // Lista de colecciones
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Colección seleccionada para inspección
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    initialSelectedCollectionId || null
  );

  useEffect(() => {
    if (initialSelectedCollectionId) {
      setSelectedCollectionId(initialSelectedCollectionId);
    }
  }, [initialSelectedCollectionId]);
  const [selectedCollection, setSelectedCollection] = useState<CollectionWithRequests | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Modales de Colección
  const [isCreateColModalOpen, setIsCreateColModalOpen] = useState<boolean>(false);
  const [newColName, setNewColName] = useState<string>('');
  const [newColDescription, setNewColDescription] = useState<string>('');

  const [editingCollection, setEditingCollection] = useState<CollectionSummary | null>(null);
  const [editColName, setEditColName] = useState<string>('');
  const [editColDescription, setEditColDescription] = useState<string>('');

  const [deletingCollection, setDeletingCollection] = useState<CollectionSummary | null>(null);

  // Modales de Solicitud Guardada
  const [isAddRequestModalOpen, setIsAddRequestModalOpen] = useState<boolean>(false);
  const [useCurrentBuilderValues, setUseCurrentBuilderValues] = useState<boolean>(true);
  const [newReqName, setNewReqName] = useState<string>('');
  const [newReqMethod, setNewReqMethod] = useState<HttpMethod>('GET');
  const [newReqUrl, setNewReqUrl] = useState<string>('');

  const [editingRequest, setEditingRequest] = useState<SavedRequestData | null>(null);
  const [editReqName, setEditReqName] = useState<string>('');

  const [deletingRequest, setDeletingRequest] = useState<SavedRequestData | null>(null);
  const [updatingRequestWithBuilder, setUpdatingRequestWithBuilder] = useState<SavedRequestData | null>(null);

  // Notificación temporal
  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Cargar colecciones iniciales
  const loadCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCollections();
      setCollections(data);
      onCollectionsCountChange?.(data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar con la base de datos de colecciones.');
    } finally {
      setLoading(false);
    }
  }, [onCollectionsCountChange]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Cargar detalles de la colección seleccionada
  const loadCollectionDetails = useCallback(async (id: string) => {
    setLoadingDetails(true);
    try {
      const details = await fetchCollectionById(id);
      setSelectedCollection(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener las solicitudes de la colección.');
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  const handleOpenCollection = (id: string) => {
    setSelectedCollectionId(id);
    loadCollectionDetails(id);
  };

  const handleBackToOverview = () => {
    setSelectedCollectionId(null);
    setSelectedCollection(null);
    loadCollections();
  };

  // 1. CREAR COLECCIÓN
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;

    try {
      await createCollectionApi({
        name: newColName.trim(),
        description: newColDescription.trim() || undefined,
      });
      playSound('requestSuccess');
      showFeedback(`Colección '${newColName.trim()}' creada exitosamente.`);
      setNewColName('');
      setNewColDescription('');
      setIsCreateColModalOpen(false);
      await loadCollections();
    } catch (err) {
      playSound('requestError');
      setError(err instanceof Error ? err.message : 'No se pudo crear la colección.');
    }
  };

  // 2. EDITAR COLECCIÓN
  const handleOpenEditCollection = (col: CollectionSummary) => {
    setEditingCollection(col);
    setEditColName(col.name);
    setEditColDescription(col.description || '');
  };

  const handleUpdateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection || !editColName.trim()) return;

    try {
      await updateCollectionApi(editingCollection.id, {
        name: editColName.trim(),
        description: editColDescription.trim(),
      });
      playSound('requestSuccess');
      showFeedback(`Colección '${editColName.trim()}' actualizada.`);
      setEditingCollection(null);
      await loadCollections();
      if (selectedCollectionId === editingCollection.id) {
        await loadCollectionDetails(editingCollection.id);
      }
    } catch (err) {
      playSound('requestError');
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la colección.');
    }
  };

  // 3. ELIMINAR COLECCIÓN (CON BORRADO EN CASCADA)
  const handleDeleteCollection = async () => {
    if (!deletingCollection) return;
    try {
      await deleteCollectionApi(deletingCollection.id);
      playSound('requestSuccess');
      showFeedback(`Colección '${deletingCollection.name}' eliminada.`);
      setDeletingCollection(null);
      if (selectedCollectionId === deletingCollection.id) {
        setSelectedCollectionId(null);
        setSelectedCollection(null);
      }
      await loadCollections();
    } catch (err) {
      playSound('requestError');
      setError(err instanceof Error ? err.message : 'Error al eliminar la colección.');
    }
  };

  // 4. GUARDAR SOLICITUD EN COLECCIÓN SELECCIONADA
  const handleOpenAddRequestModal = () => {
    if (currentBuilderPayload) {
      setUseCurrentBuilderValues(true);
      setNewReqName(`Misión ${currentBuilderPayload.method || 'GET'} - ${currentBuilderPayload.url.split('/').pop() || 'Endpoint'}`);
      setNewReqMethod(currentBuilderPayload.method || 'GET');
      setNewReqUrl(currentBuilderPayload.url);
    } else {
      setUseCurrentBuilderValues(false);
      setNewReqName('Nueva Misión API');
      setNewReqMethod('GET');
      setNewReqUrl('https://jsonplaceholder.typicode.com/posts/1');
    }
    setIsAddRequestModalOpen(true);
  };

  const handleSaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollectionId || !newReqName.trim() || !newReqUrl.trim()) return;

    try {
      if (useCurrentBuilderValues && currentBuilderPayload) {
        await createSavedRequestApi(selectedCollectionId, {
          name: newReqName.trim(),
          method: currentBuilderPayload.method || 'GET',
          url: currentBuilderPayload.url,
          headers: currentBuilderPayload.headers,
          queryParams: currentBuilderPayload.queryParams,
          body: currentBuilderPayload.body,
          auth: currentBuilderPayload.auth,
        });
      } else {
        await createSavedRequestApi(selectedCollectionId, {
          name: newReqName.trim(),
          method: newReqMethod,
          url: newReqUrl.trim(),
        });
      }

      playSound('requestSuccess');
      showFeedback(`Solicitud guardada en '${selectedCollection?.name || 'la colección'}'.`);
      setIsAddRequestModalOpen(false);
      await loadCollectionDetails(selectedCollectionId);
      await loadCollections();
    } catch (err) {
      playSound('requestError');
      setError(err instanceof Error ? err.message : 'Error al guardar la solicitud en la colección.');
    }
  };

  // 5. EDITAR NOMBRE DE SOLICITUD GUARDADA
  const handleOpenEditRequest = (req: SavedRequestData) => {
    setEditingRequest(req);
    setEditReqName(req.name);
  };

  const handleUpdateSavedRequestName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollectionId || !editingRequest || !editReqName.trim()) return;

    try {
      await updateSavedRequestApi(selectedCollectionId, editingRequest.id, {
        name: editReqName.trim(),
      });
      playSound('requestSuccess');
      showFeedback(`Solicitud renombrada a '${editReqName.trim()}'.`);
      setEditingRequest(null);
      await loadCollectionDetails(selectedCollectionId);
    } catch (err) {
      playSound('requestError');
      setError(err instanceof Error ? err.message : 'Error al actualizar el nombre de la solicitud.');
    }
  };

  // 6. ACTUALIZAR SOLICITUD EXISTENTE CON EL BUILDER ACTUAL
  const handleConfirmUpdateWithBuilder = async () => {
    if (!selectedCollectionId || !updatingRequestWithBuilder || !currentBuilderPayload) return;

    try {
      await updateSavedRequestApi(selectedCollectionId, updatingRequestWithBuilder.id, {
        method: currentBuilderPayload.method || 'GET',
        url: currentBuilderPayload.url,
        headers: currentBuilderPayload.headers,
        queryParams: currentBuilderPayload.queryParams,
        body: currentBuilderPayload.body,
        auth: currentBuilderPayload.auth,
      });

      playSound('requestSuccess');
      showFeedback(`Solicitud '${updatingRequestWithBuilder.name}' sincronizada con el Request Builder.`);
      setUpdatingRequestWithBuilder(null);
      await loadCollectionDetails(selectedCollectionId);
    } catch (err) {
      playSound('requestError');
      setError(err instanceof Error ? err.message : 'Error al sobrescribir la solicitud.');
    }
  };

  // 7. CARGAR SOLICITUD EN EL REQUEST BUILDER
  const handleLoadRequestIntoBuilder = (saved: SavedRequestData) => {
    const payload: ExecuteRequestPayload = {
      url: saved.url,
      method: saved.method,
      headers: saved.headers,
      queryParams: saved.queryParams,
      body: saved.body,
      auth: saved.auth,
    };

    playSound('requestSuccess');
    onLoadIntoBuilder(payload);
    onNavigateToBuilder();
  };

  // 8. ELIMINAR SOLICITUD GUARDADA
  const handleDeleteSavedRequest = async () => {
    if (!selectedCollectionId || !deletingRequest) return;

    try {
      await deleteSavedRequestApi(selectedCollectionId, deletingRequest.id);
      playSound('requestSuccess');
      showFeedback(`Solicitud '${deletingRequest.name}' eliminada.`);
      setDeletingRequest(null);
      await loadCollectionDetails(selectedCollectionId);
      await loadCollections();
    } catch (err) {
      playSound('requestError');
      setError(err instanceof Error ? err.message : 'Error al eliminar la solicitud.');
    }
  };

  // Filtrado por buscador
  const filteredCollections = collections.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredRequests = selectedCollection?.requests.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.method.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSavedRequests = collections.reduce((acc, c) => acc + c.requestsCount, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Banner Superior Holográfico Hunter */}
      <div className="holo-panel rounded-xl p-5 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-cyan-500/20 shadow-[0_0_25px_rgba(6,182,212,0.08)]">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400 uppercase tracking-widest">
            <FolderArchive className="h-4 w-4 text-cyan-400 animate-pulse" />
            <span>SISTEMA DE COLECCIONES // BIBLIOTECA DE MISIONES</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide flex items-center gap-2">
            <span>COLECCIONES DE SOLICITUDES</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40">
              FASE 1D
            </span>
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Organiza solicitudes HTTP en carpetas temáticas persistidas en SQLite. Tus credenciales sensibles son
            redactadas de forma transparente con el marcador seguro <code className="text-cyan-300">[VALOR_PROTEGIDO]</code>.
          </p>
        </div>

        {/* Telemetría y Acciones Rápidas */}
        <div className="flex flex-wrap items-center gap-3 z-10">
          <div className="px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-right">
            <div className="text-[10px] font-mono text-cyan-400/70 uppercase">COLECCIONES</div>
            <div className="text-sm font-extrabold text-cyan-300 font-mono">
              {collections.length}
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-purple-950/40 border border-purple-500/30 text-right">
            <div className="text-[10px] font-mono text-purple-400/70 uppercase">SOLICITUDES</div>
            <div className="text-sm font-extrabold text-purple-300 font-mono">
              {totalSavedRequests}
            </div>
          </div>
          <button
            onClick={() => {
              setNewColName('');
              setNewColDescription('');
              setIsCreateColModalOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-mono text-xs font-black tracking-wider transition flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
          >
            <FolderPlus className="h-4 w-4" />
            <span>NUEVA COLECCIÓN</span>
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

      {/* Barra de Filtro y Búsqueda */}
      <div className="p-3 rounded-xl holo-panel border border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="h-4 w-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              selectedCollection
                ? 'Buscar por nombre, URL o método...'
                : 'Buscar colecciones por nombre...'
            }
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#050811]/90 border border-cyan-500/20 focus:border-cyan-400 focus:outline-none text-xs font-mono text-cyan-100 placeholder:text-slate-600 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {selectedCollection && (
            <button
              onClick={handleBackToOverview}
              className="px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 font-mono text-xs font-bold transition flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>VOLVER A COLECCIONES</span>
            </button>
          )}

          <button
            onClick={() => (selectedCollectionId ? loadCollectionDetails(selectedCollectionId) : loadCollections())}
            title="Recargar datos"
            className="p-2 rounded-lg border border-cyan-500/20 bg-[#050811] hover:bg-cyan-950/30 text-cyan-400 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading || loadingDetails ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* VISTA 1: DETALLE DE COLECCIÓN SELECCIONADA */}
      {selectedCollection ? (
        <div className="space-y-4">
          {/* Cabecera de la Colección Abierta */}
          <div className="p-4 rounded-xl bg-[#070b16] border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <span className="cursor-pointer hover:underline" onClick={handleBackToOverview}>
                  Colecciones
                </span>
                <span>/</span>
                <span className="text-white font-bold">{selectedCollection.name}</span>
              </div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{selectedCollection.name}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {selectedCollection.requests.length} guardadas
                </span>
              </h3>
              {selectedCollection.description && (
                <p className="text-xs text-slate-400">{selectedCollection.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenAddRequestModal}
                className="px-3.5 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold transition flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>AÑADIR SOLICITUD</span>
              </button>

              <button
                onClick={() => handleOpenEditCollection(selectedCollection)}
                className="p-2 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-cyan-950/40 text-slate-300 hover:text-cyan-300 transition"
                title="Editar colección"
              >
                <Edit2 className="h-4 w-4" />
              </button>

              <button
                onClick={() => setDeletingCollection(selectedCollection)}
                className="p-2 rounded-lg border border-rose-500/30 bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 transition"
                title="Eliminar colección"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Listado de Solicitudes de la Colección */}
          {loadingDetails ? (
            <div className="p-12 text-center text-cyan-400 font-mono text-xs space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-cyan-400" />
              <p>Cargando misiones de la colección...</p>
            </div>
          ) : filteredRequests && filteredRequests.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {filteredRequests.map((req) => {
                const methodColor = METHOD_COLORS[req.method] || METHOD_COLORS.GET;
                return (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl bg-[#050811]/90 border border-cyan-500/20 hover:border-cyan-500/50 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase border ${methodColor.bg} ${methodColor.text} ${methodColor.border}`}
                        >
                          {req.method}
                        </span>
                        <span className="font-bold text-slate-100 text-sm truncate">{req.name}</span>
                        {req.hasProtectedSecrets && (
                          <span
                            title="Contiene credenciales protegidas con [VALOR_PROTEGIDO]"
                            className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          >
                            <ShieldAlert className="h-3 w-3 text-amber-400" />
                            <span>SECRETOS PROTEGIDOS</span>
                          </span>
                        )}
                      </div>

                      {/* URL y detalles técnicos */}
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                        <span className="text-cyan-300/90 truncate max-w-xl">{req.url}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-slate-500">
                        {req.headers && Object.keys(req.headers).length > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                            {Object.keys(req.headers).length} cabeceras
                          </span>
                        )}
                        {req.queryParams && Object.keys(req.queryParams).length > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                            {Object.keys(req.queryParams).length} params
                          </span>
                        )}
                        {req.body && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                            Cuerpo configurado
                          </span>
                        )}
                        <span>•</span>
                        <span>Actualizada: {new Date(req.updatedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* Botones de acción para cada solicitud */}
                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                      {/* Cargar en Request Builder */}
                      <button
                        onClick={() => handleLoadRequestIntoBuilder(req)}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-indigo-600/20 hover:from-cyan-500/30 hover:to-indigo-600/30 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold transition flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                        title="Cargar en el Request Builder"
                      >
                        <Send className="h-3 w-3" />
                        <span>CARGAR</span>
                      </button>

                      {/* Actualizar con estado actual del Builder */}
                      {currentBuilderPayload && (
                        <button
                          onClick={() => setUpdatingRequestWithBuilder(req)}
                          className="px-2.5 py-1.5 rounded-lg border border-purple-500/30 bg-purple-950/20 hover:bg-purple-900/30 text-purple-300 font-mono text-xs transition flex items-center gap-1"
                          title="Sobrescribir con la configuración actual del Request Builder"
                        >
                          <RotateCw className="h-3 w-3" />
                          <span>SINCRONIZAR</span>
                        </button>
                      )}

                      {/* Editar Nombre */}
                      <button
                        onClick={() => handleOpenEditRequest(req)}
                        className="p-1.5 rounded-lg border border-slate-800 hover:border-cyan-500/40 bg-[#070b16] text-slate-400 hover:text-cyan-300 transition"
                        title="Editar nombre"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      {/* Eliminar Solicitud */}
                      <button
                        onClick={() => setDeletingRequest(req)}
                        className="p-1.5 rounded-lg border border-rose-500/30 hover:border-rose-500 bg-[#070b16] text-rose-400 hover:text-rose-300 transition"
                        title="Eliminar de la colección"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 rounded-xl bg-[#050811]/60 border border-dashed border-cyan-500/20 text-center space-y-3">
              <Layers className="h-8 w-8 text-cyan-500/40 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-200">Esta colección está vacía</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Añade misiones guardadas desde el Request Builder actual o crea una solicitud personalizada.
                </p>
              </div>
              <button
                onClick={handleOpenAddRequestModal}
                className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold transition inline-flex items-center gap-2"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>GUARDAR PRIMERA SOLICITUD</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* VISTA 2: LISTA DE TODAS LAS COLECCIONES */
        <div>
          {loading ? (
            <div className="p-16 text-center text-cyan-400 font-mono text-xs space-y-2">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-cyan-400" />
              <p>Cargando colecciones desde SQLite...</p>
            </div>
          ) : filteredCollections.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCollections.map((col) => (
                <div
                  key={col.id}
                  className="p-5 rounded-xl bg-[#070b16]/90 border border-cyan-500/20 hover:border-cyan-500/50 transition flex flex-col justify-between space-y-4 group relative overflow-hidden"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-9 w-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        <FolderArchive className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditCollection(col)}
                          className="p-1.5 rounded-lg border border-transparent hover:border-cyan-500/30 hover:bg-cyan-950/40 text-slate-400 hover:text-cyan-300 transition"
                          title="Editar colección"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingCollection(col)}
                          className="p-1.5 rounded-lg border border-transparent hover:border-rose-500/30 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition"
                          title="Eliminar colección"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3
                        onClick={() => handleOpenCollection(col.id)}
                        className="font-bold text-white text-base group-hover:text-cyan-300 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="truncate">{col.name}</span>
                        <ChevronRight className="h-4 w-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition" />
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                        {col.description || 'Sin descripción asignada.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-900 flex items-center justify-between text-xs font-mono">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {col.requestsCount} {col.requestsCount === 1 ? 'solicitud' : 'solicitudes'}
                    </span>

                    <button
                      onClick={() => handleOpenCollection(col.id)}
                      className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 text-[11px]"
                    >
                      <span>EXPLORAR</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 rounded-xl bg-[#050811]/70 border border-dashed border-cyan-500/20 text-center space-y-4">
              <FolderArchive className="h-10 w-10 text-cyan-500/40 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">No hay colecciones registradas</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Crea tu primera colección para agrupar misiones HTTP, guardar encabezados y reejecutar consultas en cualquier momento.
                </p>
              </div>
              <button
                onClick={() => {
                  setNewColName('');
                  setNewColDescription('');
                  setIsCreateColModalOpen(true);
                }}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-mono text-xs font-black tracking-wider transition inline-flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                <FolderPlus className="h-4 w-4" />
                <span>CREAR PRIMERA COLECCIÓN</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODALES DEL SISTEMA HUNTER
         ===================================================================== */}

      {/* MODAL 1: CREAR COLECCIÓN */}
      {isCreateColModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#070b16] border border-cyan-500/40 rounded-xl p-5 w-full max-w-md space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.2)] animate-fadeIn">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono">NUEVA COLECCIÓN</h3>
              </div>
              <button
                onClick={() => setIsCreateColModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCollection} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-cyan-400 uppercase mb-1">
                  Nombre de la Colección <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="Ej: Autenticación OAuth, Misiones de Usuario..."
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
                  value={newColDescription}
                  onChange={(e) => setNewColDescription(e.target.value)}
                  placeholder="Detalles sobre las solicitudes agrupadas en esta colección..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-cyan-500/30 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => setIsCreateColModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 font-mono text-xs hover:bg-slate-800 transition"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={!newColName.trim()}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition disabled:opacity-50"
                >
                  CREAR COLECCIÓN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR COLECCIÓN */}
      {editingCollection && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#070b16] border border-cyan-500/40 rounded-xl p-5 w-full max-w-md space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.2)] animate-fadeIn">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono">EDITAR COLECCIÓN</h3>
              </div>
              <button
                onClick={() => setEditingCollection(null)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCollection} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-cyan-400 uppercase mb-1">
                  Nombre de la Colección <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={editColName}
                  onChange={(e) => setEditColName(e.target.value)}
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
                  value={editColDescription}
                  onChange={(e) => setEditColDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-cyan-500/30 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => setEditingCollection(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 font-mono text-xs hover:bg-slate-800 transition"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={!editColName.trim()}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition disabled:opacity-50"
                >
                  GUARDAR CAMBIOS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRMAR ELIMINACIÓN DE COLECCIÓN */}
      {deletingCollection && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#070b16] border border-rose-500/50 rounded-xl p-5 w-full max-w-md space-y-4 shadow-[0_0_30px_rgba(244,63,94,0.25)] animate-fadeIn">
            <div className="flex items-center gap-3 text-rose-400 border-b border-rose-500/20 pb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  ¿ELIMINAR COLECCIÓN?
                </h3>
                <p className="text-[11px] font-mono text-rose-300">ACCIÓN DESTRUIDORA EN CASCADA</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                Estás a punto de eliminar la colección{' '}
                <strong className="text-cyan-300">{deletingCollection.name}</strong>.
              </p>
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-[11px] text-rose-200">
                ⚠️ <strong>Aviso de Claves Foráneas:</strong> Todas las{' '}
                <strong>{deletingCollection.requestsCount} solicitudes guardadas</strong> dentro de
                esta colección serán eliminadas permanentemente de la base de datos SQLite.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingCollection(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 font-mono text-xs hover:bg-slate-800 transition"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleDeleteCollection}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition shadow-[0_0_15px_rgba(244,63,94,0.4)]"
              >
                SÍ, ELIMINAR COLECCIÓN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: AÑADIR SOLICITUD A COLECCIÓN */}
      {isAddRequestModalOpen && selectedCollection && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#070b16] border border-cyan-500/40 rounded-xl p-5 w-full max-w-lg space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.2)] animate-fadeIn">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  GUARDAR EN {selectedCollection.name}
                </h3>
              </div>
              <button
                onClick={() => setIsAddRequestModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRequest} className="space-y-4">
              {currentBuilderPayload && (
                <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-200">Usar estado del Request Builder</span>
                    <p className="text-[11px] text-cyan-400 font-mono">
                      {currentBuilderPayload.method || 'GET'} {currentBuilderPayload.url}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={useCurrentBuilderValues}
                    onChange={(e) => setUseCurrentBuilderValues(e.target.checked)}
                    className="h-4 w-4 rounded border-cyan-500 bg-slate-900 text-cyan-500 focus:ring-0"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono text-cyan-400 uppercase mb-1">
                  Nombre Descriptivo de la Solicitud <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newReqName}
                  onChange={(e) => setNewReqName(e.target.value)}
                  placeholder="Ej: Obtener Perfil de Usuario..."
                  required
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-cyan-500/30 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              {!useCurrentBuilderValues && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-mono text-cyan-400 uppercase mb-1">
                        Método
                      </label>
                      <select
                        value={newReqMethod}
                        onChange={(e) => setNewReqMethod(e.target.value as HttpMethod)}
                        className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-cyan-500/30 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                      >
                        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[11px] font-mono text-cyan-400 uppercase mb-1">
                        URL de Destino
                      </label>
                      <input
                        type="text"
                        value={newReqUrl}
                        onChange={(e) => setNewReqUrl(e.target.value)}
                        placeholder="https://api.ejemplo.com/recurso"
                        required
                        className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-cyan-500/30 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <Lock className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Escudo de Seguridad Activo:</strong> Cualquier token Bearer, contraseña en URL o
                  cabecera sensible será redactado automáticamente antes de guardarse en SQLite.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => setIsAddRequestModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 font-mono text-xs hover:bg-slate-800 transition"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={!newReqName.trim()}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition disabled:opacity-50"
                >
                  GUARDAR SOLICITUD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: EDITAR NOMBRE DE SOLICITUD */}
      {editingRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#070b16] border border-cyan-500/40 rounded-xl p-5 w-full max-w-md space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.2)] animate-fadeIn">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono">EDITAR SOLICITUD</h3>
              </div>
              <button
                onClick={() => setEditingRequest(null)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSavedRequestName} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-cyan-400 uppercase mb-1">
                  Nombre de la Solicitud <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={editReqName}
                  onChange={(e) => setEditReqName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-cyan-500/30 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => setEditingRequest(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 font-mono text-xs hover:bg-slate-800 transition"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={!editReqName.trim()}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition disabled:opacity-50"
                >
                  GUARDAR NOMBRE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: CONFIRMAR ACTUALIZACIÓN CON REQUEST BUILDER */}
      {updatingRequestWithBuilder && currentBuilderPayload && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#070b16] border border-purple-500/50 rounded-xl p-5 w-full max-w-md space-y-4 shadow-[0_0_30px_rgba(168,85,247,0.25)] animate-fadeIn">
            <div className="flex items-center gap-3 text-purple-400 border-b border-purple-500/20 pb-3">
              <RotateCw className="h-6 w-6 shrink-0 text-purple-400 animate-spin" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  SINCRONIZAR CON BUILDER
                </h3>
                <p className="text-[11px] font-mono text-purple-300">SOBREESCRITURA DE CONFIGURACIÓN</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                ¿Deseas sobrescribir los parámetros, cabeceras y URL de{' '}
                <strong className="text-cyan-300">{updatingRequestWithBuilder.name}</strong> con el
                estado actual del Request Builder?
              </p>
              <div className="p-3 rounded-lg bg-[#050811] border border-purple-500/30 text-[11px] font-mono text-slate-300 space-y-1">
                <div className="text-purple-400 font-bold">Nuevos Valores:</div>
                <div>Método: <span className="text-cyan-300">{currentBuilderPayload.method || 'GET'}</span></div>
                <div className="truncate">URL: <span className="text-cyan-300">{currentBuilderPayload.url}</span></div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setUpdatingRequestWithBuilder(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 font-mono text-xs hover:bg-slate-800 transition"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleConfirmUpdateWithBuilder}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition shadow-[0_0_15px_rgba(168,85,247,0.4)]"
              >
                SÍ, SINCRONIZAR SOLICITUD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: CONFIRMAR ELIMINACIÓN DE SOLICITUD */}
      {deletingRequest && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#070b16] border border-rose-500/50 rounded-xl p-5 w-full max-w-md space-y-4 shadow-[0_0_30px_rgba(244,63,94,0.25)] animate-fadeIn">
            <div className="flex items-center gap-3 text-rose-400 border-b border-rose-500/20 pb-3">
              <Trash2 className="h-6 w-6 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  ¿ELIMINAR SOLICITUD?
                </h3>
                <p className="text-[11px] font-mono text-rose-300">ELIMINAR DE LA COLECCIÓN</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                ¿Confirmas la eliminación de la solicitud{' '}
                <strong className="text-cyan-300">{deletingRequest.name}</strong>?
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                {deletingRequest.method} {deletingRequest.url}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingRequest(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 font-mono text-xs hover:bg-slate-800 transition"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleDeleteSavedRequest}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition shadow-[0_0_15px_rgba(244,63,94,0.4)]"
              >
                SÍ, ELIMINAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
