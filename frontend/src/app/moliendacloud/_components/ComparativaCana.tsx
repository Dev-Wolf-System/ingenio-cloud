'use client';

import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import { useMoliendaBloques } from '../_hooks/useMoliendaCloud';
import type { MoliendaBloque } from '../_types';

// ── helpers ──────────────────────────────────────────────────────────────────

function maxAcumulado(rows: MoliendaBloque[], bloque: string): number | null {
  const matches = rows.filter((r) => r.bloque === bloque);
  if (matches.length === 0) return null;
  return matches.reduce((m, r) => Math.max(m, r.acumulado_kg), 0);
}

function fmtTon(kg: number | null): string {
  if (kg === null) return '—';
  return (kg / 1000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// ── types ─────────────────────────────────────────────────────────────────────

interface RowDef {
  label: string;
  dayActual: string;
  dayAnterior: string;
  zafra: string;
  pending: boolean;
}

// ── component ─────────────────────────────────────────────────────────────────

export function ComparativaCana() {
  const { data, isLoading } = useMoliendaBloques();

  const rows = data?.data ?? [];

  const molDia    = fmtTon(maxAcumulado(rows, 'dia_corriente'));
  const molAnt    = fmtTon(maxAcumulado(rows, 'dia_anterior'));
  const molZafra  = fmtTon(maxAcumulado(rows, 'zafra'));

  const tableRows: RowDef[] = [
    { label: 'MOLIENDA (t)',          dayActual: molDia,   dayAnterior: molAnt,   zafra: molZafra, pending: false },
    { label: 'TRASH PONDERADO (%)',   dayActual: '—',      dayAnterior: '—',      zafra: '—',      pending: true  },
    { label: 'TRASH (kg)',            dayActual: '—',      dayAnterior: '—',      zafra: '—',      pending: true  },
    { label: 'CAÑA NETA (t)',         dayActual: '—',      dayAnterior: '—',      zafra: '—',      pending: true  },
    { label: 'RTO. PONDERADO',        dayActual: '—',      dayAnterior: '—',      zafra: '—',      pending: true  },
    { label: 'BRIX PONDERADO',        dayActual: '—',      dayAnterior: '—',      zafra: '—',      pending: true  },
    { label: 'POL PONDERADO',         dayActual: '—',      dayAnterior: '—',      zafra: '—',      pending: true  },
    { label: 'PUREZA PONDERADA',      dayActual: '—',      dayAnterior: '—',      zafra: '—',      pending: true  },
  ];

  return (
    <PremiumPanel
      title="COMPARATIVO DE CAÑA"
      subtitle="Día actual · Día anterior · Zafra"
      accent="primary"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <span className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>
            Cargando…
          </span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Sin datos disponibles
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th
                  className="py-2 px-3 text-left text-[11px] font-semibold tracking-[0.12em] uppercase w-44"
                  style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
                >
                  Métrica
                </th>
                {(['DÍA ACTUAL', 'DÍA ANTERIOR', 'ZAFRA'] as const).map((col) => (
                  <th
                    key={col}
                    className="py-2 px-3 text-right text-[11px] font-semibold tracking-[0.12em] uppercase"
                    style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr
                  key={row.label}
                  style={{
                    borderBottom: i < tableRows.length - 1 ? '1px solid var(--border)' : 'none',
                    opacity: row.pending ? 0.45 : 1,
                  }}
                >
                  <td
                    className="py-2 px-3 text-[11px] font-semibold tracking-[0.10em]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {row.label}
                  </td>
                  {([row.dayActual, row.dayAnterior, row.zafra] as const).map((val, j) => (
                    <td
                      key={j}
                      className="py-2 px-3 text-right tabular-nums font-medium"
                      style={{ color: row.pending ? 'var(--text-muted)' : 'var(--text-primary)' }}
                    >
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <p
            className="mt-1 text-[10px] italic px-1"
            style={{ color: 'var(--text-muted)' }}
          >
            * Métricas ponderadas (Trash, Caña Neta, Rto., Brix, Pol, Pureza): fuente a confirmar — dato pendiente.
          </p>
        </div>
      )}
    </PremiumPanel>
  );
}
