'use client';

import { useEffect, useRef, useState } from 'react';
import { IconCircleFilled } from '@tabler/icons-react';
import { cn } from '@/lib/utils/cn';
import { formatNumber, formatRelative } from '@/lib/utils/format';

export type TileAccent = 'primary' | 'neutral' | 'accent' | 'warn' | 'danger';

const ACCENT_STYLE: Record<TileAccent, {
  borderIdle: string;
  borderHover: string;
  bg: string;
  shadow?: string;
  iconColor: string;
  iconBg: string;
  valueColor: string;
  dotColor: string;
}> = {
  primary: {
    borderIdle: 'border-primary-light/20',
    borderHover: '',
    bg: 'linear-gradient(135deg, rgba(91,155,201,0.08), rgba(15,24,37,0.7))',
    shadow: '0 2px 12px rgba(91,155,201,0.06)',
    iconColor: 'text-primary-light',
    iconBg: 'rgba(91,155,201,0.10)',
    valueColor: 'text-primary-light',
    dotColor: 'text-primary-light',
  },
  accent: {
    borderIdle: 'border-ok/20',
    borderHover: '',
    bg: 'linear-gradient(135deg, rgba(74,184,150,0.07), rgba(15,24,37,0.7))',
    shadow: '0 2px 12px rgba(74,184,150,0.06)',
    iconColor: 'text-ok',
    iconBg: 'rgba(74,184,150,0.10)',
    valueColor: 'text-ok',
    dotColor: 'text-ok',
  },
  warn: {
    borderIdle: 'border-warn/25',
    borderHover: '',
    bg: 'linear-gradient(135deg, rgba(217,160,74,0.07), rgba(15,24,37,0.7))',
    iconColor: 'text-warn',
    iconBg: 'rgba(217,160,74,0.10)',
    valueColor: 'text-warn',
    dotColor: 'text-warn',
  },
  danger: {
    borderIdle: 'border-danger/30',
    borderHover: '',
    bg: 'linear-gradient(135deg, rgba(217,101,112,0.07), rgba(15,24,37,0.7))',
    iconColor: 'text-danger',
    iconBg: 'rgba(217,101,112,0.10)',
    valueColor: 'text-danger',
    dotColor: 'text-danger',
  },
  neutral: {
    borderIdle: 'border-border',
    borderHover: 'hover:border-primary-light/30',
    bg: 'linear-gradient(135deg, rgba(26,34,54,0.6), rgba(15,24,37,0.85))',
    iconColor: 'text-text-muted',
    iconBg: 'rgba(255,255,255,0.03)',
    valueColor: 'text-text-primary',
    dotColor: 'text-ok',
  },
};

export interface PremiumTileProps {
  icon?: React.ReactNode;
  label: string;
  value?: number | string | null;
  unit?: string;
  precision?: number;
  accent?: TileAccent;
  big?: boolean;
  updatedAt?: string;
  hint?: string;
}

export function PremiumTile({
  icon,
  label,
  value,
  unit,
  precision = 2,
  accent = 'neutral',
  big = false,
  updatedAt,
  hint,
}: PremiumTileProps) {
  const style = ACCENT_STYLE[accent];
  const hasValue = typeof value === 'number' ? Number.isFinite(value) : value != null && value !== '';
  const display = typeof value === 'number'
    ? formatNumber(value, precision)
    : hasValue ? String(value) : '—';

  // Flash on value change
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value && prev.current !== undefined) {
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 500);
      prev.current = value;
      return () => clearTimeout(id);
    }
    prev.current = value;
  }, [value]);

  return (
    <div
      className={cn(
        'relative rounded-xl border overflow-hidden group transition-all duration-300',
        style.borderIdle,
        style.borderHover,
      )}
      style={{
        background: style.bg,
        backdropFilter: 'blur(8px)',
        boxShadow: style.shadow,
      }}
    >
      {/* Hover glow */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 100%, rgba(74,156,216,0.10), transparent 60%)',
        }}
      />

      {/* Flash overlay */}
      {flash && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, rgba(74,156,216,0.18), transparent)',
            animation: 'flash 500ms ease-out forwards',
          }}
        />
      )}

      <div className={cn('relative', big ? 'p-3.5' : 'p-3')}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {icon && (
              <span
                className={cn(
                  'flex items-center justify-center w-5 h-5 rounded-md shrink-0',
                  style.iconColor,
                )}
                style={{ background: style.iconBg }}
              >
                {icon}
              </span>
            )}
            <span className="text-[10px] uppercase tracking-[0.10em] text-text-muted font-medium truncate">
              {label}
            </span>
          </div>
          {hasValue && <IconCircleFilled size={5} className={style.dotColor} />}
        </div>

        <div className="flex items-baseline gap-1 mono">
          <span
            className={cn(
              'font-semibold tabular-nums leading-none',
              big ? 'text-2xl' : 'text-lg',
              style.valueColor,
            )}
          >
            {display}
          </span>
          {unit && <span className="text-2xs text-text-muted font-medium">{unit}</span>}
        </div>

        {hint && (
          <div className="text-[9px] text-text-disabled mono mt-1">{hint}</div>
        )}
        {!hint && updatedAt && (
          <div className="text-[9px] text-text-disabled mono mt-1">{formatRelative(updatedAt)}</div>
        )}
      </div>
    </div>
  );
}
