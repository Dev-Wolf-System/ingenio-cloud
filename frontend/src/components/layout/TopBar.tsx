'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { IconMaximize, IconCircleFilled, IconActivity, IconBell } from '@tabler/icons-react';
import { useClock } from '@/lib/hooks/useClock';
import { useShift } from '@/lib/hooks/useShift';
import { formatTime } from '@/lib/utils/format';
import { ThemeToggle } from './ThemeToggle';

export function TopBar({ plant = 'Planta Sur' }: { plant?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const now = useClock();
  const shift = useShift();

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  return (
    <header
      className="flex items-center justify-between gap-4 border-b border-border px-5 h-16 relative overflow-hidden"
      style={{
        background: 'var(--header-bg)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Decoración: mesh sutil esquina izquierda — adapta tema */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: 'radial-gradient(circle at 0% 50%, var(--primary-glow) 0%, transparent 38%)',
        }}
      />

      {/* Brand */}
      <div className="relative flex items-center gap-3">
        <div className="relative w-10 h-10 flex items-center justify-center rounded-lg overflow-hidden bg-bg-card ring-1 ring-border-strong">
          <Image
            src="/logo-ingenio-cloud.png"
            alt="Ingenio Cloud"
            width={40}
            height={40}
            priority
            className="object-contain"
          />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-base font-semibold text-text-primary tracking-tight">
            Ingenio <span className="text-primary-light">Cloud</span>
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-medium">
            {plant} · Ingenio La Corona
          </span>
        </div>
      </div>

      {/* Estado + reloj + acciones */}
      <div className="relative flex items-center gap-4">
        {/* Realtime status chip */}
        <span className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wider font-medium text-ok bg-ok-soft px-2 py-1 rounded-full border border-ok/20">
          <IconCircleFilled size={7} className="animate-pulse" />
          Realtime
        </span>

        {/* Shift chip */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-bg-card border border-border" suppressHydrationWarning>
          <IconActivity size={13} className="text-primary-light" />
          <div className="flex flex-col leading-none">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">
              {mounted ? shift.displayName : '—'}
            </span>
            <span className="text-2xs mono text-text-secondary">
              {mounted ? `${Math.round(shift.progress * 100)}% transcurrido` : '— %'}
            </span>
          </div>
        </div>

        {/* Reloj */}
        <div className="flex flex-col items-end leading-tight" suppressHydrationWarning>
          <span className="mono text-base font-medium text-text-primary tabular-nums">
            {mounted ? formatTime(now) : '--:--:--'}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            {mounted
              ? new Intl.DateTimeFormat('es-AR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'America/Argentina/Buenos_Aires',
                }).format(now)
              : '—'}
          </span>
        </div>

        {/* Cambiar tema claro/oscuro */}
        <ThemeToggle />

        {/* Configurar alertas */}
        <Link
          href="/alertas"
          className="p-2 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-warn"
          aria-label="Configurar alertas"
          title="Configurar alertas (mín/máx)"
        >
          <IconBell size={17} />
        </Link>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary"
          aria-label="Pantalla completa"
          title="Fullscreen (F)"
        >
          <IconMaximize size={17} />
        </button>
      </div>
    </header>
  );
}
