'use client';

import { IconBuildingFactory2, IconMaximize, IconCircleFilled } from '@tabler/icons-react';
import { useClock } from '@/lib/hooks/useClock';
import { useShift } from '@/lib/hooks/useShift';
import { formatTime } from '@/lib/utils/format';

export function TopBar({ plant = 'Planta Sur' }: { plant?: string }) {
  const now = useClock();
  const shift = useShift();

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-bg-surface/80 backdrop-blur px-4 h-16">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary-dark text-text-primary">
          <IconBuildingFactory2 size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text-primary leading-tight">
            Ingenio Cloud
          </span>
          <span className="text-2xs text-text-muted">{plant}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
          <IconCircleFilled size={8} className="text-ok animate-pulse" />
          <span>Realtime</span>
        </span>
        <div className="flex flex-col items-end">
          <span className="mono text-sm font-medium text-text-primary leading-tight">
            {formatTime(now)}
          </span>
          <span className="text-2xs uppercase tracking-wide text-text-muted">
            {shift.displayName} · {Math.round(shift.progress * 100)}%
          </span>
        </div>
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-md hover:bg-bg-hover transition-colors"
          aria-label="Pantalla completa"
        >
          <IconMaximize size={18} className="text-text-muted" />
        </button>
      </div>
    </header>
  );
}
