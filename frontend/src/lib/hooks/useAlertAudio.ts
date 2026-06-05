'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeSeverity, SEV_ORDER } from '@/lib/severity';

export interface AudioAlert {
  id: string;
  severity: string;
  area?: string;
  title?: string;
}

const LS_BEEP = 'alert_beep_enabled';
const LS_VOICE = 'alert_voice_enabled';
const REPEAT_AUDIO_MS = 5 * 60_000; // 5 min — igual que redisplay del modal
const COALESCE_MS = 800; // ventana para agrupar alertas casi-simultáneas

function getLs(key: string, def: boolean): boolean {
  if (typeof window === 'undefined') return def;
  const v = localStorage.getItem(key);
  return v === null ? def : v === 'true';
}

// ── WebAudio singleton ────────────────────────────────────────────────────────
// Un único AudioContext desbloqueado en el primer gesto de la sesión. Una vez en
// estado 'running' queda habilitado para toda la sesión y NO vuelve a estar sujeto
// al chequeo de autoplay por elemento (que es lo que causaba que "hay que tocar el
// modal" para que sonara). Beep y voz se reproducen vía buffer sources.

let sharedCtx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();

// ── Serial audio queue ────────────────────────────────────────────────────────
// Garantiza que NUNCA se solapan dos reproducciones. Cada tarea espera a que
// la anterior termine antes de empezar. audioChain es módulo-global, persiste
// entre renders/llamadas.

let audioChain: Promise<void> = Promise.resolve();

function enqueueAudio(task: () => Promise<void>): Promise<void> {
  audioChain = audioChain.then(task).catch(() => {});
  return audioChain;
}

// ── Synthesized tones by severity ────────────────────────────────────────────

interface ToneSpec { freq: number; dur: number; gap: number; }

const WARN_TONES: ToneSpec[] = [{ freq: 660, dur: 0.25, gap: 0 }];

async function playToneSequence(specs: ToneSpec[]): Promise<void> {
  const ctx = getCtx();
  if (!ctx) return;

  let t = ctx.currentTime + 0.01; // pequeño offset inicial
  let totalMs = 0;

  for (const spec of specs) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(spec.freq, t);

    const attack = 0.01;
    const decay = 0.03;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + attack);
    gain.gain.setValueAtTime(0.3, t + spec.dur - decay);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);

    osc.start(t);
    osc.stop(t + spec.dur);

    totalMs += (spec.dur + spec.gap) * 1000;
    t += spec.dur + spec.gap;
  }

  await new Promise<void>((resolve) => setTimeout(resolve, totalMs));
}

function dominantSeverity(alerts: AudioAlert[]): 'info' | 'warn' | 'critical' {
  return alerts.reduce<'info' | 'warn' | 'critical'>((best, a) => {
    const sev = normalizeSeverity(a.severity);
    return SEV_ORDER[sev] < SEV_ORDER[best] ? sev : best;
  }, 'info');
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedCtx) return sharedCtx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  sharedCtx = new Ctor();
  return sharedCtx;
}

async function ensureRunning(): Promise<boolean> {
  const ctx = getCtx();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* gesto requerido */ }
  }
  return ctx.state === 'running';
}

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
  const ctx = getCtx();
  if (!ctx) return null;
  const cached = bufferCache.get(url);
  if (cached) return cached;
  try {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    bufferCache.set(url, buf);
    return buf;
  } catch {
    return null;
  }
}

/** Reproduce un AudioBuffer y resuelve al terminar. */
function playBuffer(buf: AudioBuffer): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getCtx();
    if (!ctx) return resolve();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => resolve();
    try { src.start(0); } catch { resolve(); }
  });
}

export function useAlertAudio(alerts: AudioAlert[]) {
  const prevIdsRef = useRef<Set<string>>(new Set());
  const prevAlertsRef = useRef<Map<string, AudioAlert>>(new Map());
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertsRef = useRef<AudioAlert[]>(alerts);
  const [audioBlocked, setAudioBlocked] = useState(false);
  // Primer render: inicializar prevIds con las alertas ya presentes para no
  // tratarlas como "nuevas" (evita beep al volver al dashboard con alertas activas).
  const initializedRef = useRef(false);

  // Coalesce: acumula alertas detectadas casi-simultáneas antes de disparar
  const pendingAlertsRef = useRef<Map<string, AudioAlert>>(new Map());
  const coalesceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  // ── Desbloqueo de audio en el primer gesto del usuario ──────────────────────
  const enableAudio = useCallback(async () => {
    const ok = await ensureRunning();
    setAudioBlocked(!ok);
    // Pre-cargar buffers de audio: normalización y alarma crítica
    void loadBuffer('/sounds/normalize.mp3');
    void loadBuffer('/sounds/alert.mp3');
  }, []);

  useEffect(() => {
    // Reflejar estado inicial
    const ctx = getCtx();
    setAudioBlocked(!ctx || ctx.state !== 'running');

    const onGesture = () => { void enableAudio(); };
    const opts = { capture: true, passive: true } as AddEventListenerOptions;
    window.addEventListener('pointerdown', onGesture, opts);
    window.addEventListener('keydown', onGesture, opts);
    window.addEventListener('touchstart', onGesture, opts);
    return () => {
      window.removeEventListener('pointerdown', onGesture, opts);
      window.removeEventListener('keydown', onGesture, opts);
      window.removeEventListener('touchstart', onGesture, opts);
    };
  }, [enableAudio]);

  const playBeepInternal = useCallback(async (url: string) => {
    if (!(await ensureRunning())) { setAudioBlocked(true); return; }
    const buf = await loadBuffer(url);
    if (buf) await playBuffer(buf);
  }, []);

  const playSeverityBeepInternal = useCallback(async (sev: 'info' | 'warn' | 'critical') => {
    if (!(await ensureRunning())) { setAudioBlocked(true); return; }
    if (sev === 'info') return;
    if (sev === 'critical') {
      await playBeepInternal('/sounds/alert.mp3');
    } else {
      await playToneSequence(WARN_TONES);
    }
  }, [playBeepInternal]);

  const playVoiceFromBlob = useCallback(async (blob: Blob) => {
    const ctx = getCtx();
    if (!ctx || !(await ensureRunning())) { setAudioBlocked(true); return; }
    try {
      const arr = await blob.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      await playBuffer(buf);
    } catch {
      // no crítico
    }
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
      await playVoiceFromBlob(await res.blob());
    } catch {
      // silenciar errores — no es crítico
    }
  }, [playVoiceFromBlob]);

  // fireAlertAudio: encola en audioChain para serializar con cualquier otra reproducción
  const fireAlertAudio = useCallback((alertsToPlay: AudioAlert[]) => {
    const beepEnabled = getLs(LS_BEEP, true);
    const voiceEnabled = getLs(LS_VOICE, false);
    if (!beepEnabled && !voiceEnabled) return;
    enqueueAudio(async () => {
      if (beepEnabled) await playSeverityBeepInternal(dominantSeverity(alertsToPlay));
      if (voiceEnabled) await playVoice(alertsToPlay.map((a) => a.id));
    });
  }, [playSeverityBeepInternal, playVoice]);

  // fireNormalizeAudio: también encola para no solaparse con alertas en curso
  const fireNormalizeAudio = useCallback((resolved: AudioAlert[]) => {
    const beepEnabled = getLs(LS_BEEP, true);
    const voiceEnabled = getLs(LS_VOICE, false);
    if (!beepEnabled && !voiceEnabled) return;
    enqueueAudio(async () => {
      if (beepEnabled) await playBeepInternal('/sounds/normalize.mp3');
      if (voiceEnabled) {
        try {
          const names = resolved.slice(0, 2).map((a) => a.title ?? a.area ?? 'el sensor').join(' y ');
          const extra = resolved.length > 2 ? `, y ${resolved.length - 2} más` : '';
          const plural = resolved.length > 1 ? 'volvieron' : 'volvió';
          const text = `Normalizado. ${names}${extra} ${plural} al rango normal.`;
          const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
          const res = await fetch(`${apiUrl}/alerts/voice-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          if (res.ok) await playVoiceFromBlob(await res.blob());
        } catch {
          // no crítico
        }
      }
    });
  }, [playBeepInternal, playVoiceFromBlob]);

  // Repetición periódica: si quedan alertas activas, re-dispara audio cada 5 min
  const scheduleRepeat = useCallback(() => {
    if (repeatTimerRef.current) clearTimeout(repeatTimerRef.current);
    repeatTimerRef.current = setTimeout(() => {
      const current = alertsRef.current;
      if (current.length === 0) return;
      fireAlertAudio(current);
      scheduleRepeat();
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

    // Primer render: inicializar silenciosamente para no disparar beep por alertas
    // preexistentes (pasa al navegar al dashboard con alertas ya activas).
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevIdsRef.current = currentIds;
      prevAlertsRef.current = currentMap;
      // Aun así programar repeat si hay alertas activas (sin disparar audio inmediato)
      if (alerts.length > 0) scheduleRepeat();
      return;
    }

    const newAlerts = alerts.filter((a) => !prevIdsRef.current.has(a.id));
    const resolvedAlerts = prevIdsRef.current.size > 0
      ? Array.from(prevIdsRef.current)
          .filter((id) => !currentIds.has(id))
          .map((id) => prevAlertsRef.current.get(id))
          .filter((a): a is AudioAlert => a != null)
      : [];

    prevIdsRef.current = currentIds;
    prevAlertsRef.current = currentMap;

    if (newAlerts.length > 0) {
      // Coalescer: acumular en pendingAlertsRef y debounce 800 ms
      for (const a of newAlerts) {
        pendingAlertsRef.current.set(a.id, a);
      }
      if (coalesceTimerRef.current) clearTimeout(coalesceTimerRef.current);
      coalesceTimerRef.current = setTimeout(() => {
        const toFire = Array.from(pendingAlertsRef.current.values());
        pendingAlertsRef.current.clear();
        coalesceTimerRef.current = null;
        if (toFire.length > 0) {
          fireAlertAudio(toFire);
          scheduleRepeat();
        }
      }, COALESCE_MS);
    } else if (resolvedAlerts.length > 0) {
      if (alerts.length === 0) cancelRepeat();
      fireNormalizeAudio(resolvedAlerts);
    }
  }, [alerts, fireAlertAudio, fireNormalizeAudio, scheduleRepeat, cancelRepeat]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      cancelRepeat();
      if (coalesceTimerRef.current) clearTimeout(coalesceTimerRef.current);
    };
  }, [cancelRepeat]);

  return { audioBlocked, enableAudio };
}
