'use client';

import { useCallback, useEffect, useRef } from 'react';

export interface AudioAlert {
  id: string;
  severity: string;
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

  const playBeep = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const audio = new Audio('/sounds/alert.mp3');
      currentAudioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve(); // continuar aunque falle
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

  const fireAudio = useCallback(async (newAlerts: AudioAlert[]) => {
    const beepEnabled = getLs(LS_BEEP, true);
    const voiceEnabled = getLs(LS_VOICE, false);
    if (!beepEnabled && !voiceEnabled) return;

    // Parar audio anterior
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    const ids = newAlerts.map((a) => a.id);

    if (beepEnabled) {
      try {
        await playBeep();
      } catch {
        // continuar
      }
    }

    if (voiceEnabled) {
      await playVoice(ids);
    }
  }, [playBeep, playVoice]);

  // Detectar nuevas alertas y disparar audio
  useEffect(() => {
    const currentIds = new Set(alerts.map((a) => a.id));

    if (alerts.length === 0) {
      prevIdsRef.current = currentIds;
      return;
    }

    const newAlerts = alerts.filter((a) => !prevIdsRef.current.has(a.id));
    prevIdsRef.current = currentIds;

    if (newAlerts.length === 0) return;

    // Intentar reproducir — si falla por autoplay policy, guardar para primer click
    const trigger = () => fireAudio(newAlerts);

    if (typeof document !== 'undefined') {
      const testAudio = new Audio();
      testAudio.play().then(() => {
        testAudio.pause();
        trigger();
      }).catch(() => {
        // Autoplay bloqueado — reproducir en primer click del usuario
        pendingUnlockRef.current = true;
        pendingAudioRef.current = trigger;
      });
    }
  }, [alerts, fireAudio]);

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
