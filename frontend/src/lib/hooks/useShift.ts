'use client';

import { useEffect, useState } from 'react';
import { getCurrentShift, type Shift } from '@/lib/utils/shift';

// Valor SSR fijo para evitar hydration mismatch
const SSR_DEFAULT: Shift = {
  name: 'morning',
  displayName: 'Turno Mañana',
  start: new Date(0),
  end: new Date(0),
  elapsedMinutes: 0,
  remainingMinutes: 480,
  progress: 0,
};

export function useShift(): Shift {
  const [shift, setShift] = useState<Shift>(SSR_DEFAULT);

  useEffect(() => {
    setShift(getCurrentShift());
    const id = setInterval(() => {
      const next = getCurrentShift();
      setShift((prev) => {
        if (next.name !== prev.name) {
          window.dispatchEvent(new CustomEvent('shift-changed', { detail: next }));
        }
        return next;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return shift;
}
