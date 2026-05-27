'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  IconClock,
  IconRefresh,
  IconScale,
  IconFlame,
  IconPlayerPause,
} from '@tabler/icons-react';
import { PremiumPanel } from './PremiumPanel';
import { PremiumTile } from './PremiumTile';
import { MoliendaHoraChart, type MoliendaHoraPayload } from './MoliendaHoraChart';
import { ParadasDetalleModal, type ParadaDetalle } from './ParadasDetalleModal';
import { AnalisisIA } from './AnalisisIA';
import { formatNumber, formatHoraAR } from '@/lib/utils/format';

const apiUrl = (path: string) => `${process.env.NEXT_PUBLIC_API_URL!}/guardia/${path}`;

interface TurnoPrevio {
  turno?: string | null;
  turno_inicio?: string | null;
  turno_fin?: string | null;
  molienda_avg_t_h?: number | null;
  gas_total_m3?: number | null;
  gas_avg_m3_h?: number | null;
  paradas_count?: number | null;
  paradas_minutos?: number | null;
  paradas_detalle?: ParadaDetalle[];
  stale?: boolean;
  error?: string;
}

async function fetchTurnoPrevio(): Promise<TurnoPrevio> {
  const res = await fetch(apiUrl('turno-previo'));
  if (!res.ok) return { stale: true };
  return res.json();
}

async function fetchMollienda(): Promise<{
  promedio_t_h?: number | null;
  total_kg?: number | null;
  turno?: string;
} | null> {
  const res = await fetch(apiUrl('molienda'));
  if (!res.ok) return null;
  return res.json();
}

async function fetchMoliendaHora(): Promise<MoliendaHoraPayload> {
  const res = await fetch(apiUrl('molienda-hora'));
  if (!res.ok) return { stale: true };
  return res.json();
}

export function ShiftSummaryPanel() {
  const qc = useQueryClient();
  const [paradasOpen, setParadasOpen] = useState(false);
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['guardia'] });
  };

  const turnoQ = useQuery({
    queryKey: ['guardia', 'turno-previo'],
    queryFn: fetchTurnoPrevio,
    refetchInterval: 15 * 60_000, // 15 min
    staleTime: 60_000,
  });

  const moliendaActualQ = useQuery({
    queryKey: ['guardia', 'molienda'],
    queryFn: fetchMollienda,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  const moliendaHoraQ = useQuery({
    queryKey: ['guardia', 'molienda-hora'],
    queryFn: fetchMoliendaHora,
    refetchInterval: 15 * 60_000, // 15 min
    staleTime: 60_000,
  });

  const tp = turnoQ.data;
  const paradasDetalle = tp?.paradas_detalle ?? [];
  const tieneParadas = (tp?.paradas_count ?? 0) > 0 || paradasDetalle.length > 0;
  const mol = moliendaActualQ.data as { promedio_t_h?: number | null; total_kg?: number | null } | null;
  const moliendaActual = mol?.promedio_t_h ?? null;
  const moliendaTotal = mol?.total_kg ?? null;

  const horaInicio = formatHoraAR(tp?.turno_inicio);
  const horaFin = formatHoraAR(tp?.turno_fin);
  const subtitle = tp?.turno
    ? `Turno ${tp.turno} · ${horaInicio} → ${horaFin} · KPIs consolidados`
    : 'Turno anterior · aguardando datos del cierre de guardia';

  return (
    <PremiumPanel
      title="RESUMEN GUARDIA"
      subtitle={subtitle}
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
          label="Promedio Molienda Actual"
          value={moliendaActual ?? undefined}
          unit="t/h"
          precision={1}
          accent="primary"
          size="lg"
          hint={
            moliendaActual != null && moliendaTotal != null
              ? `${formatNumber(moliendaTotal / 1000, 1)} t total`
              : 'Esperando primera lectura del turno'
          }
        />
        <PremiumTile
          icon={<IconScale size={14} />}
          label="Promedio Molienda Turno Previo"
          value={tp?.molienda_avg_t_h ?? undefined}
          unit="t/h"
          precision={2}
          accent="accent"
        />
        <PremiumTile
          icon={<IconFlame size={14} />}
          label="Gas promedio turno previo"
          value={tp?.gas_avg_m3_h ?? undefined}
          unit="m³/h"
          precision={1}
          accent="warn"
          hint={
            tp?.gas_total_m3 != null
              ? `${formatNumber(tp.gas_total_m3, 0)} m³ total`
              : undefined
          }
        />
        <PremiumTile
          icon={<IconPlayerPause size={14} />}
          label="Paradas previas"
          value={tp?.paradas_count ?? undefined}
          unit="evt"
          precision={0}
          accent="danger"
          onClick={tieneParadas ? () => setParadasOpen(true) : undefined}
          hint={
            tieneParadas
              ? tp?.paradas_minutos != null && tp.paradas_minutos > 0
                ? `${formatNumber(tp.paradas_minutos, 0)} min · ver detalle`
                : 'ver detalle'
              : undefined
          }
        />
      </div>

      <ParadasDetalleModal
        open={paradasOpen}
        onClose={() => setParadasOpen(false)}
        turno={tp?.turno}
        rango={
          tp?.turno_inicio
            ? `${formatHoraAR(tp.turno_inicio)} → ${formatHoraAR(tp.turno_fin)}`
            : undefined
        }
        paradas={paradasDetalle}
        totalMinutos={tp?.paradas_minutos}
      />

      <div className="mt-3">
        <MoliendaHoraChart data={moliendaHoraQ.data} />
      </div>

      <div className="mt-3">
        <AnalisisIA />
      </div>
    </PremiumPanel>
  );
}
