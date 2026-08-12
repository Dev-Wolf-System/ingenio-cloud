'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { IconBuildingFactory2, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { TopBar } from '@/components/layout/TopBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { useLab } from '../../moliendacloud/_hooks/useMoliendaCloud';
import type { LabRow } from '../../moliendacloud/_types';

// ─── Config ───────────────────────────────────────────────────────────────────

const PROCESOS_FABRICA = [
  'Jugo Mixto',
  '1Era Presión',
  'Clarificado',
  'Melado',
  'Última Presión',
  'Jarabe Clarificado',
];

// pH present only in these processes
const PROCS_CON_PH = ['Jugo Mixto', '1Era Presión', 'Clarificado', 'Melado'];

const PROC_ORDER: Record<string, number> = {
  'Jugo Mixto': 0,
  '1Era Presión': 1,
  'Clarificado': 2,
  'Melado': 3,
  'Última Presión': 4,
  'Jarabe Clarificado': 5,
};

const PROC_COLORS: Record<string, string> = {
  'Jugo Mixto': '#00D4FF',
  '1Era Presión': '#FF6B35',
  'Clarificado': '#00E5A0',
  'Melado': '#FFB800',
  'Última Presión': '#7C6AFA',
  'Jarabe Clarificado': '#F43F5E',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function brixVal(r: LabRow): number | null { return r.brix_manual ?? r.brix_automatico; }
function polVal(r: LabRow): number | null  { return r.pol_manual  ?? r.pol_automatico;  }

function avg(vals: (number | null)[]): number | null {
  const filtered = vals.filter((v): v is number => v != null);
  if (!filtered.length) return null;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

function fmtNum(v: number | null, dec = 2): string {
  if (v == null) return '—';
  return v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TipEntry { name?: string; value?: number; color?: string }
interface TipProps { active?: boolean; payload?: TipEntry[]; label?: unknown; unit?: string }

function GlassTip({ active, payload, label, unit = '' }: TipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: 'var(--bg-card, #1A2236)',
        border: '1px solid var(--border, #1E3A5F)',
        borderRadius: 8,
        padding: '8px 12px',
        backdropFilter: 'blur(12px)',
        minWidth: 160,
      }}
    >
      <p style={{ color: 'var(--text-muted, #6B7A9E)', fontSize: 11, marginBottom: 4 }}>
        {String(label ?? '')}
      </p>
      {payload.map((e, i) => (
        <p key={i} style={{ color: e.color ?? '#00D4FF', fontSize: 13, fontWeight: 600, margin: '2px 0' }}>
          {e.name ?? ''}: <span style={{ color: 'var(--text-primary, #F0F4FF)' }}>
            {e.value != null ? e.value.toFixed(2) : '—'} {unit}
          </span>
        </p>
      ))}
    </div>
  );
}

// ─── Build per-process hour series ────────────────────────────────────────────

function buildHourSeries(
  rows: LabRow[],
  procs: string[],
  getter: (r: LabRow) => number | null,
): Array<Record<string, unknown>> {
  const horasSet: Set<string> = new Set();
  const byProcHora: Record<string, Record<string, number[]>> = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!procs.includes(r.proceso_codigo)) continue;
    const v = getter(r);
    if (typeof v !== 'number') continue;
    const hora = r.hora_lectura ? r.hora_lectura.slice(0, 2) + ':00' : '??';
    horasSet.add(hora);
    if (!byProcHora[r.proceso_codigo]) byProcHora[r.proceso_codigo] = {};
    if (!byProcHora[r.proceso_codigo][hora]) byProcHora[r.proceso_codigo][hora] = [];
    byProcHora[r.proceso_codigo][hora].push(v);
  }
  // Orden día industrial: 08:00 → 23:00 → 00:00 → 07:00 (corte 07:00 ART)
  const diaIndHour = (h: string) => { const n = parseInt(h.slice(0, 2), 10); return n < 8 ? n + 24 : n; };
  const horas = Array.from(horasSet).sort((a, b) => diaIndHour(a) - diaIndHour(b));
  return horas.map((h) => {
    const point: Record<string, unknown> = { hora: h };
    for (let i = 0; i < procs.length; i++) {
      const p = procs[i];
      const vals = byProcHora[p]?.[h];
      if (vals && vals.length > 0) {
        point[p] = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
      } else {
        point[p] = null;
      }
    }
    return point;
  });
}

// ─── Chart component ─────────────────────────────────────────────────────────

interface MultiLineChartProps {
  title: string;
  unit: string;
  data: Array<Record<string, unknown>>;
  procs: string[];
  accentColor?: string;
}

function MultiLineChart({ title, unit, data, procs, accentColor = '#00D4FF' }: MultiLineChartProps) {
  if (!data.length) return null;
  return (
    <div
      className="rounded-xl border p-3"
      style={{ background: 'var(--bg-card, #1A2236)', borderColor: 'var(--border, #1E3A5F)' }}
    >
      <p className="text-xs lg:text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: accentColor }}>
        {title} {unit ? `(${unit})` : ''}
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="hora" tick={{ fontSize: 10, fill: 'var(--text-muted, #6B7A9E)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted, #6B7A9E)' }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            content={(props) => (
              <GlassTip
                active={props.active}
                payload={props.payload as unknown as TipEntry[] | undefined}
                label={props.label}
                unit={unit}
              />
            )}
          />
          {procs.map((p) => (
            <Line
              key={p}
              type="monotone"
              dataKey={p}
              name={p}
              stroke={PROC_COLORS[p] ?? accentColor}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-2">
        {procs.map((p) => (
          <div key={p} className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: PROC_COLORS[p] ?? accentColor }} />
            <span className="text-[10px]" style={{ color: 'var(--text-muted, #6B7A9E)' }}>{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionHeader({ title, color = 'var(--accent, #FF6B35)' }: { title: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
        {title}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--border, #1E3A5F)' }} />
    </div>
  );
}

// ─── KPI row per process ──────────────────────────────────────────────────────

interface ProcStats {
  proceso: string;
  avgBrix: number | null;
  avgPol: number | null;
  avgPureza: number | null;
  avgPh: number | null;
  avgTemp: number | null;
  count: number;
}

function buildStats(rows: LabRow[]): ProcStats[] {
  const map: Record<string, LabRow[]> = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!map[r.proceso_codigo]) map[r.proceso_codigo] = [];
    map[r.proceso_codigo].push(r);
  }
  const entries = Object.entries(map);
  return entries.map(([proceso, rs]) => ({
    proceso,
    avgBrix:  avg(rs.map(brixVal)),
    avgPol:   avg(rs.map(polVal)),
    avgPureza: avg(rs.map((r) => r.pureza)),
    avgPh:    avg(rs.map((r) => r.ph_manual)),
    avgTemp:  avg(rs.map((r) => r.temperatura_manual)),
    count: rs.length,
  }));
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function LaboratorioResumenFabricaPage() {
  const [periodo, setPeriodo] = useState<'dia' | 'zafra'>('dia');
  const [offset, setOffset] = useState(0);

  const { data: res, isLoading } = useLab(PROCESOS_FABRICA, periodo, offset);
  const rows: LabRow[] = res?.data ?? [];

  const etiqueta =
    periodo === 'zafra' ? 'Zafra'
    : offset === 0 ? 'Día actual'
    : offset === 1 ? 'Día anterior'
    : `Día −${offset}`;

  const stats = buildStats(rows)
    .filter((s) => PROCESOS_FABRICA.includes(s.proceso))
    .sort((a, b) => (PROC_ORDER[a.proceso] ?? 99) - (PROC_ORDER[b.proceso] ?? 99));

  const activeProcs = PROCESOS_FABRICA.filter((p) => rows.some((r) => r.proceso_codigo === p));
  const procsConPh = activeProcs.filter((p) => PROCS_CON_PH.includes(p));

  const brixSeries  = buildHourSeries(rows, activeProcs, brixVal);
  const polSeries   = buildHourSeries(rows, activeProcs, polVal);
  const purezaSeries = buildHourSeries(rows, activeProcs, (r) => r.pureza);
  const phSeries    = buildHourSeries(rows, procsConPh, (r) => r.ph_manual);

  return (
    <div className="relative min-h-screen flex flex-col">
      <Sidebar />
      <TopBar plant="Laboratorio · Resumen de Fábrica" showAlertas={false} showResumenTurno={false} />

      <div className="p-5 sm:p-6 pb-3 shrink-0 flex items-center gap-3.5">
        <div
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border"
          style={{ background: 'rgba(255,107,53,0.10)', borderColor: 'var(--accent, #FF6B35)', color: 'var(--accent, #FF6B35)' }}
        >
          <IconBuildingFactory2 size={22} />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight" style={{ color: 'var(--text-primary, #F0F4FF)', fontFamily: 'var(--font-display)' }}>
            Resumen de Fábrica
          </h2>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary, #A0B0C8)' }}>
            Promedios de laboratorio por jugo · evolución horaria · día industrial
          </p>
        </div>
      </div>

      <div className="px-5 sm:px-6 pb-6 flex-1 space-y-5">
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
          style={{ background: 'var(--bg-card, #1A2236)', borderColor: 'var(--border, #1E3A5F)' }}
        >
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border, #1E3A5F)' }}>
            {([['dia', 'Día'], ['zafra', 'Zafra']] as const).map(([key, label]) => {
              const active = key === periodo;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setPeriodo(key); setOffset(0); }}
                  className="px-3 py-1.5 text-xs lg:text-sm font-semibold transition-all"
                  style={{ background: active ? 'var(--accent, #FF6B35)' : 'transparent', color: active ? '#0A0E1A' : 'var(--text-muted, #6B7A9E)' }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {periodo === 'dia' && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => setOffset((o) => Math.min(o + 1, 60))}
                disabled={offset >= 60}
                className="p-1 rounded-md transition-colors disabled:opacity-30"
                style={{ color: 'var(--text-muted, #6B7A9E)' }}
                aria-label="Día anterior"
              >
                <IconChevronLeft size={16} />
              </button>
              <span
                className="text-xs lg:text-sm font-medium tabular-nums px-2 py-0.5 rounded min-w-[90px] text-center"
                style={{ color: 'var(--text-primary, #F0F4FF)', background: 'var(--bg-base, #0A0E1A)' }}
              >
                {etiqueta}
              </span>
              <button
                type="button"
                onClick={() => setOffset((o) => Math.max(o - 1, 0))}
                disabled={offset <= 0}
                className="p-1 rounded-md transition-colors disabled:opacity-30"
                style={{ color: 'var(--text-muted, #6B7A9E)' }}
                aria-label="Día siguiente"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          )}
          {periodo === 'zafra' && (
            <span className="text-xs lg:text-sm font-medium ml-auto px-2 py-0.5" style={{ color: 'var(--text-secondary, #A0B0C8)' }}>
              Acumulado de la zafra
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
            Cargando datos de laboratorio…
          </div>
        ) : stats.length === 0 ? (
          <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
            Sin lecturas disponibles para hoy.
          </div>
        ) : (
          <>
            <section>
              <SectionHeader title="Promedios del día por proceso" />
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border, #1E3A5F)' }}>
                <table className="w-full text-sm lg:text-base min-w-[560px]">
                  <thead>
                    <tr style={{ background: 'var(--bg-card, #1A2236)', borderBottom: '1px solid var(--border, #1E3A5F)' }}>
                      {['Proceso', 'Brix °', 'Pol °', 'Pureza %', 'pH', 'Temp °C', 'N'].map((h) => (
                        <th
                          key={h}
                          className="px-3 lg:px-4 py-2.5 lg:py-3 text-left text-xs lg:text-sm font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--text-muted, #6B7A9E)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s, i) => {
                      const hasPh = PROCS_CON_PH.includes(s.proceso);
                      return (
                        <tr
                          key={s.proceso}
                          style={{ borderBottom: '1px solid var(--border, #1E3A5F)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
                        >
                          <td className="px-3 lg:px-4 py-2.5 lg:py-3 font-semibold" style={{ color: PROC_COLORS[s.proceso] ?? 'var(--text-primary, #F0F4FF)' }}>
                            {s.proceso}
                          </td>
                          <td className="px-3 lg:px-4 py-2.5 lg:py-3 tabular-nums font-mono" style={{ color: 'var(--text-secondary, #A0B0C8)' }}>
                            {fmtNum(s.avgBrix)}
                          </td>
                          <td className="px-3 lg:px-4 py-2.5 lg:py-3 tabular-nums font-mono" style={{ color: 'var(--text-secondary, #A0B0C8)' }}>
                            {fmtNum(s.avgPol)}
                          </td>
                          <td className="px-3 lg:px-4 py-2.5 lg:py-3 tabular-nums font-mono" style={{ color: 'var(--text-secondary, #A0B0C8)' }}>
                            {fmtNum(s.avgPureza, 1)}
                          </td>
                          <td className="px-3 lg:px-4 py-2.5 lg:py-3 tabular-nums font-mono" style={{ color: hasPh ? '#00E5A0' : 'var(--text-muted, #6B7A9E)' }}>
                            {hasPh ? fmtNum(s.avgPh) : '—'}
                          </td>
                          <td className="px-3 lg:px-4 py-2.5 lg:py-3 tabular-nums font-mono" style={{ color: 'var(--text-secondary, #A0B0C8)' }}>
                            {fmtNum(s.avgTemp, 1)}
                          </td>
                          <td className="px-3 lg:px-4 py-2.5 lg:py-3">
                            <span
                              className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold"
                              style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF' }}
                            >
                              {s.count}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <SectionHeader title="Evolución horaria" color="#00D4FF" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {brixSeries.length > 0 && <MultiLineChart title="Brix" unit="°" data={brixSeries} procs={activeProcs} accentColor="#00D4FF" />}
                {polSeries.length > 0 && <MultiLineChart title="Pol" unit="°" data={polSeries} procs={activeProcs} accentColor="#FF6B35" />}
                {purezaSeries.length > 0 && <MultiLineChart title="Pureza" unit="%" data={purezaSeries} procs={activeProcs} accentColor="#00E5A0" />}
                {phSeries.length > 0 && <MultiLineChart title="pH" unit="" data={phSeries} procs={procsConPh} accentColor="#7C6AFA" />}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
