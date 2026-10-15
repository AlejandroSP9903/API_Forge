/**
 * API Forge - Hunter Audio System (Fase 1C)
 * Generador nativo de efectos de sonido sintéticos holográficos mediante la Web Audio API.
 * 0 librerías externas, 0 archivos de audio descargados, 0 copyright.
 */

export type SoundEffectType = 'requestStart' | 'requestSuccess' | 'requestError' | 'securityBlocked';

export interface AudioSettings {
  enabled: boolean;
  volume: number; // 0.0 a 1.0
}

const STORAGE_KEY_AUDIO = 'api_forge_audio_settings_v1';

// Configuración inicial prudente: desactivado por defecto, volumen bajo (30%)
const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  enabled: false,
  volume: 0.3,
};

let audioCtx: AudioContext | null = null;
let currentSettings: AudioSettings = loadSavedSettings();

/**
 * Carga las preferencias de audio desde localStorage o devuelve los valores por defecto.
 */
function loadSavedSettings(): AudioSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIO);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_AUDIO_SETTINGS.enabled,
        volume:
          typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
            ? parsed.volume
            : DEFAULT_AUDIO_SETTINGS.volume,
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_AUDIO_SETTINGS };
}

/**
 * Obtiene una copia de la configuración actual de audio.
 */
export function getAudioSettings(): AudioSettings {
  return { ...currentSettings };
}

/**
 * Guarda y actualiza las preferencias de audio en memoria y localStorage.
 */
export function saveAudioSettings(settings: Partial<AudioSettings>): AudioSettings {
  currentSettings = {
    ...currentSettings,
    ...settings,
  };

  // Asegurar rango de volumen 0 a 1
  if (typeof currentSettings.volume === 'number') {
    currentSettings.volume = Math.max(0, Math.min(1, currentSettings.volume));
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY_AUDIO, JSON.stringify(currentSettings));
    } catch {
      // ignore
    }
  }

  return { ...currentSettings };
}

/**
 * Inicializa o recupera el AudioContext respetando las políticas de interacción del navegador.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {
        // Ignorar si el usuario aún no interactuó con la página
      });
    }

    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Síntesis de sonido sintético: Request Start (Pulso de inicialización holográfico)
 * Rápido barrido ascendente limpio (540Hz -> 880Hz) con decaimiento exponencial.
 */
function synthesizeRequestStart(ctx: AudioContext, masterVolume: number) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(540, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

  gain.gain.setValueAtTime(masterVolume * 0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.095);
}

/**
 * Síntesis de sonido sintético: Request Success (Acorde holográfico S-Rank)
 * Cascada armónica suave de dos tonos puros (880Hz y 1320Hz) con reverberación ligera.
 */
function synthesizeRequestSuccess(ctx: AudioContext, masterVolume: number) {
  const now = ctx.currentTime;

  // Tono 1 (Fundamental)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, now);
  gain1.gain.setValueAtTime(masterVolume * 0.35, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  // Tono 2 (Quinta justa / armónico superior con leve retraso)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(1320, now + 0.04);
  gain2.gain.setValueAtTime(0, now);
  gain2.gain.setValueAtTime(masterVolume * 0.28, now + 0.04);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  osc1.start(now);
  osc1.stop(now + 0.17);
  osc2.start(now + 0.04);
  osc2.stop(now + 0.21);
}

/**
 * Síntesis de sonido sintético: Request Error (Tono de fallo de transporte)
 * Pulso bajo descendente (240Hz -> 140Hz) con onda triangular filtrada.
 */
function synthesizeRequestError(ctx: AudioContext, masterVolume: number) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.exponentialRampToValueAtTime(130, now + 0.18);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(600, now);

  gain.gain.setValueAtTime(masterVolume * 0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.2);
}

/**
 * Síntesis de sonido sintético: Security Blocked (Chirp de activación de escudo SSRF)
 * Dos pulsos rápidos distintivos y secos de advertencia tecnológica (660Hz -> 480Hz -> 660Hz).
 */
function synthesizeSecurityBlocked(ctx: AudioContext, masterVolume: number) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  // Modulación rápida de frecuencia
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.setValueAtTime(460, now + 0.05);
  osc.frequency.setValueAtTime(720, now + 0.09);

  gain.gain.setValueAtTime(masterVolume * 0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.17);
}

/**
 * Ejecuta la síntesis según el tipo solicitado.
 */
function triggerSynthesis(type: SoundEffectType, ctx: AudioContext, volume: number) {
  if (volume <= 0) return;

  switch (type) {
    case 'requestStart':
      synthesizeRequestStart(ctx, volume);
      break;
    case 'requestSuccess':
      synthesizeRequestSuccess(ctx, volume);
      break;
    case 'requestError':
      synthesizeRequestError(ctx, volume);
      break;
    case 'securityBlocked':
      synthesizeSecurityBlocked(ctx, volume);
      break;
  }
}

/**
 * Reproduce un efecto de sonido respetando el estado actual de activación y volumen.
 * Si el usuario desactivó el audio durante una petición en vuelo, este método cancela la emisión.
 */
export function playSound(type: SoundEffectType): void {
  // Comprobación estricta de estado en el momento de reproducción
  if (!currentSettings.enabled || currentSettings.volume <= 0) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    triggerSynthesis(type, ctx, currentSettings.volume);
  } catch {
    // Si la Web Audio API falla por políticas de autoplay o restricciones, no interrumpir el flujo
  }
}

/**
 * Prueba un efecto de sonido bajo demanda (incluso si el audio está desactivado globalmente),
 * permitiendo al usuario previsualizar el volumen y tono antes de activarlo.
 */
export function testSound(type: SoundEffectType, overrideVolume?: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const targetVol = typeof overrideVolume === 'number' ? overrideVolume : currentSettings.volume || 0.3;

  try {
    triggerSynthesis(type, ctx, targetVol);
  } catch {
    // ignore
  }
}
