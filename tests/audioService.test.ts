/**
 * API Forge - Pruebas Unitarias del Sistema de Audio Hunter (Fase 1C)
 * Verifica preferencias, persistencia y control de volumen y estado sin requerir hardware de audio real.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAudioSettings,
  saveAudioSettings,
  playSound,
  testSound,
} from '../src/services/audioService.ts';

describe('Servicio de Audio Hunter (audioService)', () => {
  beforeEach(() => {
    // Resetear configuración a valores iniciales prudentes
    saveAudioSettings({ enabled: false, volume: 0.3 });
  });

  describe('Preferencias y Valores por Defecto', () => {
    it('debe iniciar con sonido desactivado (false) por precaución', () => {
      const settings = getAudioSettings();
      expect(settings.enabled).toBe(false);
    });

    it('debe mantener un volumen prudente por defecto (0.3 / 30%)', () => {
      const settings = getAudioSettings();
      expect(settings.volume).toBeCloseTo(0.3);
    });

    it('debe permitir activar y desactivar los efectos sonoros', () => {
      saveAudioSettings({ enabled: true });
      expect(getAudioSettings().enabled).toBe(true);

      saveAudioSettings({ enabled: false });
      expect(getAudioSettings().enabled).toBe(false);
    });

    it('debe acotar el volumen al rango válido [0.0, 1.0]', () => {
      saveAudioSettings({ volume: 1.5 });
      expect(getAudioSettings().volume).toBe(1.0);

      saveAudioSettings({ volume: -0.2 });
      expect(getAudioSettings().volume).toBe(0.0);

      saveAudioSettings({ volume: 0.65 });
      expect(getAudioSettings().volume).toBeCloseTo(0.65);
    });
  });

  describe('Control de Reproducción y Respeto a Estados', () => {
    it('no debe emitir errores al invocar playSound con audio desactivado', () => {
      saveAudioSettings({ enabled: false });
      expect(() => {
        playSound('requestStart');
        playSound('requestSuccess');
        playSound('requestError');
        playSound('securityBlocked');
      }).not.toThrow();
    });

    it('no debe emitir errores al invocar playSound con volumen cero', () => {
      saveAudioSettings({ enabled: true, volume: 0 });
      expect(() => {
        playSound('requestSuccess');
      }).not.toThrow();
    });

    it('no debe emitir errores al invocar testSound bajo demanda', () => {
      expect(() => {
        testSound('requestStart');
        testSound('requestSuccess', 0.5);
        testSound('requestError');
        testSound('securityBlocked');
      }).not.toThrow();
    });
  });
});
