'use client';

import { IconTable } from '@tabler/icons-react';
import { PremiumPanel } from './PremiumPanel';

/**
 * Tabla Molienda y Producción Hora por Hora.
 * Va al lado de TrapichePanel (mitad derecha de la pantalla).
 * Columnas y datos pendientes de definición.
 */
export function MoliendaProduccionHora() {
  return (
    <PremiumPanel
      title="MOLIENDA Y PRODUCCIÓN HORA POR HORA"
      subtitle="Detalle horario del turno"
      icon={<IconTable size={18} className="text-primary-light" />}
      accent="primary"
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
        <div
          className="relative w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(74,156,216,0.15), transparent)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          <IconTable size={24} className="text-primary-light/60" />
        </div>
        <p className="text-xs text-text-muted">Pendiente: definir columnas y datos.</p>
      </div>
    </PremiumPanel>
  );
}
