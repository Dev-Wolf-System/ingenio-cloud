import { TopBar } from '@/components/layout/TopBar';
import { ShiftTimeline } from '@/components/industrial/ShiftTimeline';
import { KpiHero } from '@/components/industrial/KpiHero';
import { EnergyPanel } from '@/components/industrial/EnergyPanel';
import { ProductionPanel } from '@/components/industrial/ProductionPanel';
import { ShiftSummaryPanel } from '@/components/industrial/ShiftSummaryPanel';
import { CopilotBanner } from '@/components/industrial/CopilotBanner';

export default function DashboardPage() {
  return (
    <div className="grid grid-rows-[64px_4px_auto_1fr_80px] min-h-screen xl:h-screen xl:max-h-screen overflow-hidden">
      <TopBar plant="Planta Sur" />
      <ShiftTimeline />
      <KpiHero />
      <main className="grid gap-3 px-4 pb-3 grid-cols-1 xl:grid-cols-[1.05fr_1.5fr_1fr] overflow-hidden">
        <EnergyPanel />
        <ProductionPanel />
        <ShiftSummaryPanel />
      </main>
      <CopilotBanner />
    </div>
  );
}
