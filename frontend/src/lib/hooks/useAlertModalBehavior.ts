'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeSeverity, SEV_ORDER, type Severity } from '@/lib/severity';

const WARNING_MODAL_OPEN_MS = 8_000;
const WARNING_REPEAT_MS = 5 * 60_000;
const CRITICAL_REDISPLAY_MS = 5 * 60_000;
const LS_MODAL = 'alert_modal_enabled';

function getLs(key: string, def: boolean): boolean {
  if (typeof window === 'undefined') return def;
  const v = localStorage.getItem(key);
  return v === null ? def : v === 'true';
}

export interface BehaviorAlert {
  id: string;
  severity: string;
  metadata?: { triage?: { severidad?: string } };
}

export function effectiveSeverity(a: BehaviorAlert): Severity {
  const t = a.metadata?.triage?.severidad;
  return t ? normalizeSeverity(t) : normalizeSeverity(a.severity);
}

/** Comportamiento del modal según severidad dominante.
 *  info: no abre · warn: 8s + repite cada 5min · critical: persistente + reabre 5min al cerrar. */
export function useAlertModalBehavior(alerts: BehaviorAlert[]) {
  const [isOpen, setIsOpen] = useState(false);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redisplayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dominant = useMemo<Severity>(() => {
    let best: Severity = 'info';
    for (const a of alerts) {
      const s = effectiveSeverity(a);
      if (SEV_ORDER[s] < SEV_ORDER[best]) best = s;
    }
    return best;
  }, [alerts]);

  const clearAuto = useCallback(() => {
    if (autoCloseRef.current) { clearTimeout(autoCloseRef.current); autoCloseRef.current = null; }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    clearAuto();
    if (redisplayRef.current) { clearTimeout(redisplayRef.current); redisplayRef.current = null; }
    // Crítica: reabrir a los 5min si sigue activa
    if (dominant === 'critical' && alerts.length > 0 && getLs(LS_MODAL, true)) {
      redisplayRef.current = setTimeout(() => setIsOpen(true), CRITICAL_REDISPLAY_MS);
    }
  }, [dominant, alerts.length, clearAuto]);

  // Apertura ante alertas nuevas accionables (warn/critical)
  useEffect(() => {
    const ids = new Set(alerts.map((a) => a.id));
    const newOnes = alerts.filter((a) => !prevIdsRef.current.has(a.id));
    prevIdsRef.current = ids;

    if (alerts.length === 0) {
      setIsOpen(false);
      prevIdsRef.current = new Set();
      if (redisplayRef.current) { clearTimeout(redisplayRef.current); redisplayRef.current = null; }
      if (repeatRef.current) { clearInterval(repeatRef.current); repeatRef.current = null; }
      return;
    }
    if (!getLs(LS_MODAL, true)) return;

    const hasNewActionable = newOnes.some((a) => effectiveSeverity(a) !== 'info');
    if (hasNewActionable) setIsOpen(true);
  }, [alerts]);

  // Auto-cierre 8s cuando domina warn (crítica queda persistente)
  useEffect(() => {
    clearAuto();
    if (isOpen && dominant === 'warn') {
      autoCloseRef.current = setTimeout(() => setIsOpen(false), WARNING_MODAL_OPEN_MS);
    }
    return clearAuto;
  }, [isOpen, dominant, clearAuto]);

  // Repetición cada 5min mientras domine warn
  // El intervalo NO se cancela al cerrar manualmente: es intencional — mientras
  // domine warn, el modal reaparece cada 5min aunque el operador lo haya cerrado.
  useEffect(() => {
    if (repeatRef.current) { clearInterval(repeatRef.current); repeatRef.current = null; }
    if (alerts.length > 0 && dominant === 'warn' && getLs(LS_MODAL, true)) {
      repeatRef.current = setInterval(() => setIsOpen(true), WARNING_REPEAT_MS);
    }
    return () => { if (repeatRef.current) clearInterval(repeatRef.current); };
  }, [dominant, alerts.length]);

  // Cleanup
  useEffect(() => () => {
    clearAuto();
    if (repeatRef.current) clearInterval(repeatRef.current);
    if (redisplayRef.current) clearTimeout(redisplayRef.current);
  }, [clearAuto]);

  return { isOpen, close, dominant };
}
