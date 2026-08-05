'use client';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { m, AnimatePresence } from 'motion/react';
import { IconLayoutDashboard } from '@tabler/icons-react';
import { cn } from '@/lib/utils/cn';
import { TopBar } from '@/components/layout/TopBar';
import { HeightMatchedGrid } from '@/components/industrial/HeightMatchedGrid';
import { MoliendaProduccionHora } from '@/components/industrial/MoliendaProduccionHora';
import { MoliendaHero } from './_components/MoliendaHero';
import { ComparativaCana } from './_components/ComparativaCana';
import { AnalisisAzucarModal } from './_components/AnalisisAzucarModal';
import { ResumenFabricaModal } from './_components/ResumenFabricaModal';
import { MovimientosCana } from './_components/MovimientosCana';
import { useDashboardData, type DashboardItem } from '@/lib/hooks/useDashboardData';
import { useTrapicheEstado, type EstadoTrapiche } from '@/lib/hooks/useTrapicheEstado';

// ─── Trapiche estado config (same as TrapichePanel) ──────────────────────────

const ESTADO_CONFIG = {
  funcionando: {
    label: 'Funcionando',
    color: 'var(--ok)',
    bg: 'var(--ok-soft)',
    border: 'var(--ok)',
    glow: '0 0 28px var(--ok-soft), inset 0 0 16px var(--ok-soft)',
    pulse: true,
  },
  parado: {
    label: 'Parado',
    color: 'var(--danger)',
    bg: 'var(--danger-soft)',
    border: 'var(--danger)',
    glow: '0 0 24px var(--danger-soft), inset 0 0 14px var(--danger-soft)',
    pulse: false,
  },
} as const;

// ─── Parada duration helpers ──────────────────────────────────────────────────

async function fetchParadaAbierta(): Promise<{ inicio_ts: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  try {
    const res = await fetch(
      `${url}/rest/v1/v_parada_activa?select=inicio_ts,motivo,maquina&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': 'production' } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { inicio_ts: string }[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function formatDuracion(inicio: string): string {
  const diffMs = Date.now() - new Date(inicio).getTime();
  const totalMin = Math.floor(diffMs / 60_000);
  const dias = Math.floor(totalMin / 1440);
  const horas = Math.floor((totalMin % 1440) / 60);
  const min = totalMin % 60;
  if (dias > 0) return `${dias}d ${horas}h ${min}min`;
  if (horas > 0) return `${horas}h ${min}min`;
  return `${min}min`;
}

// ─── Trapiche estado bar ──────────────────────────────────────────────────────

function TrapicheEstadoBar() {
  const trapiche = useDashboardData('trapiche');
  const energia = useDashboardData('energia');

  const estado = useTrapicheEstado(trapiche, energia);

  const paradaQ = useQuery({
    queryKey: ['parada-activa'],
    queryFn: fetchParadaAbierta,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  const paradaDuracion = paradaQ.data?.inicio_ts ? formatDuracion(paradaQ.data.inicio_ts) : null;

  const config = ESTADO_CONFIG[estado];

  return (
    <div className="w-full px-3 sm:px-4 my-2">
      <AnimatePresence mode="wait">
        <m.div
          key={estado}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="relative flex items-center justify-center gap-4 px-6 py-3.5 lg:py-4 rounded-xl border-2 overflow-hidden"
          style={{
            background: `linear-gradient(90deg, ${config.bg} 0%, var(--bg-inset) 50%, ${config.bg} 100%)`,
            borderColor: config.border,
            boxShadow: config.glow,
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(ellipse at center, ${config.bg}, transparent 70%)`,
              animation: config.pulse ? 'pulse 2.5s ease-in-out infinite' : undefined,
            }}
          />

          <span className="text-2xs uppercase tracking-[0.22em] text-text-muted font-medium relative">
            Estado actual
          </span>

          <span
            className={cn(
              'relative flex items-center justify-center w-4 h-4 lg:w-5 lg:h-5 rounded-full',
              config.pulse && 'animate-pulse',
            )}
            style={{ background: config.color, boxShadow: `0 0 20px ${config.color}` }}
          >
            {config.pulse && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: config.color, opacity: 0.65 }}
              />
            )}
          </span>

          <span
            className="relative flex flex-col items-center gap-0.5"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <span
              className="text-2xl lg:text-3xl font-extrabold uppercase tracking-[0.18em]"
              style={{ color: config.color, textShadow: `0 0 10px ${config.bg}` }}
            >
              {config.label}
            </span>
            {estado === 'parado' && paradaDuracion && (
              <span
                className="text-2xs font-medium tracking-wide normal-case"
                style={{ color: config.color, opacity: 0.7 }}
              >
                ⏱ {paradaDuracion}
              </span>
            )}
          </span>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MoliendaCloudPage() {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,229,160,0.05), transparent 70%)',
        }}
      />

      <div className="relative z-10 flex flex-col flex-1">
        <TopBar plant="Molienda Cloud" showAlertas={false} showResumenTurno={false} />

        {/* Header strip */}
        <div className="flex flex-nowrap items-center gap-1.5 sm:gap-3 px-3 sm:px-4 pt-2 pb-1 overflow-x-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border transition-colors whitespace-nowrap shrink-0"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--primary-light)';
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
            }}
          >
            <IconLayoutDashboard size={16} />
            → Dashboard de Monitoreo
          </Link>
          <AnalisisAzucarModal />
          <ResumenFabricaModal />
        </div>

        {/* Hero — KPI tiles with Paradas tile */}
        <MoliendaHero />

        {/* Trapiche estado bar — exact design from TrapichePanel EstadoBanner */}
        <TrapicheEstadoBar />

        {/* Main grid: ComparativaCana (left) + MoliendaProduccionHora real-time (right) */}
        <HeightMatchedGrid
          className="px-3 sm:px-4 pt-1 pb-2"
          colsClass="grid-cols-1 lg:grid-cols-[1.45fr_2.4fr]"
          left={<ComparativaCana />}
          right={
            <div className="lg:h-full lg:min-h-0 lg:overflow-y-auto">
              <MoliendaProduccionHora />
            </div>
          }
        />

        {/* Movimientos de caña — full width (sin max-w, ocupa todo el ancho) */}
        <div className="w-full px-3 sm:px-4 pb-3">
          <MovimientosCana />
        </div>

      </div>
    </div>
  );
}
