'use client';
import Link from 'next/link';
import { useMemo } from 'react';
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

// ─── Trapiche estado helpers (same logic as TrapichePanel) ────────────────────

type EstadoTrapiche = 'funcionando' | 'parado';

const ESTADO_KEYS = ['trapiche_estado', 'estado', 'estado_trapiche', 'status'];
const VAPOR_VG1_KEY_PATTERNS = ['presion_vapor_vg1', 'vapor_vg1', 'p_vapor_vg1'];
const VAPOR_VG1_THRESHOLD = 1.9;

function pickItem(map: Map<string, DashboardItem>, candidates: string[]): DashboardItem | null {
  const entries = Array.from(map.entries());
  for (const cand of candidates) {
    const lower = cand.toLowerCase();
    for (const [key, item] of entries) {
      if (key.toLowerCase() === lower) return item;
    }
  }
  return null;
}

function parseEstadoExplicit(item: DashboardItem | null): EstadoTrapiche | null {
  if (!item) return null;
  if (typeof item.value === 'number') {
    if (item.value === 1) return 'funcionando';
    if (item.value === 0) return 'parado';
  }
  const s = (item.display ?? '').toString().toLowerCase();
  if (s.includes('func') || s === 'on' || s === 'true' || s === '1') return 'funcionando';
  if (s.includes('par') || s === 'off' || s === 'false' || s === '0') return 'parado';
  return null;
}

function deriveEstadoFromVaporVg1(energia: Map<string, DashboardItem>): EstadoTrapiche | null {
  const entries = Array.from(energia.entries());
  for (const pattern of VAPOR_VG1_KEY_PATTERNS) {
    for (const [k, item] of entries) {
      if (k.toLowerCase().includes(pattern)) {
        return item.value > VAPOR_VG1_THRESHOLD ? 'funcionando' : 'parado';
      }
    }
  }
  return null;
}

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

// ─── Trapiche estado bar ──────────────────────────────────────────────────────

function TrapicheEstadoBar() {
  const trapiche = useDashboardData('trapiche');
  const energia = useDashboardData('energia');

  const estado = useMemo<EstadoTrapiche>(() => {
    const explicit = parseEstadoExplicit(pickItem(trapiche, ESTADO_KEYS));
    if (explicit) return explicit;
    const derived = deriveEstadoFromVaporVg1(energia);
    if (derived) return derived;
    return 'parado';
  }, [trapiche, energia]);

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
            className="text-2xl lg:text-3xl font-extrabold uppercase tracking-[0.18em] relative"
            style={{
              color: config.color,
              textShadow: `0 0 10px ${config.bg}`,
              fontFamily: 'var(--font-body)',
            }}
          >
            {config.label}
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
        <TopBar plant="Molienda Cloud" />

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
          right={<MoliendaProduccionHora />}
        />

        {/* Movimientos de caña — full width (sin max-w, ocupa todo el ancho) */}
        <div className="w-full px-3 sm:px-4 pb-3">
          <MovimientosCana />
        </div>

      </div>
    </div>
  );
}
