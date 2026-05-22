'use client';

import { useEffect, useRef, useState } from 'react';
import { IconCircleFilled, IconAlertCircle } from '@tabler/icons-react';
import { cn } from '@/lib/utils/cn';
import { formatNumber, parseServerDate } from '@/lib/utils/format';
import { m } from 'motion/react';

const STALE_WARN_SEC = 15;   // > 15s = amarillo (sensor demorado)
const STALE_DEAD_SEC = 30;   // > 30s = rojo (sensor caído)

function getStaleness(updatedAt?: string): 'fresh' | 'warn' | 'dead' {
  if (!updatedAt) return 'fresh';
  const d = parseServerDate(updatedAt);
  if (!d) return 'fresh';
  const age = (Date.now() - d.getTime()) / 1000;
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
    bg: 'linear-gradient(135deg, var(--surface-tile-primary-from), var(--surface-tile-to))',
    shadow: '0 2px 12px var(--primary-glow)',
    iconColor: 'text-primary-light',
    iconBg: 'var(--primary-soft)',
    valueColor: 'text-primary-light',
    dotColor: 'text-primary-light',
  },
  accent: {
    borderIdle: 'border-ok/20',
    borderHover: '',
    bg: 'linear-gradient(135deg, var(--surface-tile-accent-from), var(--surface-tile-to))',
    shadow: '0 2px 12px var(--accent-glow)',
    iconColor: 'text-ok',
    iconBg: 'var(--ok-soft)',
    valueColor: 'text-ok',
    dotColor: 'text-ok',
  },
  warn: {
    borderIdle: 'border-warn/25',
    borderHover: '',
    bg: 'linear-gradient(135deg, var(--surface-tile-warn-from), var(--surface-tile-to))',
    iconColor: 'text-warn',
    iconBg: 'var(--warn-soft)',
    valueColor: 'text-warn',
    dotColor: 'text-warn',
  },
  danger: {
    borderIdle: 'border-danger/30',
    borderHover: '',
    bg: 'linear-gradient(135deg, var(--surface-tile-danger-from), var(--surface-tile-to))',
    iconColor: 'text-danger',
    iconBg: 'var(--danger-soft)',
    valueColor: 'text-danger',
    dotColor: 'text-danger',
  },
  neutral: {
    borderIdle: 'border-border',
    borderHover: 'hover:border-primary-light/30',
    bg: 'linear-gradient(135deg, var(--surface-tile-from), var(--surface-tile-to))',
    iconColor: 'text-text-muted',
    iconBg: 'var(--bg-card-2)',
    valueColor: 'text-text-primary',
    dotColor: 'text-ok',
  },
};

export type AlertSeverity = 'info' | 'warn' | 'critical';

export type TileSize = 'sm' | 'md' | 'lg' | 'hero';

export interface PremiumTileProps {
  icon?: React.ReactNode;
  label: string;
  value?: number | string | null;
  unit?: string;
  precision?: number;
  accent?: TileAccent;
  /** @deprecated usar size='lg' o size='hero' */
  big?: boolean;
  size?: TileSize;
  updatedAt?: string;
  hint?: string;
  alert?: { severity: AlertSeverity; reason: 'low' | 'high'; min?: number | null; max?: number | null } | null;
  /** Si se define, el tile es clickeable (cursor pointer + handler) */
  onClick?: () => void;
}

const ALERT_STYLE: Record<AlertSeverity, { color: string; border: string; bg: string; glow: string }> = {
  info: {
    color: 'var(--info)',
    border: 'var(--info)',
    bg: 'linear-gradient(135deg, var(--info-soft), var(--surface-tile-to))',
    glow: '0 0 20px var(--info-soft)',
  },
  warn: {
    color: 'var(--warn)',
    border: 'var(--warn)',
    bg: 'linear-gradient(135deg, var(--warn-soft), var(--surface-tile-to))',
    glow: '0 0 24px var(--warn-soft)',
  },
  critical: {
    color: 'var(--danger)',
    border: 'var(--danger)',
    bg: 'linear-gradient(135deg, var(--danger-soft), var(--surface-tile-to))',
    glow: '0 0 32px var(--danger-soft)',
  },
};

const SIZE_CONFIG = {
  sm:   { pad: 'p-3',         valueText: 'text-xl',                  labelText: 'text-[11px]', iconSize: 5, gap: 'gap-1' },
  md:   { pad: 'p-3.5',       valueText: 'text-2xl sm:text-[4rem] sm:leading-none', labelText: 'text-[11px]', iconSize: 5, gap: 'gap-1.5' },
  lg:   { pad: 'p-4',         valueText: 'text-4xl',                 labelText: 'text-[12px]', iconSize: 6, gap: 'gap-2' },
  hero: { pad: 'p-5 sm:p-6',  valueText: 'text-5xl sm:text-6xl',     labelText: 'text-[13px]', iconSize: 7, gap: 'gap-2' },
} as const;

export function PremiumTile({
  icon,
  label,
  value,
  unit,
  precision = 2,
  accent = 'neutral',
  big = false,
  size,
  updatedAt,
  hint,
  alert,
  onClick,
}: PremiumTileProps) {
  const style = ACCENT_STYLE[accent];
  const alertStyle = alert ? ALERT_STYLE[alert.severity] : null;
  const tileSize: TileSize = size ?? (big ? 'lg' : 'md');
  const sizeConfig = SIZE_CONFIG[tileSize];
  const hasValue = typeof value === 'number' ? Number.isFinite(value) : value != null && value !== '';
  const display = typeof value === 'number'
    ? formatNumber(value, precision)
    : hasValue ? String(value) : '—';

  // Re-eval staleness cada 5s (responsive a corte conexión)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
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
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        'relative rounded-xl border-2 overflow-hidden group',
        !alertStyle && style.borderIdle,
        !alertStyle && style.borderHover,
        alertStyle && alert?.severity === 'critical' && 'animate-pulse',
        onClick && 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
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
          background: 'radial-gradient(circle at 50% 100%, var(--primary-glow), transparent 60%)',
        }}
      />

      {/* Flash overlay */}
      {flash && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, var(--primary-soft), transparent)',
            animation: 'flash 500ms ease-out forwards',
          }}
        />
      )}

      <div className={cn('relative', sizeConfig.pad)}>
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
            <span className={cn('uppercase tracking-[0.10em] text-text-primary font-medium truncate', sizeConfig.labelText)}>
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
              sizeConfig.valueText,
              !alertStyle && (isDead ? 'text-text-disabled' : isStale ? 'text-text-muted' : style.valueColor),
            )}
            style={alertStyle ? { color: alertStyle.color } : undefined}
          >
            {display}
          </m.span>
          {unit && <span className="text-2xs text-text-muted font-medium">{unit}</span>}
        </div>

        {hint && (
          <div className="text-[10px] text-text-primary mono mt-1.5 truncate">{hint}</div>
        )}
      </div>
    </m.div>
  );
}
