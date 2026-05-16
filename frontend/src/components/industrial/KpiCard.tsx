'use client';

import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';
import type { MetricStatus } from '@/types/metrics';
import { IconArrowUpRight, IconArrowDownRight, IconMinus, type Icon as TablerIcon } from '@tabler/icons-react';
import type { ComponentType } from 'react';

export interface KpiCardProps {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  precision?: number;
  icon?: ComponentType<{ className?: string; size?: number }> | TablerIcon;
  status?: MetricStatus | 'accent';
  delta?: { value: string; direction: 'up' | 'down' | 'flat' };
  footer?: string;
  pulse?: boolean;
  className?: string;
}

const BORDER: Record<string, string> = {
  ok: 'border-l-ok',
  warn: 'border-l-warn',
  alarm: 'border-l-danger',
  unknown: 'border-l-text-muted',
  accent: 'border-l-accent',
};

export function KpiCard({
  label,
  value,
  unit,
  precision = 0,
  icon: Icon,
  status = 'accent',
  delta,
  footer,
  pulse,
  className,
}: KpiCardProps) {
  const displayValue =
    typeof value === 'number' && Number.isFinite(value)
      ? formatNumber(value, precision)
      : value ?? '—';

  return (
    <div
      className={cn(
        'relative rounded-lg border border-border bg-bg-card p-4 border-l-[3px] transition-all',
        BORDER[status],
        pulse && 'animate-pulse-alarm',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xs uppercase tracking-wide text-text-muted font-medium">{label}</span>
        {Icon && <Icon size={18} className="text-text-muted" />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="mono text-fluid-kpi font-medium text-text-primary leading-none">{displayValue}</span>
        {unit && <span className="text-sm text-text-muted">{unit}</span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs',
              delta.direction === 'up' && 'text-ok',
              delta.direction === 'down' && 'text-danger',
              delta.direction === 'flat' && 'text-text-muted',
            )}
          >
            {delta.direction === 'up' && <IconArrowUpRight size={12} />}
            {delta.direction === 'down' && <IconArrowDownRight size={12} />}
            {delta.direction === 'flat' && <IconMinus size={12} />}
            {delta.value}
          </span>
        )}
        {footer && <span className="text-xs text-text-muted">{footer}</span>}
      </div>
    </div>
  );
}
