'use client';

import { useQuery } from '@tanstack/react-query';
import { IconClock } from '@tabler/icons-react';
import { PanelHeader } from './PanelHeader';
import { formatNumber } from '@/lib/utils/format';

async function fetchGuardia(path: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/guardia/${path}`);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

export function ShiftSummaryPanel() {
  const molienda = useQuery({
    queryKey: ['guardia', 'molienda'],
    queryFn: () => fetchGuardia('molienda'),
    staleTime: 5 * 60_000,
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
    <section className="flex flex-col rounded-lg border border-border bg-bg-surface p-4 overflow-hidden">
      <PanelHeader title="Resumen Guardia" icon={<IconClock size={18} />} />

      <div className="grid grid-cols-2 gap-2">
        <KpiCell
          label="Molienda promedio"
          value={(molienda.data as { promedio_t_h?: number } | undefined)?.promedio_t_h}
          unit="t/h"
          loading={molienda.isLoading}
          error={(molienda.data as { error?: string } | undefined)?.error}
        />
        <KpiCell
          label="Gas turno previo"
          value={(gas.data as { promedio_m3_h?: number } | undefined)?.promedio_m3_h}
          unit="m³/h"
          loading={gas.isLoading}
          error={(gas.data as { error?: string } | undefined)?.error}
          context={
            (gas.data as { total_m3?: number } | undefined)?.total_m3
              ? `${formatNumber((gas.data as { total_m3: number }).total_m3, 0)} m³ total`
              : undefined
          }
        />
        <KpiCell
          label="Paradas previas"
          value={(paradas.data as { total?: number } | undefined)?.total}
          unit="paradas"
          precision={0}
          loading={paradas.isLoading}
          error={(paradas.data as { error?: string } | undefined)?.error}
          context={
            (paradas.data as { tiempo_neto_horas?: number } | undefined)?.tiempo_neto_horas
              ? `${formatNumber((paradas.data as { tiempo_neto_horas: number }).tiempo_neto_horas, 1)} h netas`
              : undefined
          }
        />
        <KpiCell
          label="Vel. primer molino"
          value={(vel.data as { promedio_rpm?: number } | undefined)?.promedio_rpm}
          unit="rpm"
          precision={1}
          loading={vel.isLoading}
          error={(vel.data as { error?: string } | undefined)?.error}
        />
      </div>

      <div className="mt-4 flex-1 overflow-auto">
        <div className="text-2xs uppercase tracking-wide text-text-muted mb-2">Alertas activas</div>
        <p className="text-xs text-text-muted">
          (Aún sin alertas activas — sistema Vigía Mesh disponible Sprint 1)
        </p>
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
  error,
  context,
}: {
  label: string;
  value: number | undefined;
  unit?: string;
  precision?: number;
  loading?: boolean;
  error?: string;
  context?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-bg-card p-3">
      <div className="text-2xs uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1 mono text-xl font-medium text-text-primary">
        {loading ? '...' : error ? '—' : value != null ? formatNumber(value, precision) : '—'}
        {unit && value != null && <span className="ml-1 text-xs text-text-muted">{unit}</span>}
      </div>
      {context && <div className="text-2xs text-text-muted mt-1">{context}</div>}
      {error && <div className="text-2xs text-warn mt-1 truncate" title={error}>{error}</div>}
    </div>
  );
}
