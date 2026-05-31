'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { IconLayoutDashboard, IconCircle } from '@tabler/icons-react';
import { TopBar } from '@/components/layout/TopBar';
import { HeightMatchedGrid } from '@/components/industrial/HeightMatchedGrid';
import { MoliendaProduccionHora } from '@/components/industrial/MoliendaProduccionHora';
import { MoliendaHero } from './_components/MoliendaHero';
import { CanchonHoraChart } from './_components/CanchonHoraChart';
import { ComparativaCana } from './_components/ComparativaCana';
import { PromediosMolienda } from './_components/PromediosMolienda';
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

// ─── Slim trapiche estado bar ─────────────────────────────────────────────────

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

  const isFuncionando = estado === 'funcionando';

  return (
    <div
      className="mx-3 sm:mx-4 my-2 flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm font-medium"
      style={{
        background: isFuncionando
          ? 'rgba(0,229,160,0.07)'
          : 'rgba(255,71,87,0.07)',
        borderColor: isFuncionando
          ? 'rgba(0,229,160,0.25)'
          : 'rgba(255,71,87,0.25)',
        color: isFuncionando ? 'var(--success)' : 'var(--danger)',
      }}
    >
      <IconCircle
        size={10}
        fill={isFuncionando ? 'var(--success)' : 'var(--danger)'}
        stroke="none"
        className={isFuncionando ? 'animate-pulse' : ''}
      />
      <span>
        Trapiche — {isFuncionando ? 'Funcionando' : 'Parado'}
      </span>
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
        <div className="flex flex-wrap items-center gap-3 px-3 sm:px-4 pt-2 pb-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border transition-colors"
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

        {/* Trapiche estado bar */}
        <TrapicheEstadoBar />

        {/* Main grid: ComparativaCana (left) + MoliendaProduccionHora real-time (right) */}
        <HeightMatchedGrid
          className="px-3 sm:px-4 pt-1 pb-2"
          colsClass="grid-cols-1 lg:grid-cols-[1.45fr_2.4fr]"
          left={<ComparativaCana />}
          right={<MoliendaProduccionHora />}
        />

        {/* Movimientos de caña — full width */}
        <div className="max-w-[1600px] mx-auto w-full px-3 sm:px-4 pb-3">
          <MovimientosCana />
        </div>

        {/* Additional sections */}
        <div className="max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-3 px-3 sm:px-4 pb-4">
          <CanchonHoraChart />
          <PromediosMolienda />
        </div>
      </div>
    </div>
  );
}
