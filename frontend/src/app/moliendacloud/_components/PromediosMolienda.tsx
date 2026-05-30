'use client';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';

export function PromediosMolienda() {
  return (
    <PremiumPanel title="PROMEDIOS DE MOLIENDA" subtitle="Por bloque / turno / zafra" accent="neutral">
      <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>En construcción</p>
    </PremiumPanel>
  );
}
