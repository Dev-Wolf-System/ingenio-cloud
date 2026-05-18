'use client';

import { useEffect, useRef, useState } from 'react';
import { IconCircleFilled, IconAlertCircle } from '@tabler/icons-react';
import { cn } from '@/lib/utils/cn';
import { formatNumber, formatRelative } from '@/lib/utils/format';
import { m } from 'motion/react';

const STALE_WARN_SEC = 60;   // > 60s = amarillo
const STALE_DEAD_SEC = 180;  // > 3min = rojo (sensor caído)

function getStaleness(updatedAt?: string): 'fresh' | 'warn' | 'dead' {
  if (!updatedAt) return 'fresh';
  const age = (Date.now() - new Date(updatedAt).getTime()) / 1000;
  if (age > STALE_DEAD_SEC) return 'dead';
  if (age > STALE_WARN_SEC) return 'warn';
  return 'fresh';
}

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

export type AlertSeverity = 'info' | 'warn' | 'critical';

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
  alert?: { severity: AlertSeverity; reason: 'low' | 'high'; min?: number | null; max?: number | null } | null;
}

const ALERT_STYLE: Record<AlertSeverity, { color: string; border: string; bg: string; glow: string }> = {
  info: {
    color: '#5b9bc9',
    border: 'rgba(91,155,201,0.55)',
    bg: 'linear-gradient(135deg, rgba(91,155,201,0.12), rgba(15,24,37,0.6))',
    glow: '0 0 20px rgba(91,155,201,0.25)',
  },
  warn: {
    color: '#d9a04a',
    border: 'rgba(217,160,74,0.55)',
    bg: 'linear-gradient(135deg, rgba(217,160,74,0.12), rgba(15,24,37,0.6))',
    glow: '0 0 24px rgba(217,160,74,0.30)',
  },
  critical: {
    color: '#d96570',
    border: 'rgba(217,101,112,0.65)',
    bg: 'linear-gradient(135deg, rgba(217,101,112,0.16), rgba(15,24,37,0.6))',
    glow: '0 0 32px rgba(217,101,112,0.40)',
  },
};

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
  alert,
}: PremiumTileProps) {
  const style = ACCENT_STYLE[accent];
  const alertStyle = alert ? ALERT_STYLE[alert.severity] : null;
  const hasValue = typeof value === 'number' ? Number.isFinite(value) : value != null && value !== '';
  const display = typeof value === 'number'
    ? formatNumber(value, precision)
    : hasValue ? String(value) : '—';

  // Re-eval staleness cada 30s
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  void now;
  const staleness = getStaleness(updatedAt);
  const isStale = staleness !== 'fresh';
  const isDead = staleness === 'dead';

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
    <m.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn(
        'relative rounded-xl border-2 overflow-hidden group',
        !alertStyle && style.borderIdle,
        !alertStyle && style.borderHover,
        alertStyle && alert?.severity === 'critical' && 'animate-pulse',
      )}
      style={{
        background: alertStyle ? alertStyle.bg : style.bg,
        backdropFilter: 'blur(8px)',
        boxShadow: alertStyle ? alertStyle.glow : style.shadow,
        borderColor: alertStyle?.border,
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
          {hasValue && !isStale && !alert && <IconCircleFilled size={5} className={style.dotColor} />}
          {alert && (
            <span
              title={`Fuera de rango (${alert.reason === 'low' ? 'mín' : 'máx'}: ${
                alert.reason === 'low' ? alert.min : alert.max
              })`}
              className="flex items-center"
            >
              <IconAlertCircle
                size={12}
                style={{ color: alertStyle?.color }}
                className={alert.severity === 'critical' ? 'animate-pulse' : ''}
              />
            </span>
          )}
          {!alert && isStale && (
            <span
              title={isDead ? 'Sensor sin datos hace +3 min' : 'Datos demorados'}
              className="flex items-center gap-0.5"
            >
              <IconAlertCircle
                size={11}
                className={isDead ? 'text-danger animate-pulse' : 'text-warn'}
              />
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-1 mono">
          <m.span
            key={display}
            initial={{ scale: 1.08, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className={cn(
              'font-semibold tabular-nums leading-none inline-block transition-colors',
              big ? 'text-2xl' : 'text-lg',
              !alertStyle && (isDead ? 'text-text-disabled' : isStale ? 'text-text-muted' : style.valueColor),
            )}
            style={alertStyle ? { color: alertStyle.color } : undefined}
          >
            {display}
          </m.span>
          {unit && <span className="text-2xs text-text-muted font-medium">{unit}</span>}
        </div>

        {hint && (
          <div className="text-[9px] text-text-disabled mono mt-1">{hint}</div>
        )}
        {!hint && updatedAt && (
          <div className="text-[9px] text-text-disabled mono mt-1">{formatRelative(updatedAt)}</div>
        )}
      </div>
    </m.div>
  );
}
