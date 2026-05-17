'use client';

import type { ReactNode } from 'react';

export type PanelAccent = 'primary' | 'accent' | 'warn' | 'neutral';

const ACCENT_GLOW: Record<PanelAccent, { ring: string; topLine: string; iconBg: string; title: string }> = {
  primary: {
    ring: 'rgba(91,155,201,0.05)',
    topLine:
      'linear-gradient(90deg, transparent, rgba(91,155,201,0.45) 30%, rgba(95,168,184,0.40) 70%, transparent)',
    iconBg: 'linear-gradient(135deg, rgba(91,155,201,0.10), rgba(95,168,184,0.06))',
    title: 'linear-gradient(135deg, #5b9bc9 0%, #f1f5fb 60%, #5fa8b8 100%)',
  },
  accent: {
    ring: 'rgba(74,184,150,0.05)',
    topLine:
      'linear-gradient(90deg, transparent, rgba(74,184,150,0.45) 30%, rgba(91,155,201,0.35) 70%, transparent)',
    iconBg: 'linear-gradient(135deg, rgba(74,184,150,0.12), rgba(91,155,201,0.06))',
    title: 'linear-gradient(135deg, #4ab896 0%, #f1f5fb 60%, #5b9bc9 100%)',
  },
  warn: {
    ring: 'rgba(217,160,74,0.05)',
    topLine:
      'linear-gradient(90deg, transparent, rgba(217,160,74,0.40) 30%, rgba(217,101,112,0.35) 70%, transparent)',
    iconBg: 'linear-gradient(135deg, rgba(217,160,74,0.10), rgba(217,101,112,0.05))',
    title: 'linear-gradient(135deg, #d9a04a 0%, #f1f5fb 60%, #d96570 100%)',
  },
  neutral: {
    ring: 'rgba(255,255,255,0.03)',
    topLine:
      'linear-gradient(90deg, transparent, rgba(255,255,255,0.15) 50%, transparent)',
    iconBg: 'rgba(255,255,255,0.03)',
    title: 'linear-gradient(135deg, #f1f5fb 0%, #a6b3cc 100%)',
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
    <section
      className={
        'relative flex flex-col rounded-2xl border border-primary-light/15 overflow-hidden ' +
        (className ?? '')
      }
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 30% 0%, rgba(74,156,216,0.08), transparent 60%), radial-gradient(ellipse 70% 50% at 90% 100%, rgba(0,229,160,0.04), transparent 60%), linear-gradient(135deg, rgba(15,24,37,0.95), rgba(10,16,26,0.98))',
        backdropFilter: 'blur(20px)',
        boxShadow: `0 0 0 1px ${a.ring}, 0 12px 48px rgba(0,0,0,0.4)`,
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
                boxShadow: `0 0 16px ${a.ring}`,
              }}
            >
              {icon}
            </div>
          )}
          <div className="leading-tight min-w-0">
            <h2
              className="text-lg font-bold tracking-tight truncate"
              style={{
                background: a.title,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontFamily: 'var(--font-display)',
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-medium mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {headerRight}
      </header>

      <div className="flex-1 p-3 overflow-auto">{children}</div>
    </section>
  );
}
