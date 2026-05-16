'use client';

import { useEffect, useState } from 'react';

// SSR-safe: arranca con epoch 0, hydrata al mount real
export function useClock(): Date {
  const [now, setNow] = useState<Date>(() => new Date(0));
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
