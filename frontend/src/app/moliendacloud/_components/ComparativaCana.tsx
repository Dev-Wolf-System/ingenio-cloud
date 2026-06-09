'use client';

import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import { useComparativaCana, type CanaAgg } from '../_hooks/useMoliendaCloud';

// ── formatters ────────────────────────────────────────────────────────────────

function fmtTon(kg: number | null, decimals = 1): string {
  if (kg === null) return '—';
  return (kg / 1000).toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtNum(v: number | null, decimals = 2): string {
  if (v === null) return '—';
  return v.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ── trend chip ────────────────────────────────────────────────────────────────

type TrendDir = 'up' | 'down' | 'neutral';
type TrendSense = 'higher-better' | 'lower-better' | 'neutral';

function trendDir(actual: number | null, ref: number | null): TrendDir {
  if (actual === null || ref === null || ref === 0) return 'neutral';
  const diff = actual - ref;
  if (Math.abs(diff / ref) < 0.001) return 'neutral';
  return diff > 0 ? 'up' : 'down';
}

function TrendChip({ dir, sense, pct }: { dir: TrendDir; sense: TrendSense; pct: number | null }) {
  if (dir === 'neutral' || sense === 'neutral') {
    // neutral sense: show % in muted grey if available
    if (pct === null) return null;
    const sign = pct >= 0 ? '+' : '−';
    return (
      <span
        className="ml-1 text-[10px] font-medium tabular-nums"
        style={{ color: 'var(--text-muted)' }}
        aria-hidden
      >
        ({sign}{Math.abs(pct).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
      </span>
    );
  }
  const isGood =
    (sense === 'higher-better' && dir === 'up') ||
    (sense === 'lower-better' && dir === 'down');
  const color = isGood ? 'var(--ok)' : 'var(--danger)';
  const arrow = dir === 'up' ? '↑' : '↓';
  const pctStr = pct !== null
    ? (() => {
        const sign = pct >= 0 ? '+' : '−';
        return ` (${sign}${Math.abs(pct).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)`;
      })()
    : '';
  return (
    <span
      className="ml-1 text-[10px] font-bold tabular-nums"
      style={{ color }}
      aria-hidden
    >
      {arrow}{pctStr}
    </span>
  );
}

function calcPct(actual: number | null, cierre: number | null): number | null {
  if (actual === null || cierre === null || cierre === 0) return null;
  return (actual - cierre) / cierre * 100;
}

// ── row definitions ───────────────────────────────────────────────────────────

interface RowDef {
  label: string;
  get: (a: CanaAgg) => string;
  getNum: (a: CanaAgg) => number | null;
  sense: TrendSense;
}

const ROWS: RowDef[] = [
  {
    label: 'MOLIENDA (t)',
    get: (a) => fmtTon(a.molienda_kg),
    getNum: (a) => a.molienda_kg,
    sense: 'higher-better',
  },
  {
    label: 'TRASH POND. (%)',
    get: (a) => fmtNum(a.trash_pond),
    getNum: (a) => a.trash_pond,
    sense: 'lower-better',
  },
  {
    label: 'TRASH (kg)',
    get: (a) => fmtTon(a.trash_kg),
    getNum: (a) => a.trash_kg,
    sense: 'lower-better',
  },
  {
    label: 'CAÑA NETA (t)',
    get: (a) => fmtTon(a.cana_neta_kg),
    getNum: (a) => a.cana_neta_kg,
    sense: 'neutral',
  },
  {
    label: 'RTO. PONDERADO',
    get: (a) => fmtNum(a.rto_pond),
    getNum: (a) => a.rto_pond,
    sense: 'higher-better',
  },
  {
    label: 'BRIX POND.',
    get: (a) => fmtNum(a.brix_pond),
    getNum: (a) => a.brix_pond,
    sense: 'neutral',
  },
  {
    label: 'POL POND.',
    get: (a) => fmtNum(a.pol_pond),
    getNum: (a) => a.pol_pond,
    sense: 'neutral',
  },
  {
    label: 'PUREZA POND.',
    get: (a) => fmtNum(a.pureza_pond),
    getNum: (a) => a.pureza_pond,
    sense: 'higher-better',
  },
];

// ── component ─────────────────────────────────────────────────────────────────

export function ComparativaCana() {
  const { data, isLoading } = useComparativaCana();

  return (
    <PremiumPanel
      title="COMPARATIVO DE CAÑA"
      subtitle="Actual · Últ. Cierre · Acumulado"
      accent="primary"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <span className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>
            Cargando…
          </span>
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-10">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Sin datos disponibles
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[380px]">
            <thead>
              <tr>
                <th
                  className="py-2 lg:py-2.5 px-2 lg:px-3 text-left text-[10px] lg:text-xs font-semibold tracking-[0.12em] uppercase w-36 lg:w-44"
                  style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
                >
                  Métrica
                </th>
                {(['ACTUAL', 'ÚLT. CIERRE', 'ACUMULADO'] as const).map((col, ci) => (
                  <th
                    key={col}
                    className="py-2 lg:py-2.5 px-2 lg:px-3 text-right text-[10px] lg:text-xs font-semibold tracking-[0.12em] uppercase"
                    style={{
                      color: ci === 0 ? 'var(--primary-light)' : 'var(--text-muted)',
                      borderBottom: `1px solid ${ci === 0 ? 'var(--primary-light)' : 'var(--border)'}`,
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => {
                const actualVal = data.actual ? row.get(data.actual) : '—';
                const cierreVal = data.ult_cierre ? row.get(data.ult_cierre) : '—';
                const acumVal   = data.acumulado ? row.get(data.acumulado) : '—';
                const actualNum = data.actual ? row.getNum(data.actual) : null;
                const cierreNum = data.ult_cierre ? row.getNum(data.ult_cierre) : null;
                const dir = data.actual && data.ult_cierre
                  ? trendDir(actualNum, cierreNum)
                  : 'neutral';
                const pct = calcPct(actualNum, cierreNum);
                return (
                  <tr
                    key={row.label}
                    style={{
                      borderBottom: i < ROWS.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <td
                      className="py-2 lg:py-2.5 px-2 lg:px-3 text-[10px] lg:text-xs font-semibold tracking-[0.10em]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {row.label}
                    </td>
                    {/* ACTUAL — accent column */}
                    <td
                      className="py-2 lg:py-2.5 px-2 lg:px-3 text-right tabular-nums font-semibold text-sm lg:text-base xl:text-lg"
                      style={{
                        color: 'var(--text-primary)',
                        borderLeft: '1px solid color-mix(in srgb, var(--primary-light) 30%, transparent)',
                      }}
                    >
                      {actualVal}
                      <TrendChip dir={dir} sense={row.sense} pct={pct} />
                    </td>
                    {/* ÚLT. CIERRE */}
                    <td
                      className="py-2 lg:py-2.5 px-2 lg:px-3 text-right tabular-nums font-medium text-sm lg:text-base"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {cierreVal}
                    </td>
                    {/* ACUMULADO */}
                    <td
                      className="py-2 lg:py-2.5 px-2 lg:px-3 text-right tabular-nums font-medium text-sm lg:text-base"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {acumVal}
                    </td>
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
