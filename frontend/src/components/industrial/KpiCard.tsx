'use client';

import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';
import type { MetricStatus } from '@/types/metrics';
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
  type Icon as TablerIcon,
} from '@tabler/icons-react';
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

const ACCENT_BAR: Record<string, string> = {
  ok: 'from-ok/80 via-ok/40',
  warn: 'from-warn/80 via-warn/40',
  alarm: 'from-danger via-danger/40',
  unknown: 'from-text-muted/60 via-text-muted/20',
  accent: 'from-primary-light/80 via-accent/40',
};

const ICON_BG: Record<string, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  alarm: 'bg-danger-soft text-danger',
  unknown: 'bg-bg-card text-text-muted',
  accent: 'bg-primary-soft text-primary-light',
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
        'relative overflow-hidden rounded-xl p-4 group transition-all duration-300',
        'bg-gradient-to-br from-bg-card to-bg-surface',
        'border border-border hover:border-border-strong',
        pulse && 'animate-pulse-alarm',
        className,
      )}
      style={{
        boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px -16px rgba(0,0,0,0.6)',
      }}
    >
      {/* Top accent gradient bar */}
      <div
        aria-hidden
        className={cn('absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r to-transparent', ACCENT_BAR[status])}
      />

      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-medium">
          {label}
        </span>
        {Icon && (
          <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center', ICON_BG[status])}>
            <Icon size={14} />
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span
          className="mono font-semibold text-text-primary leading-none tabular-nums"
          style={{ fontSize: 'clamp(1.6rem, 2.4vw, 2.4rem)' }}
        >
          {displayValue}
        </span>
        {unit && (
          <span className="text-sm text-text-secondary font-medium">{unit}</span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        {delta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 mono tabular-nums',
              delta.direction === 'up' && 'text-ok',
              delta.direction === 'down' && 'text-danger',
              delta.direction === 'flat' && 'text-text-muted',
            )}
          >
            {delta.direction === 'up' && <IconArrowUpRight size={11} />}
            {delta.direction === 'down' && <IconArrowDownRight size={11} />}
            {delta.direction === 'flat' && <IconMinus size={11} />}
            {delta.value}
          </span>
        ) : <span />}
        {footer && (
          <span className="text-2xs text-text-muted truncate">{footer}</span>
        )}
      </div>
    </div>
  );
}
