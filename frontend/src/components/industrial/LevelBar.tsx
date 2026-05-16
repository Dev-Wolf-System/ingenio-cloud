'use client';

import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';
import type { MetricStatus } from '@/types/metrics';

export interface LevelBarProps {
  label: string;
  value: number | null | undefined;
  capacity?: number;
  unit?: string;
  status?: MetricStatus;
  className?: string;
}

const FILL_COLOR: Record<MetricStatus, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  alarm: 'bg-danger',
  unknown: 'bg-text-muted',
};

export function LevelBar({ label, value, capacity = 100, unit = '%', status = 'unknown', className }: LevelBarProps) {
  const pct =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(100, (value / capacity) * 100))
      : 0;
  const displayValue = typeof value === 'number' ? formatNumber(value, 0) : '—';

  return (
    <div className={cn('rounded-md border border-border bg-bg-card p-3', className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-2xs uppercase tracking-wide text-text-muted font-medium">{label}</span>
        <span className="mono text-sm font-medium text-text-primary">
          {displayValue}
          <span className="ml-0.5 text-text-muted text-xs">{unit}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-hover">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', FILL_COLOR[status])}
          style={{ width: `${pct}%`, transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </div>
    </div>
  );
}
