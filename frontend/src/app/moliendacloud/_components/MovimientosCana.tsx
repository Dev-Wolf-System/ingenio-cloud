'use client';

import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import { useMovimientosCana, type MovCanaRow } from '../_hooks/useMoliendaCloud';

// ── formatters ────────────────────────────────────────────────────────────────

function fmtTon(kg: number | null): string {
  if (kg === null) return '—';
  return (kg / 1000).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(v: number | null): string {
  if (v === null) return '—';
  return v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncate(s: string | null, max = 18): string {
  if (!s) return '—';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ── column definitions ────────────────────────────────────────────────────────

interface ColDef {
  header: string;
  align: 'left' | 'right';
  cell: (row: MovCanaRow) => string;
  mono: boolean;
}

const COLS: ColDef[] = [
  { header: 'NRO PESADA',  align: 'right', cell: (r) => r.numero_pesada?.toString() ?? '—',  mono: true  },
  { header: 'GRUPO',       align: 'left',  cell: (r) => r.grupo ?? '—',                       mono: false },
  { header: 'CAÑERO',      align: 'left',  cell: (r) => truncate(r.razon_social, 22),         mono: false },
  { header: 'NRO MUESTRA', align: 'right', cell: (r) => r.numero_analisis?.toString() ?? '—', mono: true  },
  { header: 'CAÑA BRUTA t', align: 'right', cell: (r) => fmtTon(r.peso_neto),                mono: true  },
  { header: 'TRASH %',     align: 'right', cell: (r) => fmtPct(r.trash),                      mono: true  },
  { header: 'BRIX %',      align: 'right', cell: (r) => fmtNum(r.brix),                       mono: true  },
  { header: 'POL %',       align: 'right', cell: (r) => fmtNum(r.pol),                        mono: true  },
  { header: 'PUREZA',      align: 'right', cell: (r) => fmtNum(r.pureza),                     mono: true  },
  { header: 'RENDIMIENTO', align: 'right', cell: (r) => fmtNum(r.rendimiento),                mono: true  },
  { header: 'T CAÑA',      align: 'right', cell: (r) => fmtTon(r.neto_cana),                  mono: true  },
];

// ── component ─────────────────────────────────────────────────────────────────

export function MovimientosCana() {
  const { data, isLoading } = useMovimientosCana();
  const rows = data?.data ?? [];

  return (
    <PremiumPanel
      title="MOVIMIENTOS DE CAÑA"
      subtitle="Últimas pasadas por balanza"
      accent="accent"
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
            Sin movimientos registrados
          </span>
        </div>
      ) : (
        <div
          className="overflow-auto rounded-lg max-h-[300px] lg:max-h-[340px]"
        >
          <table className="w-full text-xs lg:text-sm xl:text-base border-collapse" style={{ minWidth: '640px' }}>
            <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-card)' }}>
              <tr>
                {COLS.map((col) => (
                  <th
                    key={col.header}
                    className={`py-2 lg:py-3 px-2 lg:px-4 text-[10px] lg:text-xs font-semibold tracking-[0.12em] uppercase whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    style={{
                      color: 'var(--text-muted)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isOdd = i % 2 === 1;
                return (
                  <tr
                    key={i}
                    style={{
                      background: isOdd ? 'var(--bg-hover)' : 'transparent',
                      borderBottom: i < rows.length - 1 ? '1px solid color-mix(in srgb, var(--border) 50%, transparent)' : 'none',
                    }}
                  >
                    {COLS.map((col) => (
                      <td
                        key={col.header}
                        className={`py-1.5 lg:py-2.5 px-2 lg:px-4 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.mono ? 'tabular-nums' : ''} font-medium`}
                        style={{ color: 'var(--text-primary)' }}
                        title={col.header === 'CAÑERO' ? (row.razon_social ?? '') : undefined}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PremiumPanel>
  );
}
