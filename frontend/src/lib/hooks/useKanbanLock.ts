'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ingcloud:kanban-locked';

// Sub global simple — todos los componentes leen el mismo flag y se notifican
const subscribers = new Set<(locked: boolean) => void>();

let currentLocked = false;

function setGlobal(locked: boolean) {
  currentLocked = locked;
  subscribers.forEach((cb) => cb(locked));
  try {
    window.localStorage.setItem(STORAGE_KEY, locked ? '1' : '0');
  } catch {
    // noop
  }
}

/**
 * Hook global compartido para bloquear/desbloquear drag-drop kanban.
 * Default: locked = true (panel quieto). Toggle desde TopBar.
 */
export function useKanbanLock() {
  const [locked, setLocked] = useState<boolean>(true);

  useEffect(() => {
    // Inicial desde localStorage
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const initial = stored === null ? true : stored === '1';
      currentLocked = initial;
      setLocked(initial);
    } catch {
      setLocked(true);
    }
    const cb = (v: boolean) => setLocked(v);
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }, []);

  const toggle = useCallback(() => setGlobal(!currentLocked), []);
  const lock = useCallback(() => setGlobal(true), []);
  const unlock = useCallback(() => setGlobal(false), []);

  return { locked, toggle, lock, unlock };
}
