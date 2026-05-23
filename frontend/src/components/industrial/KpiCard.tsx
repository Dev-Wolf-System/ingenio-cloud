'use client';

import { cn } from '@/lib/utils/cn';
import type { MetricStatus } from '@/types/metrics';
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
  type Icon as TablerIcon,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { m } from 'motion/react';
import { AnimatedNumber } from './AnimatedNumber';

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
  const isNumber = typeof value === 'number' && Number.isFinite(value);
  const fallbackText = !isNumber ? (value as string | null | undefined) ?? '—' : null;

  return (
    <m.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        'relative overflow-hidden rounded-xl p-4 group',
        'border',
        pulse && 'animate-pulse-alarm',
        className,
      )}
      style={{
        background:
          'linear-gradient(135deg, var(--surface-tile-from), var(--surface-tile-to))',
        borderColor: 'var(--border-strong)',
        boxShadow:
          '0 0 0 1px var(--border-subtle), 0 1px 0 var(--border-subtle) inset, 0 8px 28px -16px rgba(0,0,0,0.45)',
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
          style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.78rem)' }}
        >
          {isNumber ? (
            <AnimatedNumber value={value as number} decimals={precision} />
          ) : (
            fallbackText
          )}
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
    </m.div>
  );
}
