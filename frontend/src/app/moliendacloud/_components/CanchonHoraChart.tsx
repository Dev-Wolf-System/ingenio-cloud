'use client';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';

export function CanchonHoraChart() {
  return (
    <PremiumPanel title="LLEGADA DE CAMIONES · HORA × HORA" subtitle="Canchón" accent="primary">
      <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>En construcción</p>
    </PremiumPanel>
  );
}
