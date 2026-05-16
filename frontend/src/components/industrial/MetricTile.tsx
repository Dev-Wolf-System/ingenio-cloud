'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatNumber, formatRelative } from '@/lib/utils/format';
import type { MetricStatus } from '@/types/metrics';

const tileVariants = cva(
  'relative rounded-lg transition-all duration-300 group overflow-hidden',
  {
    variants: {
      status: {
        ok: 'border border-border bg-gradient-to-br from-bg-card to-bg-surface hover:border-ok/30',
        warn: 'border border-warn/30 bg-gradient-to-br from-warn-soft/30 to-bg-card hover:border-warn/50',
        alarm:
          'border border-danger/50 bg-gradient-to-br from-danger-soft/40 to-bg-card animate-pulse-alarm hover:border-danger',
        unknown:
          'border border-border bg-bg-card/60 opacity-75 hover:opacity-100 hover:border-border-strong',
      },
      size: {
        sm: 'p-2.5 min-h-[68px]',
        md: 'p-3.5 min-h-[84px]',
        lg: 'p-4 min-h-[104px]',
      },
    },
    defaultVariants: {
      status: 'unknown',
      size: 'md',
    },
  },
);

const STATUS_BAR: Record<string, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  alarm: 'bg-danger',
  unknown: 'bg-text-muted/40',
};

const STATUS_DOT: Record<string, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn animate-pulse',
  alarm: 'bg-danger animate-pulse',
  unknown: 'bg-text-muted/40',
};

export interface MetricTileProps extends VariantProps<typeof tileVariants> {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  precision?: number;
  status?: MetricStatus;
  timestamp?: string;
  className?: string;
}

export function MetricTile({
  label,
  value,
  unit,
  precision = 1,
  status = 'unknown',
  size,
  timestamp,
  className,
}: MetricTileProps) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current !== value && prev.current !== undefined) {
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 600);
      prev.current = value;
      return () => clearTimeout(id);
    }
    prev.current = value;
  }, [value]);

  const displayValue =
    typeof value === 'number' && Number.isFinite(value)
      ? formatNumber(value, precision)
      : value ?? '—';

  return (
    <div className={cn(tileVariants({ status, size }), className)}>
      {/* Status bar lateral (4px izquierda) */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px]', STATUS_BAR[status])} />

      {/* Flash overlay */}
      {flash && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, var(--primary-soft), transparent)',
            animation: 'flash 600ms ease-out forwards',
          }}
        />
      )}

      <div className="relative pl-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted font-medium leading-tight truncate flex-1">
            {label}
          </span>
          <span className={cn('w-1.5 h-1.5 rounded-full mt-1 shrink-0', STATUS_DOT[status])} />
        </div>

        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="mono font-medium text-text-primary tabular-nums leading-none text-[clamp(1.1rem,1.4vw,1.6rem)]">
            {displayValue}
          </span>
          {unit && <span className="text-2xs text-text-muted font-medium">{unit}</span>}
        </div>

        {timestamp && (
          <div className="mt-1 text-[9px] text-text-disabled mono">
            {formatRelative(timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}
