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
const REPEAT_AUDIO_MS = 5 * 60_000; // 5 min — igual que redisplay del modal

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
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Siempre apunta a las alertas actuales sin re-crear callbacks
  const alertsRef = useRef<AudioAlert[]>(alerts);

  // Mantener alertsRef sincronizado
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

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

  const fireAlertAudio = useCallback(async (alertsToPlay: AudioAlert[]) => {
    const beepEnabled = getLs(LS_BEEP, true);
    const voiceEnabled = getLs(LS_VOICE, false);
    if (!beepEnabled && !voiceEnabled) return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (beepEnabled) await playSound('/sounds/alert.mp3').catch(() => {});
    if (voiceEnabled) await playVoice(alertsToPlay.map((a) => a.id));
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

  // Repetición periódica: si quedan alertas activas, re-dispara audio cada 5 min
  const scheduleRepeat = useCallback(() => {
    if (repeatTimerRef.current) clearTimeout(repeatTimerRef.current);
    repeatTimerRef.current = setTimeout(() => {
      const current = alertsRef.current;
      if (current.length === 0) return; // se resolvieron solas — no repetir
      const beepEnabled = getLs(LS_BEEP, true);
      const voiceEnabled = getLs(LS_VOICE, false);
      if (beepEnabled || voiceEnabled) {
        fireAlertAudio(current).catch(() => {});
      }
      scheduleRepeat(); // re-agendar próxima repetición
    }, REPEAT_AUDIO_MS);
  }, [fireAlertAudio]);

  const cancelRepeat = useCallback(() => {
    if (repeatTimerRef.current) {
      clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }, []);

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
      // Nueva alerta: reproducir + (re)iniciar timer de repetición
      tryPlay(() => fireAlertAudio(newAlerts));
      scheduleRepeat();
    } else if (resolvedAlerts.length > 0) {
      if (alerts.length === 0) {
        // Todas resueltas: cancelar repetición + sonido de normalización
        cancelRepeat();
        tryPlay(() => fireNormalizeAudio(resolvedAlerts));
      } else {
        // Algunas resueltas pero quedan activas: solo normalización, repetición sigue
        tryPlay(() => fireNormalizeAudio(resolvedAlerts));
      }
    }
  }, [alerts, fireAlertAudio, fireNormalizeAudio, scheduleRepeat, cancelRepeat]);

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
      cancelRepeat();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      revokeVoiceUrl();
    };
  }, [cancelRepeat, revokeVoiceUrl]);
}
