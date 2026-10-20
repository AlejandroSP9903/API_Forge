/**
 * API Forge - Panel de Gestión de Proyectos (Fase 2A)
 * Estética Hunter System inspirada en Solo Leveling con persistencia SQLite y Drizzle ORM.
 * Permite gestionar proyectos y asociar/desasociar colecciones existentes sin perder solicitudes guardadas.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderKanban,
  FolderPlus,
  Plus,
  Trash2,
  Edit2,
  FolderArchive,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Layers,
  Sparkles,
  Database,
  Unlink,
  ChevronRight,
  ExternalLink,
  Shield,
  FileCode,
} from 'lucide-react';
import type {
  ProjectSummary,
  ProjectWithCollections,
  CollectionSummary,
} from '../../packages/shared/types.ts';
import {
  fetchProjects,
  fetchProjectById,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi,
  associateCollectionToProjectApi,
  dissociateCollectionFromProjectApi,
} from '../services/projectsService.ts';
import { fetchCollections } from '../services/collectionsService.ts';
import { playSound } from '../services/audioService.ts';

interface ProjectsPanelProps {
  onOpenCollection: (collectionId: string) => void;
  onProjectsCountChange?: (count: number) => void;
}

export function ProjectsPanel({
  onOpenCollection,
  onProjectsCountChange,
}: ProjectsPanelProps) {
  // Lista de proyectos
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Proyecto seleccionado para vista de detalle
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectWithCollections | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Modales de Proyecto
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectDescription, setNewProjectDescription] = useState<string>('');
  const [creatingProject, setCreatingProject] = useState<boolean>(false);

  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);
  const [editProjectName, setEditProjectName] = useState<string>('');
  const [editProjectDescription, setEditProjectDescription] = useState<string>('');
  const [updatingProject, setUpdatingProject] = useState<boolean>(false);

  const [deletingProject, setDeletingProject] = useState<ProjectSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Modal para asociar colección existente
  const [isAssociateModalOpen, setIsAssociateModalOpen] = useState<boolean>(false);
  const [allAvailableCollections, setAllAvailableCollections] = useState<CollectionSummary[]>([]);
  const [selectedCollectionToAssociate, setSelectedCollectionToAssociate] = useState<string>('');
  const [loadingAssociateList, setLoadingAssociateList] = useState<boolean>(false);
  const [associatingCollection, setAssociatingCollection] = useState<boolean>(false);

  // Modal para desasociar colección
  const [collectionToDissociate, setCollectionToDissociate] = useState<CollectionSummary | null>(null);
  const [isDissociating, setIsDissociating] = useState<boolean>(false);

  // Cargar proyectos desde el backend
  const loadProjects = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchProjects();
      setProjects(data);
      onProjectsCountChange?.(data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los proyectos.');
      playSound('requestError');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onProjectsCountChange]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Cargar detalles de un proyecto seleccionado
  const loadProjectDetails = useCallback(async (id: string, silent = false) => {
    if (!silent) setLoadingDetails(true);
    try {
      const data = await fetchProjectById(id);
      setSelectedProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener detalles del proyecto.');
      playSound('requestError');
    } finally {
      if (!silent) setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectDetails(selectedProjectId);
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId, loadProjectDetails]);

  // Mostrar mensaje de feedback temporal
  const triggerFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
  };

  // Crear proyecto
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreatingProject(true);
    try {
      const created = await createProjectApi({
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
      });

      playSound('requestSuccess');
      triggerFeedback(`Proyecto "${created.name}" creado y registrado en SQLite.`);
      setIsCreateModalOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      await loadProjects(true);
      // Abrir directamente el proyecto creado
      setSelectedProjectId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear proyecto.');
      playSound('requestError');
    } finally {
      setCreatingProject(false);
    }
  };

  // Abrir modal de edición
  const handleOpenEditModal = (proj: ProjectSummary, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingProject(proj);
    setEditProjectName(proj.name);
    setEditProjectDescription(proj.description || '');
  };

  // Guardar edición de proyecto
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editProjectName.trim()) return;

    setUpdatingProject(true);
    try {
      const updated = await updateProjectApi(editingProject.id, {
        name: editProjectName.trim(),
        description: editProjectDescription.trim() || undefined,
      });

      playSound('requestSuccess');
      triggerFeedback(`Proyecto "${updated.name}" actualizado correctamente.`);
      setEditingProject(null);
      await loadProjects(true);
      if (selectedProjectId === updated.id) {
        await loadProjectDetails(updated.id, true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar proyecto.');
      playSound('requestError');
    } finally {
      setUpdatingProject(false);
    }
  };

  // Eliminar proyecto
  const handleDeleteProject = async () => {
    if (!deletingProject) return;

    setIsDeleting(true);
    try {
      await deleteProjectApi(deletingProject.id);
      playSound('requestStart');
      triggerFeedback(
        `Proyecto "${deletingProject.name}" eliminado. Sus colecciones permanecen intactas en el sistema.`
      );
      if (selectedProjectId === deletingProject.id) {
        setSelectedProjectId(null);
      }
      setDeletingProject(null);
      await loadProjects(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar proyecto.');
      playSound('requestError');
    } finally {
      setIsDeleting(false);
    }
  };

  // Abrir modal para asociar colección
  const handleOpenAssociateModal = async () => {
    if (!selectedProjectId) return;
    setIsAssociateModalOpen(true);
    setLoadingAssociateList(true);
    setSelectedCollectionToAssociate('');
    try {
      const cols = await fetchCollections();
      setAllAvailableCollections(cols);
      // Preseleccionar la primera colección no asociada a este proyecto
      const firstAvailable = cols.find((c) => c.projectId !== selectedProjectId);
      if (firstAvailable) {
        setSelectedCollectionToAssociate(firstAvailable.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar lista de colecciones.');
    } finally {
      setLoadingAssociateList(false);
    }
  };

  // Ejecutar asociación de colección
  const handleAssociateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedCollectionToAssociate) return;

    setAssociatingCollection(true);
    try {
      await associateCollectionToProjectApi(selectedProjectId, selectedCollectionToAssociate);
      playSound('requestSuccess');
      triggerFeedback('Colección asociada exitosamente al proyecto.');
      setIsAssociateModalOpen(false);
      await loadProjectDetails(selectedProjectId, true);
      await loadProjects(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asociar colección.');
      playSound('requestError');
    } finally {
      setAssociatingCollection(false);
    }
  };

  // Ejecutar desasociación de colección
  const handleDissociateCollection = async () => {
    if (!selectedProjectId || !collectionToDissociate) return;

    setIsDissociating(true);
    try {
      await dissociateCollectionFromProjectApi(selectedProjectId, collectionToDissociate.id);
      playSound('requestStart');
      triggerFeedback(
        `Colección "${collectionToDissociate.name}" desasociada del proyecto. Conserva todas sus solicitudes.`
      );
      setCollectionToDissociate(null);
      await loadProjectDetails(selectedProjectId, true);
      await loadProjects(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desasociar colección.');
      playSound('requestError');
    } finally {
      setIsDissociating(false);
    }
  };

  // Filtrado de proyectos para búsqueda
  const filteredProjects = projects.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.description && p.description.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Banner Principal / Hunter Header */}
      <div className="holo-panel rounded-xl p-4 sm:p-5 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400 uppercase tracking-widest">
            <FolderKanban className="h-3.5 w-3.5 text-cyan-400" />
            <span>CENTRO DE GESTIÓN // PROYECTOS & WORKSPACES</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-wide flex items-center gap-2">
            PROYECTOS DEL SISTEMA
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              FASE 2A
            </span>
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Organiza tus misiones en proyectos de alto rango. Agrupa colecciones existentes con persistencia garantizada en SQLite y claves foráneas administradas.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => loadProjects()}
            className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-cyan-500/20 text-slate-300 hover:text-cyan-400 transition"
            title="Refrescar proyectos"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={() => {
              playSound('requestStart');
              setIsCreateModalOpen(true);
            }}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition"
          >
            <FolderPlus className="h-4 w-4" />
            <span>NUEVO PROYECTO</span>
          </button>
        </div>
      </div>

      {/* Alerta de Feedback Temporal */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 flex items-center gap-3 text-xs text-cyan-200 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Alerta de Error */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/40 flex items-center justify-between gap-3 text-xs text-rose-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-200 font-mono text-[10px] underline"
          >
            CERRAR
          </button>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL: O BIEN VISTA DE DETALLE O VISTA DE LISTA */}
      {selectedProjectId && selectedProject ? (
        /* ==========================================================================
         * VISTA DETALLE DEL PROYECTO SELECCIONADO
         * ========================================================================== */
        <div className="space-y-6">
          {/* Barra superior de navegación interna */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-cyan-500/20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  playSound('requestStart');
                  setSelectedProjectId(null);
                }}
                className="p-2 rounded-lg bg-slate-900 hover:bg-cyan-950/40 border border-cyan-500/20 text-slate-300 hover:text-cyan-400 transition flex items-center gap-1.5 text-xs font-mono"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>VOLVER A PROYECTOS</span>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    PROYECTO ACTIVO
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    ID: {selectedProject.id}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white tracking-wide mt-0.5">
                  {selectedProject.name}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => handleOpenEditModal(selectedProject)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/20 text-xs font-semibold text-slate-200 hover:text-cyan-400 transition flex items-center gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>EDITAR</span>
              </button>
              <button
                onClick={() => setDeletingProject(selectedProject)}
                className="px-3 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30 text-xs font-semibold text-rose-300 hover:text-rose-100 transition flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                <span>ELIMINAR PROYECTO</span>
              </button>
            </div>
          </div>

          {/* Tarjeta de Información General del Proyecto */}
          <div className="holo-panel rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-300 whitespace-pre-wrap">
                  {selectedProject.description || 'Sin descripción registrada para este proyecto.'}
                </p>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] font-mono text-slate-400">
                  <div>
                    Creado:{' '}
                    <span className="text-slate-200">
                      {new Date(selectedProject.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {selectedProject.updatedAt && (
                    <div>
                      Actualizado:{' '}
                      <span className="text-slate-200">
                        {new Date(selectedProject.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div>
                    Colecciones asociadas:{' '}
                    <span className="text-cyan-400 font-bold">
                      {selectedProject.collections.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sección: Colecciones Asociadas al Proyecto */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderArchive className="h-4 w-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                  COLECCIONES ASOCIADAS AL PROYECTO ({selectedProject.collections.length})
                </h4>
              </div>
              <button
                onClick={() => {
                  playSound('requestStart');
                  handleOpenAssociateModal();
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 text-xs font-bold text-cyan-300 hover:text-cyan-200 transition flex items-center gap-2 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
              >
                <Plus className="h-3.5 w-3.5 text-cyan-400" />
                <span>ASOCIAR COLECCIÓN EXISTENTE</span>
              </button>
            </div>

            {loadingDetails ? (
              <div className="p-8 text-center text-xs font-mono text-cyan-400/70 animate-pulse">
                [CARGANDO COLECCIONES ASOCIADAS DESDE SQLITE...]
              </div>
            ) : selectedProject.collections.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-cyan-500/20 bg-slate-950/40 text-center space-y-3">
                <FolderArchive className="h-8 w-8 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-300">
                  No hay colecciones asociadas a este proyecto
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Puedes asociar colecciones existentes sin modificar sus solicitudes guardadas. Cada colección puede pertenecer a un proyecto.
                </p>
                <button
                  onClick={() => {
                    playSound('requestStart');
                    handleOpenAssociateModal();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-semibold text-cyan-300 transition"
                >
                  Asociar Colección Ahora
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedProject.collections.map((col) => (
                  <div
                    key={col.id}
                    className="p-4 rounded-xl bg-slate-950/70 border border-cyan-500/20 hover:border-cyan-500/40 transition group flex flex-col justify-between space-y-3 shadow-lg"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FolderArchive className="h-4 w-4 text-cyan-400 shrink-0" />
                          <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition line-clamp-1">
                            {col.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                          {col.requestsCount} {col.requestsCount === 1 ? 'misión' : 'misiones'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {col.description || 'Sin descripción.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-cyan-500/10 flex items-center justify-between text-xs">
                      <div className="text-[10px] font-mono text-slate-500">
                        {new Date(col.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            playSound('requestStart');
                            setCollectionToDissociate(col);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-[11px] font-mono transition flex items-center gap-1"
                          title="Desasociar del proyecto (la colección no se elimina)"
                        >
                          <Unlink className="h-3 w-3" />
                          <span>Desasociar</span>
                        </button>
                        <button
                          onClick={() => {
                            playSound('requestStart');
                            onOpenCollection(col.id);
                          }}
                          className="px-3 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 text-[11px] font-mono transition flex items-center gap-1.5 font-bold"
                          title="Abrir colección y explorar sus solicitudes guardadas"
                        >
                          <span>Abrir Colección</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==========================================================================
         * VISTA DE LISTA DE PROYECTOS
         * ========================================================================== */
        <div className="space-y-4">
          {/* Buscador de Proyectos */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar proyecto por nombre o descripción..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950/70 border border-cyan-500/20 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 transition"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs font-mono text-cyan-400/70 animate-pulse">
              [CONSULTANDO PROYECTOS EN SQLITE (DRIZZLE ORM)...]
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-12 rounded-xl border border-dashed border-cyan-500/20 bg-slate-950/40 text-center space-y-3">
              <FolderKanban className="h-10 w-10 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">
                {searchTerm ? 'No se encontraron proyectos con ese criterio' : 'No hay proyectos creados aún'}
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Crea tu primer proyecto para organizar colecciones de solicitudes HTTP en API Forge.
              </p>
              {!searchTerm && (
                <button
                  onClick={() => {
                    playSound('requestStart');
                    setIsCreateModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs tracking-wider transition shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  Crear Primer Proyecto
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => {
                    playSound('requestStart');
                    setSelectedProjectId(proj.id);
                  }}
                  className="p-4 rounded-xl bg-slate-950/70 border border-cyan-500/20 hover:border-cyan-500/50 transition cursor-pointer group flex flex-col justify-between space-y-3 shadow-lg relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-cyan-500/10 transition" />

                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 group-hover:text-cyan-300 transition">
                          <FolderKanban className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition line-clamp-1">
                          {proj.name}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                        {proj.collectionsCount || 0} {proj.collectionsCount === 1 ? 'colección' : 'colecciones'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 min-h-[2rem]">
                      {proj.description || 'Sin descripción registrada.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-cyan-500/10 flex items-center justify-between text-xs">
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(proj.createdAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleOpenEditModal(proj, e)}
                        className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition"
                        title="Editar nombre y descripción"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProject(proj);
                        }}
                        className="p-1.5 rounded hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 transition"
                        title="Eliminar proyecto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="h-3 w-px bg-slate-800 mx-0.5" />
                      <div className="text-cyan-400 flex items-center gap-0.5 text-xs font-mono font-bold group-hover:translate-x-0.5 transition">
                        <span>ABRIR</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==========================================================================
       * MODAL 1: CREAR PROYECTO
       * ========================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-xl bg-[#090d1a] border border-cyan-500/40 p-5 space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.25)]">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                  CREAR NUEVO PROYECTO
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-cyan-300 uppercase">
                  Nombre del Proyecto *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="ej. Core Gateway API / Portal de Pagos"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-cyan-500/30 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-cyan-300 uppercase">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="Propósito del proyecto, servicios involucrados, etc."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-cyan-500/30 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 font-mono transition"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={creatingProject || !newProjectName.trim()}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs tracking-wider transition disabled:opacity-50"
                >
                  {creatingProject ? 'CREANDO...' : 'CONFIRMAR Y CREAR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
       * MODAL 2: EDITAR PROYECTO
       * ========================================================================== */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-xl bg-[#090d1a] border border-cyan-500/40 p-5 space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.25)]">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                  EDITAR PROYECTO
                </h3>
              </div>
              <button
                onClick={() => setEditingProject(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-cyan-300 uppercase">
                  Nombre del Proyecto *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-cyan-500/30 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-cyan-300 uppercase">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={editProjectDescription}
                  onChange={(e) => setEditProjectDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-cyan-500/30 text-xs text-white focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 font-mono transition"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={updatingProject || !editProjectName.trim()}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs tracking-wider transition disabled:opacity-50"
                >
                  {updatingProject ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
       * MODAL 3: CONFIRMAR ELIMINACIÓN DE PROYECTO
       * ========================================================================== */}
      {deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-xl bg-[#090d1a] border border-rose-500/40 p-5 space-y-4 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  ¿ELIMINAR PROYECTO?
                </h3>
                <p className="text-[11px] font-mono text-rose-400/80">ACCION SEGURA // PRESERVACIÓN DE COLECCIONES</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-rose-500/20 text-xs text-slate-300 space-y-2">
              <div>
                Estás a punto de eliminar el proyecto{' '}
                <strong className="text-white">"{deletingProject.name}"</strong>.
              </div>
              <div className="text-emerald-400 font-medium">
                ✓ Las colecciones asociadas se conservarán intactas en SQLite y quedarán desasociadas.
              </div>
              <div className="text-emerald-400 font-medium">
                ✓ No se perderá ninguna solicitud guardada ni ejecución de misiones.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-500/20">
              <button
                type="button"
                onClick={() => setDeletingProject(null)}
                className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 font-mono transition"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs tracking-wider transition disabled:opacity-50"
              >
                {isDeleting ? 'ELIMINANDO...' : 'CONFIRMAR ELIMINACIÓN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
       * MODAL 4: ASOCIAR COLECCIÓN EXISTENTE AL PROYECTO
       * ========================================================================== */}
      {isAssociateModalOpen && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-xl bg-[#090d1a] border border-cyan-500/40 p-5 space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.25)]">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <FolderArchive className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                  ASOCIAR COLECCIÓN A "{selectedProject.name}"
                </h3>
              </div>
              <button
                onClick={() => setIsAssociateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            {loadingAssociateList ? (
              <div className="p-8 text-center text-xs font-mono text-cyan-400 animate-pulse">
                [CARGANDO COLECCIONES DISPONIBLES...]
              </div>
            ) : allAvailableCollections.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <div>No hay colecciones creadas en el sistema todavía.</div>
                <p className="text-slate-500 text-[11px]">
                  Crea primero una colección desde la pestaña COLECCIONES para poder asociarla.
                </p>
              </div>
            ) : (
              <form onSubmit={handleAssociateCollection} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-mono text-cyan-300 uppercase">
                    Selecciona una Colección Existente:
                  </label>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {allAvailableCollections.map((col) => {
                      const isAssignedToThis = col.projectId === selectedProject.id;
                      const isAssignedToOther = col.projectId && col.projectId !== selectedProject.id;
                      const isSelected = selectedCollectionToAssociate === col.id;

                      return (
                        <div
                          key={col.id}
                          onClick={() => {
                            if (!isAssignedToOther) {
                              setSelectedCollectionToAssociate(col.id);
                            }
                          }}
                          className={`p-3 rounded-lg border text-xs transition cursor-pointer flex items-center justify-between ${
                            isAssignedToThis
                              ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-300'
                              : isAssignedToOther
                              ? 'bg-slate-950/40 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                              : isSelected
                              ? 'bg-gradient-to-r from-cyan-950/70 to-indigo-950/50 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                              : 'bg-slate-950/70 border-cyan-500/10 hover:border-cyan-500/30 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="collectionRadio"
                              checked={isSelected}
                              disabled={Boolean(isAssignedToOther)}
                              onChange={() => setSelectedCollectionToAssociate(col.id)}
                              className="text-cyan-500 focus:ring-0"
                            />
                            <div>
                              <div className="font-bold flex items-center gap-2">
                                <span>{col.name}</span>
                                {isAssignedToThis && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">
                                    YA ASOCIADA A ESTE PROYECTO
                                  </span>
                                )}
                                {isAssignedToOther && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                                    PERTENECE A OTRO PROYECTO
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 line-clamp-1">
                                {col.description || 'Sin descripción'} • {col.requestsCount || 0} misiones
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
                  <button
                    type="button"
                    onClick={() => setIsAssociateModalOpen(false)}
                    className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 font-mono transition"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    disabled={associatingCollection || !selectedCollectionToAssociate}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs tracking-wider transition disabled:opacity-50"
                  >
                    {associatingCollection ? 'ASOCIANDO...' : 'ASOCIAR AL PROYECTO'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
       * MODAL 5: CONFIRMAR DESASOCIACIÓN DE COLECCIÓN
       * ========================================================================== */}
      {collectionToDissociate && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-xl bg-[#090d1a] border border-cyan-500/40 p-5 space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
            <div className="flex items-center gap-3 text-cyan-400">
              <Unlink className="h-6 w-6 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  ¿DESASOCIAR COLECCIÓN?
                </h3>
                <p className="text-[11px] font-mono text-cyan-400/80">OPERACIÓN SIN PÉRDIDA DE DATOS</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-cyan-500/20 text-xs text-slate-300 space-y-2">
              <div>
                ¿Deseas desasociar la colección <strong className="text-white">"{collectionToDissociate.name}"</strong> del proyecto <strong className="text-white">"{selectedProject.name}"</strong>?
              </div>
              <div className="text-emerald-400 font-medium">
                ✓ La colección no será eliminada.
              </div>
              <div className="text-emerald-400 font-medium">
                ✓ Todas sus solicitudes guardadas ({collectionToDissociate.requestsCount}) continuarán existiendo intactas.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
              <button
                type="button"
                onClick={() => setCollectionToDissociate(null)}
                className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 font-mono transition"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleDissociateCollection}
                disabled={isDissociating}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs tracking-wider transition disabled:opacity-50"
              >
                {isDissociating ? 'DESASOCIANDO...' : 'CONFIRMAR DESASOCIACIÓN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
