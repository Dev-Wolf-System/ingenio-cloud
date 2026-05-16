'use client';

import { useEffect, useState } from 'react';
import { getCurrentShift, type Shift } from '@/lib/utils/shift';

export function useShift(): Shift {
  const [shift, setShift] = useState<Shift>(() => getCurrentShift());

  useEffect(() => {
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
