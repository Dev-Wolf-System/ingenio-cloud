'use client';

import { useCallback, useEffect, useState } from 'react';

const SESSION_KEY = 'alerts_config_unlocked_until';
const TTL_MS = 30 * 60_000; // 30 min

export function usePasswordSession() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    try {
      const until = Number(sessionStorage.getItem(SESSION_KEY) ?? 0);
      if (until > Date.now()) setUnlocked(true);
    } catch {
      // sessionStorage no disponible (SSR)
    }
  }, []);

  const unlock = useCallback(async (pwd: string): Promise<boolean> => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/alerts/thresholds/config/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd }),
        },
      );
      if (!res.ok) return false;
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) return false;
      try {
        sessionStorage.setItem(SESSION_KEY, String(Date.now() + TTL_MS));
      } catch {
        // ignore
      }
      setUnlocked(true);
      return true;
    } catch {
      return false;
    }
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
