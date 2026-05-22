import { TopBar } from '@/components/layout/TopBar';
import { ConnectionBanner } from '@/components/layout/ConnectionBanner';
import { ShiftTimeline } from '@/components/industrial/ShiftTimeline';
import { ShiftWelcomeBanner } from '@/components/industrial/ShiftWelcomeBanner';
import { KpiHero } from '@/components/industrial/KpiHero';
import { TrapichePanel } from '@/components/industrial/TrapichePanel';
import { MoliendaProduccionHora } from '@/components/industrial/MoliendaProduccionHora';
import { EnergyPanel } from '@/components/industrial/EnergyPanel';
import { ProductionPanel } from '@/components/industrial/ProductionPanel';
import { ShiftSummaryPanel } from '@/components/industrial/ShiftSummaryPanel';
import { CopilotBanner } from '@/components/industrial/CopilotBanner';

export default function DashboardPage() {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(91,155,201,0.05), transparent 70%)',
        }}
      />

      <ConnectionBanner />
      <ShiftWelcomeBanner />

      <div className="relative z-10 flex flex-col flex-1">
        <TopBar plant="Planta Sur" />
        <ShiftTimeline />
        <KpiHero />

        <section className="px-3 sm:px-4 pt-1 pb-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <TrapichePanel />
          <MoliendaProduccionHora />
        </section>

        <main className="grid gap-3 px-3 sm:px-4 pb-3 pt-2 grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1.45fr_1.4fr_1fr] flex-1">
          <EnergyPanel />
          <ProductionPanel />
          <div className="lg:col-span-2 xl:col-span-1">
            <ShiftSummaryPanel />
          </div>
        </main>

        <CopilotBanner />
      </div>
    </div>
  );
}
