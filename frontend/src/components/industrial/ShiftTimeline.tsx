'use client';

import { useEffect, useState } from 'react';
import { useShift } from '@/lib/hooks/useShift';

export function ShiftTimeline() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const shift = useShift();
  const pct = mounted ? Math.round(shift.progress * 100) : 0;

  return (
    <div className="relative h-1 w-full bg-bg-surface border-b border-border" suppressHydrationWarning>
      <div
        className="absolute top-0 left-0 h-full transition-all duration-1000 ease-out"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, var(--primary-dark), var(--primary-light))',
        }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary-light shadow-glow"
        style={{ left: `calc(${pct}% - 4px)` }}
      />
    </div>
  );
}
