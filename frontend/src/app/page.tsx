import { TopBar } from '@/components/layout/TopBar';
import { ShiftTimeline } from '@/components/industrial/ShiftTimeline';
import { KpiHero } from '@/components/industrial/KpiHero';
import { EnergyPanel } from '@/components/industrial/EnergyPanel';
import { ProductionPanel } from '@/components/industrial/ProductionPanel';
import { ShiftSummaryPanel } from '@/components/industrial/ShiftSummaryPanel';
import { CopilotBanner } from '@/components/industrial/CopilotBanner';

export default function DashboardPage() {
  return (
    <div className="grid grid-rows-[64px_3px_auto_1fr_84px] min-h-screen xl:h-screen xl:max-h-screen overflow-hidden relative">
      {/* Background accent — hero atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(74,156,216,0.07), transparent 70%)',
        }}
      />

      <div className="relative z-10 contents">
        <TopBar plant="Planta Sur" />
        <ShiftTimeline />
        <KpiHero />
        <main className="grid gap-3 px-4 pb-3 grid-cols-1 xl:grid-cols-[1.05fr_1.6fr_1fr] overflow-hidden">
          <EnergyPanel />
          <ProductionPanel />
          <ShiftSummaryPanel />
        </main>
        <CopilotBanner />
      </div>
    </div>
  );
}
