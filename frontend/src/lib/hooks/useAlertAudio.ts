'use client';

import { useCallback, useEffect, useRef } from 'react';

export interface AudioAlert {
  id: string;
  severity: string;
  area?: string;
  title?: string;
}

const LS_BEEP = 'alert_beep_enabled';
const LS_VOICE = 'alert_voice_enabled';

function getLs(key: string, def: boolean): boolean {
  if (typeof window === 'undefined') return def;
  const v = localStorage.getItem(key);
  return v === null ? def : v === 'true';
}

export function useAlertAudio(alerts: AudioAlert[]) {
  const prevIdsRef = useRef<Set<string>>(new Set());
  const prevAlertsRef = useRef<Map<string, AudioAlert>>(new Map());
  const pendingUnlockRef = useRef(false);
  const pendingAudioRef = useRef<(() => void) | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceBlobUrlRef = useRef<string | null>(null);

  const revokeVoiceUrl = useCallback(() => {
    if (voiceBlobUrlRef.current) {
      URL.revokeObjectURL(voiceBlobUrlRef.current);
      voiceBlobUrlRef.current = null;
    }
  }, []);

  const playSound = useCallback((src: string): Promise<void> => {
    return new Promise((resolve) => {
      const audio = new Audio(src);
      currentAudioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  }, []);

  const playVoice = useCallback(async (alertIds: string[]): Promise<void> => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
      const res = await fetch(`${apiUrl}/alerts/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertIds }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      revokeVoiceUrl();
      const url = URL.createObjectURL(blob);
      voiceBlobUrlRef.current = url;
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      await audio.play();
    } catch {
      // silenciar errores — no es crítico
    }
  }, [revokeVoiceUrl]);

  const fireAlertAudio = useCallback(async (newAlerts: AudioAlert[]) => {
    const beepEnabled = getLs(LS_BEEP, true);
    const voiceEnabled = getLs(LS_VOICE, false);
    if (!beepEnabled && !voiceEnabled) return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (beepEnabled) await playSound('/sounds/alert.mp3').catch(() => {});
    if (voiceEnabled) await playVoice(newAlerts.map((a) => a.id));
  }, [playSound, playVoice]);

  const fireNormalizeAudio = useCallback(async (resolved: AudioAlert[]) => {
    const beepEnabled = getLs(LS_BEEP, true);
    const voiceEnabled = getLs(LS_VOICE, false);
    if (!beepEnabled && !voiceEnabled) return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (beepEnabled) await playSound('/sounds/normalize.mp3').catch(() => {});

    if (voiceEnabled) {
      // Voz de normalización — generada inline sin llamar al endpoint de alertas activas
      try {
        const names = resolved.slice(0, 2).map((a) => a.title ?? a.area ?? 'alerta').join(' y ');
        const extra = resolved.length > 2 ? ` y ${resolved.length - 2} más` : '';
        const text = `Sistema de monitoreo industrial. Normalizado. ${names}${extra} volvió a rango normal.`;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
        const res = await fetch(`${apiUrl}/alerts/voice-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const blob = await res.blob();
          revokeVoiceUrl();
          const url = URL.createObjectURL(blob);
          voiceBlobUrlRef.current = url;
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          await audio.play();
        }
      } catch {
        // no crítico
      }
    }
  }, [playSound, revokeVoiceUrl]);

  // Detectar nuevas alertas y alertas resueltas
  useEffect(() => {
    const currentIds = new Set(alerts.map((a) => a.id));
    const currentMap = new Map(alerts.map((a) => [a.id, a]));

    // Alertas nuevas (aparecieron)
    const newAlerts = alerts.filter((a) => !prevIdsRef.current.has(a.id));
    // Alertas resueltas (desaparecieron) — solo si antes había al menos 1
    const resolvedAlerts = prevIdsRef.current.size > 0
      ? Array.from(prevIdsRef.current)
          .filter((id) => !currentIds.has(id))
          .map((id) => prevAlertsRef.current.get(id))
          .filter((a): a is AudioAlert => a != null)
      : [];

    prevIdsRef.current = currentIds;
    prevAlertsRef.current = currentMap;

    const tryPlay = (fn: () => void) => {
      if (typeof document === 'undefined') return;
      const testAudio = new Audio();
      testAudio.play().then(() => {
        testAudio.pause();
        fn();
      }).catch(() => {
        pendingUnlockRef.current = true;
        pendingAudioRef.current = fn;
      });
    };

    if (newAlerts.length > 0) {
      tryPlay(() => fireAlertAudio(newAlerts));
    } else if (resolvedAlerts.length > 0) {
      // Solo normalize si NO hay nuevas alertas simultáneas
      tryPlay(() => fireNormalizeAudio(resolvedAlerts));
    }
  }, [alerts, fireAlertAudio, fireNormalizeAudio]);

  // Listener para desbloquear autoplay en primer click
  useEffect(() => {
    const handleClick = () => {
      if (pendingUnlockRef.current && pendingAudioRef.current) {
        pendingUnlockRef.current = false;
        const fn = pendingAudioRef.current;
        pendingAudioRef.current = null;
        fn();
      }
    };
    document.addEventListener('click', handleClick, { once: false });
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      revokeVoiceUrl();
    };
  }, [revokeVoiceUrl]);
}
