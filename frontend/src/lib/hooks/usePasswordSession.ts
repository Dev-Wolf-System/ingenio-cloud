'use client';

import { useCallback, useEffect, useState } from 'react';

const SESSION_KEY = 'alerts_config_unlocked_until';
const PASSWORD = 'balitec$';
const TTL_MS = 30 * 60_000; // 30 min

export function usePasswordSession() {
  const [unlocked, setUnlocked] = useState(false);

  // Al mount: verificar si hay sesión activa
  useEffect(() => {
    try {
      const until = Number(sessionStorage.getItem(SESSION_KEY) ?? 0);
      if (until > Date.now()) setUnlocked(true);
    } catch {
      // sessionStorage no disponible (SSR)
    }
  }, []);

  const unlock = useCallback((pwd: string): boolean => {
    if (pwd !== PASSWORD) return false;
    try {
      sessionStorage.setItem(SESSION_KEY, String(Date.now() + TTL_MS));
    } catch {
      // ignore
    }
    setUnlocked(true);
    return true;
  }, []);

  const lock = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    setUnlocked(false);
  }, []);

  return { unlocked, unlock, lock };
}
