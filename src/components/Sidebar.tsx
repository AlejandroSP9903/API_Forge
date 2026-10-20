/**
 * API Forge - Barra Lateral del Sistema Hunter (Fase 1B)
 * Diseño holográfico oscuro con estética inspirada en Solo Leveling
 */

import React from 'react';
import {
  Terminal,
  Crosshair,
  Shield,
  Activity,
  History,
  Zap,
  Radio,
  Server,
  Layers,
  Sliders,
  FolderArchive,
  FolderKanban,
  Globe,
} from 'lucide-react';
import type { ActiveNavTab } from '../types/hunter.ts';
import type { HealthCheckResponse } from '../../packages/shared/types.ts';

interface SidebarProps {
  activeTab: ActiveNavTab;
  onTabChange: (tab: ActiveNavTab) => void;
  healthData: HealthCheckResponse | null;
  historyCount: number;
  projectsCount?: number;
  collectionsCount?: number;
  environmentsCount?: number;
  clientPingMs: number | null;
  audioEnabled?: boolean;
}

export function Sidebar({
  activeTab,
  onTabChange,
  healthData,
  historyCount,
  projectsCount = 0,
  collectionsCount = 0,
  environmentsCount = 0,
  clientPingMs,
  audioEnabled,
}: SidebarProps) {
  const isOnline = healthData?.status === 'ok';

  return (
    <aside className="w-full lg:w-64 bg-[#070b16] border-b lg:border-b-0 lg:border-r border-cyan-500/20 flex flex-col shrink-0 select-none">
      {/* Cabecera / Identidad del Sistema */}
      <div className="p-5 border-b border-cyan-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-600 p-0.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center justify-center">
            <div className="h-full w-full bg-[#050811] rounded-[6px] flex items-center justify-center">
              <Zap className="h-5 w-5 text-cyan-400 animate-pulse" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400">
                API FORGE
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                S-RANK
              </span>
            </div>
            <p className="text-[11px] font-mono text-cyan-400/60 tracking-widest uppercase">
              HUNTER INTERFACE
            </p>
          </div>
        </div>

        {/* Panel de Perfil de Cazador Holográfico */}
        <div className="mt-4 p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-500/20 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[10px] font-mono text-cyan-400/70 uppercase">Cazador // Rol</div>
            <div className="text-xs font-bold text-slate-100 tracking-wide flex items-center gap-1.5">
              <span>DEVELOPER STUDENT</span>
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-cyan-400/70 uppercase">Nivel Sistema</div>
            <div className="text-xs font-extrabold text-purple-400 font-mono tracking-wider">
              FASE 2A
            </div>
          </div>
        </div>
      </div>

      {/* Menú de Navegación de Misiones */}
      <nav className="p-3 space-y-1.5 flex-1">
        <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-widest text-slate-500">
          // MENÚ PRINCIPAL
        </div>

        {/* 1. Request Builder */}
        <button
          onClick={() => onTabChange('builder')}
          className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition group relative ${
            activeTab === 'builder'
              ? 'bg-gradient-to-r from-cyan-950/60 to-indigo-950/40 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Crosshair className={`h-4 w-4 ${activeTab === 'builder' ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'}`} />
            <span>REQUEST BUILDER</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400/60">[QUEST]</span>
        </button>

        {/* 2. Projects (Fase 2A) */}
        <button
          onClick={() => onTabChange('projects')}
          className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition group relative ${
            activeTab === 'projects'
              ? 'bg-gradient-to-r from-cyan-950/60 to-indigo-950/40 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <FolderKanban className={`h-4 w-4 ${activeTab === 'projects' ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'}`} />
            <span>PROYECTOS</span>
          </div>
          {projectsCount > 0 ? (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {projectsCount}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-cyan-400/60">[PROJECTS]</span>
          )}
        </button>

        {/* 2. Collections (Fase 1D) */}
        <button
          onClick={() => onTabChange('collections')}
          className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition group relative ${
            activeTab === 'collections'
              ? 'bg-gradient-to-r from-cyan-950/60 to-indigo-950/40 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <FolderArchive className={`h-4 w-4 ${activeTab === 'collections' ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'}`} />
            <span>COLECCIONES</span>
          </div>
          {collectionsCount > 0 ? (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {collectionsCount}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-cyan-400/60">[SQLITE]</span>
          )}
        </button>

        {/* 3. Environments & Variables (Fase 1E) */}
        <button
          onClick={() => onTabChange('environments')}
          className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition group relative ${
            activeTab === 'environments'
              ? 'bg-gradient-to-r from-cyan-950/60 to-indigo-950/40 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Globe className={`h-4 w-4 ${activeTab === 'environments' ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'}`} />
            <span>ENTORNOS</span>
          </div>
          {environmentsCount > 0 ? (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {environmentsCount}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-cyan-400/60">[VARS]</span>
          )}
        </button>

        {/* 3. System Monitor */}
        <button
          onClick={() => onTabChange('monitor')}
          className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition group relative ${
            activeTab === 'monitor'
              ? 'bg-gradient-to-r from-cyan-950/60 to-indigo-950/40 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Activity className={`h-4 w-4 ${activeTab === 'monitor' ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'}`} />
            <span>ESTADO DEL SISTEMA</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400/60">[STATUS]</span>
        </button>

        {/* 4. Mission Archive / History */}
        <button
          onClick={() => onTabChange('archive')}
          className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition group relative ${
            activeTab === 'archive'
              ? 'bg-gradient-to-r from-cyan-950/60 to-indigo-950/40 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <History className={`h-4 w-4 ${activeTab === 'archive' ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'}`} />
            <span>HISTORIAL DE MISIONES</span>
          </div>
          {historyCount > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {historyCount}
            </span>
          )}
        </button>

        {/* 5. Audio & System Settings */}
        <button
          onClick={() => onTabChange('settings')}
          className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition group relative ${
            activeTab === 'settings'
              ? 'bg-gradient-to-r from-cyan-950/60 to-indigo-950/40 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Sliders className={`h-4 w-4 ${activeTab === 'settings' ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'}`} />
            <span>AJUSTES // AUDIO</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400/60">[CONFIG]</span>
        </button>
      </nav>

      {/* Pie de Telemetría del Sistema */}
      <div className="p-4 border-t border-cyan-500/20 bg-[#050811]/80 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
            <Radio className="h-3 w-3 text-cyan-400" />
            ENLACE NÚCLEO
          </span>
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'
              }`}
            />
            <span className={isOnline ? 'text-emerald-400' : 'text-rose-400'}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {clientPingMs !== null && (
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-900">
            <span>LATENCIA NÚCLEO</span>
            <span className="text-cyan-400">{clientPingMs} ms</span>
          </div>
        )}

        <div className="p-2 rounded bg-slate-950/70 border border-cyan-900/30 text-[10px] font-mono text-cyan-400/80 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">DEFENSA SSRF:</span>
            <span className="text-emerald-400 font-bold">ACTIVA</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">AUDIO SYSTEM:</span>
            <span className={audioEnabled ? "text-cyan-300 font-bold" : "text-slate-500"}>
              {audioEnabled ? "ACTIVO" : "MUTED"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">PERSISTENCIA:</span>
            <span className="text-cyan-300 font-bold">SQLITE ON</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
