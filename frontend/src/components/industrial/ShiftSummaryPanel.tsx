'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  IconClock,
  IconRefresh,
  IconScale,
  IconFlame,
  IconPlayerPause,
  IconRotateClockwise,
} from '@tabler/icons-react';
import { PremiumPanel } from './PremiumPanel';
import { PremiumTile } from './PremiumTile';
import { MillSpeedChart, type MillSpeedPayload } from './MillSpeedChart';
import { AnalisisIA } from './AnalisisIA';
import { formatNumber } from '@/lib/utils/format';

async function fetchGuardia(path: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/guardia/${path}`);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

export function ShiftSummaryPanel() {
  const queryClient = useQueryClient();
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['guardia'] });
  };

  const molienda = useQuery({
    queryKey: ['guardia', 'molienda'],
    queryFn: () => fetchGuardia('molienda'),
    staleTime: 5 * 60_000,
  });
  const moliendaPrev = useQuery({
    queryKey: ['guardia', 'molienda-previo'],
    queryFn: () => fetchGuardia('molienda-previo'),
    staleTime: 60 * 60_000,
  });
  const gas = useQuery({
    queryKey: ['guardia', 'gas-previo'],
    queryFn: () => fetchGuardia('gas-previo'),
    staleTime: 60 * 60_000,
  });
  const paradas = useQuery({
    queryKey: ['guardia', 'paradas'],
    queryFn: () => fetchGuardia('paradas'),
    staleTime: 60 * 60_000,
  });
  const vel = useQuery({
    queryKey: ['guardia', 'vel-molino'],
    queryFn: () => fetchGuardia('vel-molino'),
    staleTime: 60 * 60_000,
  });

  const moliendaActual = (molienda.data as { promedio_t_h?: number } | undefined)?.promedio_t_h;
  const moliendaKgH = (moliendaPrev.data as { molienda_promedio_kg_h?: number } | undefined)
    ?.molienda_promedio_kg_h;
  const moliendaPrevTh = typeof moliendaKgH === 'number' ? moliendaKgH / 1000 : undefined;
  const moliendaTotalKg = (moliendaPrev.data as { molienda_total_kg?: number } | undefined)
    ?.molienda_total_kg;
  const gasM3h = (gas.data as { 'consumo_promedio_m3/h'?: number } | undefined)?.['consumo_promedio_m3/h'];
  const gasTotal = (gas.data as { consumo_total_m3?: number } | undefined)?.consumo_total_m3;
  const paradasCant = (paradas.data as { cantidad_paradas?: number } | undefined)?.cantidad_paradas;
  const paradasMin = (paradas.data as { tiempo_neto_total_min?: number } | undefined)?.tiempo_neto_total_min;
  const velPromedio = (vel.data as { promedio?: number } | undefined)?.promedio;

  return (
    <PremiumPanel
      title="RESUMEN GUARDIA"
      subtitle="Turno anterior · datos consolidados"
      icon={<IconClock size={18} className="text-primary-light" />}
      accent="primary"
      headerRight={
        <button
          onClick={refreshAll}
          className="inline-flex items-center gap-1.5 text-2xs text-text-muted hover:text-primary-light transition-colors px-2 py-1 rounded-md hover:bg-bg-hover border border-transparent hover:border-border-strong shrink-0"
          title="Refrescar KPIs"
        >
          <IconRefresh size={12} />
          Refrescar
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
        <PremiumTile
          icon={<IconScale size={14} />}
          label="Molienda actual"
          value={moliendaActual}
          unit="t/h"
          precision={1}
          accent="primary"
          size="lg"
        />
        <PremiumTile
          icon={<IconScale size={14} />}
          label="Molienda turno previo"
          value={moliendaPrevTh}
          unit="t/h"
          precision={1}
          accent="accent"
          hint={
            moliendaTotalKg ? `${formatNumber(moliendaTotalKg / 1000, 0)} t total` : undefined
          }
        />
        <PremiumTile
          icon={<IconFlame size={14} />}
          label="Gas promedio turno previo"
          value={gasM3h}
          unit="m³/h"
          precision={1}
          accent="warn"
          hint={gasTotal ? `${formatNumber(gasTotal, 0)} m³ total` : undefined}
        />
        <PremiumTile
          icon={<IconPlayerPause size={14} />}
          label="Paradas previas"
          value={paradasCant}
          unit="evt"
          precision={0}
          accent="danger"
          hint={paradasMin ? `${formatNumber(paradasMin, 0)} min` : undefined}
        />
        <PremiumTile
          icon={<IconRotateClockwise size={14} />}
          label="Vel. molino"
          value={velPromedio}
          unit="rpm"
          precision={1}
          accent="accent"
        />
      </div>

      <div className="mt-3">
        <MillSpeedChart data={vel.data as MillSpeedPayload | null | undefined} />
      </div>

      <div className="mt-3">
        <AnalisisIA />
      </div>
    </PremiumPanel>
  );
}
