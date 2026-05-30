'use client';
import Link from 'next/link';
import { IconLayoutDashboard } from '@tabler/icons-react';
import { TopBar } from '@/components/layout/TopBar';
import { MoliendaProduccionHora } from '@/components/industrial/MoliendaProduccionHora';
import { MovimientosHero } from './_components/MovimientosHero';
import { CanchonHoraChart } from './_components/CanchonHoraChart';
import { ComparativaCana } from './_components/ComparativaCana';
import { PromediosMolienda } from './_components/PromediosMolienda';
import { AnalisisAzucarModal } from './_components/AnalisisAzucarModal';
import { ResumenFabricaModal } from './_components/ResumenFabricaModal';
import { MovimientosCana } from './_components/MovimientosCana';

export default function MoliendaCloudPage() {
  return (
    <div className="relative min-h-screen flex flex-col">
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

        <div className="px-3 sm:px-4 pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border transition-colors"
            style={{
              color: 'var(--text-muted)',
              borderColor: 'var(--border)',
            }}
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
            Dashboard de Monitoreo
          </Link>
        </div>

        <div className="flex flex-col gap-4 px-3 sm:px-4 py-4">
          <MovimientosHero />
          <MoliendaProduccionHora />

          <main className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CanchonHoraChart />
            <ComparativaCana />
            <PromediosMolienda />
            <MovimientosCana />
          </main>

          <div className="flex flex-wrap gap-3">
            <AnalisisAzucarModal />
            <ResumenFabricaModal />
          </div>
        </div>
      </div>
    </div>
  );
}
