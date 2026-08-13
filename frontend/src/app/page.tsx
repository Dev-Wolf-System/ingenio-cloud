import { TopBar } from '@/components/layout/TopBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Footer } from '@/components/layout/Footer';
import { SectionGuard } from '@/components/layout/SectionGuard';
import { ConnectionBanner } from '@/components/layout/ConnectionBanner';
import { ShiftTimeline } from '@/components/industrial/ShiftTimeline';
import { ShiftWelcomeBanner } from '@/components/industrial/ShiftWelcomeBanner';
import { KpiHero } from '@/components/industrial/KpiHero';
import { TrapichePanel } from '@/components/industrial/TrapichePanel';
import { MoliendaProduccionHora } from '@/components/industrial/MoliendaProduccionHora';
import { HeightMatchedGrid } from '@/components/industrial/HeightMatchedGrid';
import { EnergyPanel } from '@/components/industrial/EnergyPanel';
import { ProductionPanel } from '@/components/industrial/ProductionPanel';
import { ShiftSummaryPanel } from '@/components/industrial/ShiftSummaryPanel';
import { CopilotBanner } from '@/components/industrial/CopilotBanner';

export default function DashboardPage() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <SectionGuard section="dashboard" />
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
        <Sidebar />
        <TopBar plant="Sala de Monitoreo" />
        <ShiftTimeline />
        <KpiHero />

        <HeightMatchedGrid
          className="px-3 sm:px-4 pt-1 pb-2"
          colsClass="grid-cols-1 lg:grid-cols-[1.45fr_2.4fr]"
          left={<TrapichePanel />}
          right={<MoliendaProduccionHora />}
        />

        <main className="grid gap-3 px-3 sm:px-4 pb-3 pt-2 grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1.45fr_1.4fr_1fr] items-start flex-1">
          <EnergyPanel />
          <ProductionPanel />
          <div className="lg:col-span-2 xl:col-span-1">
            <ShiftSummaryPanel />
          </div>
        </main>

        <CopilotBanner />
        <Footer />
      </div>
    </div>
  );
}
