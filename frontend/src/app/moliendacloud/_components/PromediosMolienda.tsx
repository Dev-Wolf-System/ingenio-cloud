'use client';

import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import { useMoliendaBloques } from '../_hooks/useMoliendaCloud';
import type { MoliendaBloque } from '../_types';

function avgTonHora(rows: MoliendaBloque[]): string {
  if (rows.length === 0) return '—';
  const sum = rows.reduce((acc, r) => acc + Number(r.molienda_kg ?? 0), 0);
  return (sum / rows.length / 1000).toFixed(1);
}

interface BigGlassCardProps {
  label: string;
  value: string;
  accent: string;
}

function BigGlassCard({ label, value, accent }: BigGlassCardProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-xl p-4"
      style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      <span
        className="text-2xl lg:text-3xl font-bold tabular-nums tracking-tight"
        style={{ color: accent, fontFamily: 'var(--font-mono, monospace)' }}
      >
        {value}
      </span>
      <span
        className="text-[11px] uppercase tracking-widest text-center leading-tight"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </span>
    </div>
  );
}

export function PromediosMolienda() {
  const { data: res, isLoading } = useMoliendaBloques();

  const rows: MoliendaBloque[] = res?.data ?? [];
  const turnoRows = rows.filter((r) => r.bloque === 'turno_actual');
  const diaRows = rows.filter((r) => r.bloque === 'dia_corriente');

  const turnoAvg = avgTonHora(turnoRows);
  const diaAvg = avgTonHora(diaRows);

  return (
    <PremiumPanel title="PROMEDIOS DE MOLIENDA" accent="neutral">
      {isLoading ? (
        <div
          className="flex items-center justify-center py-10 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Cargando…
        </div>
      ) : rows.length === 0 ? (
        <div
          className="flex items-center justify-center py-10 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Sin datos disponibles
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 py-2">
          <BigGlassCard
            value={turnoAvg === '—' ? '—' : `${turnoAvg}`}
            label={'t/h promedio · turno en curso'}
            accent="#00D4FF"
          />
          <BigGlassCard
            value={diaAvg === '—' ? '—' : `${diaAvg}`}
            label={'t/h promedio · día'}
            accent="#00E5A0"
          />
        </div>
      )}
    </PremiumPanel>
  );
}
