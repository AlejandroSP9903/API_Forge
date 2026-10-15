/**
 * API Forge - Panel de Ajustes del Sistema de Audio Hunter (Fase 1C)
 * Permite configurar, probar y persistir los efectos sintéticos de la Web Audio API.
 */

import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Volume1,
  Play,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  getAudioSettings,
  saveAudioSettings,
  testSound,
  type AudioSettings,
  type SoundEffectType,
} from '../services/audioService.ts';

interface AudioSettingsPanelProps {
  onSettingsChanged?: (newSettings: AudioSettings) => void;
}

export function AudioSettingsPanel({ onSettingsChanged }: AudioSettingsPanelProps) {
  const [settings, setSettings] = useState<AudioSettings>(() => getAudioSettings());
  const [lastTestedSound, setLastTestedSound] = useState<SoundEffectType | null>(null);

  const handleToggle = () => {
    const nextEnabled = !settings.enabled;
    const updated = saveAudioSettings({ enabled: nextEnabled });
    setSettings(updated);
    if (onSettingsChanged) onSettingsChanged(updated);

    // Si el usuario activa el audio, reproducir una confirmación sutil inmediata
    if (nextEnabled) {
      testSound('requestSuccess', updated.volume);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    const updated = saveAudioSettings({ volume: newVol });
    setSettings(updated);
    if (onSettingsChanged) onSettingsChanged(updated);
  };

  const handleTestSound = (type: SoundEffectType) => {
    setLastTestedSound(type);
    testSound(type, settings.volume);
    setTimeout(() => {
      setLastTestedSound((prev) => (prev === type ? null : prev));
    }, 400);
  };

  const handleResetDefaults = () => {
    const updated = saveAudioSettings({ enabled: false, volume: 0.3 });
    setSettings(updated);
    if (onSettingsChanged) onSettingsChanged(updated);
  };

  const percentage = Math.round(settings.volume * 100);

  return (
    <div className="space-y-6">
      {/* Cabecera del Panel */}
      <div className="holo-panel rounded-xl p-5 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400 uppercase tracking-widest">
            <Sliders className="h-3.5 w-3.5 text-cyan-400" />
            <span>CONFIGURACIÓN DEL SISTEMA // FASE 1C</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
            HUNTER AUDIO SYSTEM
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Efectos sonoros sintéticos generados en tiempo real con la Web Audio API nativa del navegador.
            Sin librerías externas, sin descargas y con respeto absoluto a la política de reproducción del usuario.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            title="Restablecer valores predeterminados"
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>VALORES DEFECTO</span>
          </button>
        </div>
      </div>

      {/* Grid Principal de Ajustes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tarjeta 1: Interruptor Maestro y Control de Volumen */}
        <div className="holo-panel rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Zap className="h-4 w-4" />
              <span className="font-bold uppercase tracking-wider">ESTADO DEL AUDIO MAESTRO</span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                settings.enabled
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : 'text-slate-400 bg-slate-800/60 border-slate-700'
              }`}
            >
              {settings.enabled ? 'ACTIVO' : 'DESACTIVADO'}
            </span>
          </div>

          {/* Toggle Activar/Desactivar */}
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-[#050811] border border-cyan-500/20">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-200">Efectos de Sonido Holográficos</div>
              <div className="text-[11px] text-slate-400">
                Reproduce tonos sutiles al iniciar misiones, recibir respuestas o interceptar amenazas SSRF.
              </div>
            </div>

            <button
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.enabled ? 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.6)]' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Slider de Volumen */}
          <div className="space-y-3 p-3.5 rounded-lg bg-[#050811] border border-cyan-500/20">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-300">
                {settings.volume === 0 || !settings.enabled ? (
                  <VolumeX className="h-4 w-4 text-slate-500" />
                ) : settings.volume < 0.5 ? (
                  <Volume1 className="h-4 w-4 text-cyan-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-cyan-400" />
                )}
                <span>VOLUMEN GENERAL</span>
              </div>
              <span className="font-bold text-cyan-300 tabular-nums">{percentage}%</span>
            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
            />

            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0% (Silencio)</span>
              <span className="text-cyan-400/80">30% (Prudente / Recomendado)</span>
              <span>100% (Máximo)</span>
            </div>
          </div>

          {/* Información de Garantías del Sistema */}
          <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/20 space-y-1 text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Info className="h-3.5 w-3.5" />
              <span>GARANTÍA DE CANCELACIÓN EN VUELO:</span>
            </div>
            <p className="leading-relaxed text-slate-400">
              Si desactivas el interruptor mientras una petición HTTP sigue en curso, la finalización no emitirá ningún sonido.
              Los efectos se sintetizan en el momento de reproducirse, no por cola anticipada.
            </p>
          </div>
        </div>

        {/* Tarjeta 2: Probador de Efectos Sintéticos (Test Sound) */}
        <div className="holo-panel rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Play className="h-4 w-4" />
              <span className="font-bold uppercase tracking-wider">AUDITORÍA DE TONOS SINTÉTICOS</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">PRUEBA EN VIVO</span>
          </div>

          <p className="text-xs text-slate-400">
            Haz clic en cualquiera de los efectos para escuchar su firma acústica al volumen actual, incluso si el interruptor maestro está apagado.
          </p>

          <div className="space-y-3">
            {/* 1. Request Start */}
            <div className="p-3 rounded-lg bg-[#050811] border border-cyan-500/20 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 font-mono">
                  <span>requestStart</span>
                  <span className="text-[10px] text-slate-500">(540Hz → 880Hz)</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Pulso de barrido ascendente ultracorto al iniciar una misión HTTP.
                </div>
              </div>
              <button
                onClick={() => handleTestSound('requestStart')}
                className={`px-3 py-1.5 rounded bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 text-cyan-300 text-xs font-mono flex items-center gap-1.5 transition shrink-0 ${
                  lastTestedSound === 'requestStart' ? 'border-cyan-400 bg-cyan-500/20' : ''
                }`}
              >
                <Play className="h-3 w-3" />
                <span>PROBAR</span>
              </button>
            </div>

            {/* 2. Request Success */}
            <div className="p-3 rounded-lg bg-[#050811] border border-cyan-500/20 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
                  <span>requestSuccess</span>
                  <span className="text-[10px] text-slate-500">(880Hz + 1320Hz)</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Acorde holográfico limpio de confirmación para respuestas HTTP exitosas.
                </div>
              </div>
              <button
                onClick={() => handleTestSound('requestSuccess')}
                className={`px-3 py-1.5 rounded bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-1.5 transition shrink-0 ${
                  lastTestedSound === 'requestSuccess' ? 'border-emerald-400 bg-emerald-500/20' : ''
                }`}
              >
                <Play className="h-3 w-3" />
                <span>PROBAR</span>
              </button>
            </div>

            {/* 3. Request Error */}
            <div className="p-3 rounded-lg bg-[#050811] border border-cyan-500/20 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5 font-mono">
                  <span>requestError</span>
                  <span className="text-[10px] text-slate-500">(240Hz → 130Hz)</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Tono bajo filtrado para errores de transporte (DNS, timeouts o fallos de conexión).
                </div>
              </div>
              <button
                onClick={() => handleTestSound('requestError')}
                className={`px-3 py-1.5 rounded bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-1.5 transition shrink-0 ${
                  lastTestedSound === 'requestError' ? 'border-rose-400 bg-rose-500/20' : ''
                }`}
              >
                <Play className="h-3 w-3" />
                <span>PROBAR</span>
              </button>
            </div>

            {/* 4. Security Blocked */}
            <div className="p-3 rounded-lg bg-[#050811] border border-cyan-500/20 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 font-mono">
                  <span>securityBlocked</span>
                  <span className="text-[10px] text-slate-500">(660Hz ⤹ 460Hz ⤸ 720Hz)</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Chirp de advertencia tecnológica cuando el escudo SSRF intercepta una IP privada.
                </div>
              </div>
              <button
                onClick={() => handleTestSound('securityBlocked')}
                className={`px-3 py-1.5 rounded bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-1.5 transition shrink-0 ${
                  lastTestedSound === 'securityBlocked' ? 'border-amber-400 bg-amber-500/20' : ''
                }`}
              >
                <Play className="h-3 w-3" />
                <span>PROBAR</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
