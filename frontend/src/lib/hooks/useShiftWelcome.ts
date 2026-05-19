'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'ingcloud:shift-greeted';
const subs = new Set<(open: boolean) => void>();
let currentOpen = false;

function notify(open: boolean) {
  currentOpen = open;
  subs.forEach((cb) => cb(open));
}

/**
 * Hook compartido para abrir/cerrar el banner de recibimiento del turno.
 * Cualquier componente puede pedirlo manualmente (ej. botón en TopBar).
 */
export function useShiftWelcome() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(currentOpen);
    const cb = (v: boolean) => setOpen(v);
    subs.add(cb);
    return () => {
      subs.delete(cb);
    };
  }, []);

  const openBanner = useCallback(() => notify(true), []);
  const closeBanner = useCallback(() => notify(false), []);

  /** Resetea el flag localStorage del turno actual para volver a verlo */
  const resetGreeted = useCallback((shiftKey: string) => {
    try {
      window.localStorage.removeItem(`${STORAGE_PREFIX}:${shiftKey}`);
    } catch {
      // noop
    }
    notify(true);
  }, []);

  return { open, openBanner, closeBanner, resetGreeted };
}

export const SHIFT_GREETED_PREFIX = STORAGE_PREFIX;
