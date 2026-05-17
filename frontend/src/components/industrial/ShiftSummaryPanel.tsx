'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconClock, IconRefresh } from '@tabler/icons-react';
import { PanelHeader } from './PanelHeader';
import { MillSpeedChart, type MillSpeedPayload } from './MillSpeedChart';
import { AnalisisIA } from './AnalisisIA';
import { formatNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

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

  return (
    <section className="flex flex-col rounded-xl border border-border bg-bg-surface/60 p-4 overflow-hidden backdrop-blur-sm">
      <PanelHeader
        title="Resumen Guardia"
        subtitle="Turno anterior · datos consolidados"
        icon={<IconClock size={15} />}
        badge={
          <button
            onClick={refreshAll}
            className="inline-flex items-center gap-1.5 text-2xs text-text-muted hover:text-primary-light transition-colors px-2 py-1 rounded-md hover:bg-bg-hover border border-transparent hover:border-border-strong"
            title="Refrescar KPIs"
          >
            <IconRefresh size={12} />
            Refrescar
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <KpiCell
          label="Molienda actual"
          value={(molienda.data as { promedio_t_h?: number } | undefined)?.promedio_t_h}
          unit="t/h"
          loading={molienda.isLoading}
        />
        <KpiCell
          label="Molienda turno previo"
          value={(() => {
            const kg = (moliendaPrev.data as { molienda_promedio_kg_h?: number } | undefined)
              ?.molienda_promedio_kg_h;
            return typeof kg === 'number' ? kg / 1000 : undefined;
          })()}
          unit="t/h"
          precision={1}
          loading={moliendaPrev.isLoading}
          context={
            (moliendaPrev.data as { molienda_total_kg?: number } | undefined)?.molienda_total_kg
              ? `${formatNumber(
                  (moliendaPrev.data as { molienda_total_kg: number }).molienda_total_kg / 1000,
                  0,
                )} t total`
              : undefined
          }
        />
        <KpiCell
          label="Gas promedio turno previo"
          value={(gas.data as { 'consumo_promedio_m3/h'?: number } | undefined)?.['consumo_promedio_m3/h']}
          unit="m³/h"
          loading={gas.isLoading}
          context={
            (gas.data as { consumo_total_m3?: number } | undefined)?.consumo_total_m3
              ? `${formatNumber((gas.data as { consumo_total_m3: number }).consumo_total_m3, 0)} m³ total`
              : undefined
          }
        />
        <KpiCell
          label="Paradas previas"
          value={(paradas.data as { cantidad_paradas?: number } | undefined)?.cantidad_paradas}
          unit="evt"
          precision={0}
          loading={paradas.isLoading}
          context={
            (paradas.data as { tiempo_neto_total_min?: number } | undefined)?.tiempo_neto_total_min
              ? `${formatNumber((paradas.data as { tiempo_neto_total_min: number }).tiempo_neto_total_min, 0)} min`
              : undefined
          }
        />
        <KpiCell
          label="Vel. molino"
          value={(vel.data as { promedio?: number } | undefined)?.promedio}
          unit="rpm"
          precision={1}
          loading={vel.isLoading}
        />
      </div>

      <div className="mt-3">
        <MillSpeedChart data={vel.data as MillSpeedPayload | null | undefined} />
      </div>

      <div className="mt-3">
        <AnalisisIA />
      </div>
    </section>
  );
}

function KpiCell({
  label,
  value,
  unit,
  precision = 0,
  loading,
  context,
}: {
  label: string;
  value: number | undefined;
  unit?: string;
  precision?: number;
  loading?: boolean;
  context?: string;
}) {
  return (
    <div className={cn(
      'relative rounded-lg border border-border bg-bg-card p-3 overflow-hidden',
      'bg-gradient-to-br from-bg-card to-bg-surface',
    )}>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary-light/60 via-accent/30 to-transparent" />
      <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted font-medium">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1 mono">
        <span className="text-lg font-semibold text-text-primary tabular-nums leading-none">
          {loading ? '...' : value != null ? formatNumber(value, precision) : '—'}
        </span>
        {unit && <span className="text-2xs text-text-muted">{unit}</span>}
      </div>
      {context && <div className="text-[10px] text-text-muted mt-1 mono">{context}</div>}
    </div>
  );
}
