'use client';

import type { ReactNode } from 'react';
import { m } from 'motion/react';

export type PanelAccent = 'primary' | 'accent' | 'warn' | 'neutral';

const ACCENT_GLOW: Record<PanelAccent, { topLine: string; iconBg: string; titleGradient: string }> = {
  primary: {
    topLine: 'var(--panel-accent-line)',
    iconBg: 'var(--icon-box-bg)',
    titleGradient:
      'linear-gradient(135deg, var(--primary-light) 0%, var(--text-primary) 60%, var(--accent) 100%)',
  },
  accent: {
    topLine:
      'linear-gradient(90deg, transparent, var(--ok) 30%, var(--primary-light) 70%, transparent)',
    iconBg: 'linear-gradient(135deg, var(--ok-soft), var(--primary-soft))',
    titleGradient:
      'linear-gradient(135deg, var(--ok) 0%, var(--text-primary) 60%, var(--primary-light) 100%)',
  },
  warn: {
    topLine:
      'linear-gradient(90deg, transparent, var(--warn) 30%, var(--accent) 70%, transparent)',
    iconBg: 'linear-gradient(135deg, var(--warn-soft), var(--accent-soft))',
    titleGradient:
      'linear-gradient(135deg, var(--warn) 0%, var(--text-primary) 60%, var(--accent) 100%)',
  },
  neutral: {
    topLine:
      'linear-gradient(90deg, transparent, var(--border-strong) 50%, transparent)',
    iconBg: 'var(--bg-card-2)',
    titleGradient: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
  },
};

export interface PremiumPanelProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  accent?: PanelAccent;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PremiumPanel({
  title,
  subtitle,
  icon,
  accent = 'primary',
  headerRight,
  children,
  className,
}: PremiumPanelProps) {
  const a = ACCENT_GLOW[accent];

  return (
    <m.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={
        'relative flex flex-col rounded-2xl border border-primary-light/15 overflow-hidden ' +
        (className ?? '')
      }
      style={{
        background:
          'var(--panel-mesh-1), var(--panel-mesh-2), linear-gradient(135deg, var(--surface-panel-from), var(--surface-panel-to))',
        backdropFilter: 'blur(20px)',
        boxShadow: 'var(--panel-shadow)',
      }}
    >
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: a.topLine }}
      />

      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2.5 border-b border-border/40">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && (
            <div
              className="relative w-9 h-9 rounded-lg flex items-center justify-center border border-primary-light/20 shrink-0"
              style={{
                background: a.iconBg,
                boxShadow: '0 0 16px var(--primary-glow)',
              }}
            >
              {icon}
            </div>
          )}
          <div className="leading-tight min-w-0">
            <h2
              className="text-lg font-bold tracking-tight truncate"
              style={{
                background: a.titleGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontFamily: 'var(--font-display)',
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-secondary font-medium mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {headerRight}
      </header>

      <div className="flex-1 p-3 overflow-hidden flex flex-col">{children}</div>
    </m.section>
  );
}
