'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { IconFlask, IconChevronLeft, IconChevronRight, IconAlertTriangle } from '@tabler/icons-react';
import { TopBar } from '@/components/layout/TopBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAzucar } from '../../moliendacloud/_hooks/useMoliendaCloud';
import type { EspRow } from '../../moliendacloud/_hooks/useMoliendaCloud';

// ─── Param definitions ────────────────────────────────────────────────────────

interface ParamDef {
  key: keyof EspRow;
  label: string;
  unit: string;
  dec: number;
  color: string;
}

const PARAMS: ParamDef[] = [
  { key: 'color_icumsa',     label: 'Color ICUMSA',    unit: 'UI',  dec: 0, color: '#00D4FF' },
  { key: 'turbidez',         label: 'Turbidez',         unit: '',    dec: 2, color: '#FF6B35' },
  { key: 'humedad',          label: 'Humedad',          unit: '%',   dec: 2, color: '#00E5A0' },
  { key: 'cenizas',          label: 'Cenizas',          unit: '%',   dec: 2, color: '#FFB800' },
  { key: 'sediment_test',    label: 'Sedimento',        unit: '',    dec: 2, color: '#7C6AFA' },
  { key: 'so2_ppm',          label: 'SO₂',              unit: 'ppm', dec: 0, color: '#F43F5E' },
  { key: 'granulometria_20', label: 'Granulometría 20', unit: '',    dec: 2, color: '#0EA5E9' },
  { key: 'granulometria_30', label: 'Granulometría 30', unit: '',    dec: 2, color: '#F59E0B' },
  { key: 'calidad',          label: 'Calidad',          unit: '',    dec: 2, color: '#00D4FF' },
];

const AZUCAR_PROCS = ['Cinta Corta', 'Cinta Larga', 'Envases'];
const PROC_COLORS: Record<string, string> = {
  'Cinta Corta': '#00D4FF',
  'Cinta Larga': '#FF6B35',
  'Envases':     '#00E5A0',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avgField(rows: EspRow[], key: keyof EspRow): number | null {
  const vals: number[] = [];
  for (const r of rows) {
    const v = r[key];
    if (typeof v === 'number') vals.push(v);
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function hasData(rows: EspRow[], key: keyof EspRow): boolean {
  return rows.some((r) => r[key] != null);
}

function fmtVal(v: number | null, dec: number): string {
  if (v == null) return '—';
  return v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function buildMultiProcSeries(rows: EspRow[], procs: string[], key: keyof EspRow): Array<Record<string, unknown>> {
  const horasSet = new Set<string>();
  const byProcHora: Record<string, Record<string, number[]>> = {};
  for (const r of rows) {
    if (!procs.includes(r.proceso_codigo)) continue;
    const v = r[key];
    if (typeof v !== 'number') continue;
    const hora = r.hora_lectura ? r.hora_lectura.slice(0, 2) + ':00' : '??';
    horasSet.add(hora);
    if (!byProcHora[r.proceso_codigo]) byProcHora[r.proceso_codigo] = {};
    if (!byProcHora[r.proceso_codigo][hora]) byProcHora[r.proceso_codigo][hora] = [];
    byProcHora[r.proceso_codigo][hora].push(v);
  }
  const diaIndHour = (h: string) => { const n = parseInt(h.slice(0, 2), 10); return n < 8 ? n + 24 : n; };
  return Array.from(horasSet).sort((a, b) => diaIndHour(a) - diaIndHour(b)).map((h) => {
    const point: Record<string, unknown> = { hora: h };
    for (const p of procs) {
      const vals = byProcHora[p]?.[h];
      point[p] = vals?.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
    }
    return point;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TipEntry { name?: string; value?: number; color?: string }
interface TipProps { active?: boolean; payload?: TipEntry[]; label?: unknown; unit?: string }

function GlassTip({ active, payload, label, unit = '' }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', backdropFilter: 'blur(12px)', minWidth: 140 }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{String(label ?? '')}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ color: e.color ?? '#00D4FF', fontSize: 13, fontWeight: 600, margin: '2px 0' }}>
          {e.name ?? ''}: <span style={{ color: 'var(--text-primary)' }}>{e.value != null ? e.value.toFixed(2) : '—'} {unit}</span>
        </p>
      ))}
    </div>
  );
}

function SectionHeader({ title, color = 'var(--primary-light, #00D4FF)' }: { title: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{title}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{msg}</div>;
}

// ─── KPI card con delta opcional ─────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number | null;
  unit: string;
  dec: number;
  color: string;
  refValue?: number | null;
}

function KpiCard({ label, value, unit, dec, color, refValue }: KpiCardProps) {
  const delta = value != null && refValue != null ? value - refValue : null;
  const pct = delta != null && refValue != null && refValue !== 0 ? (delta / Math.abs(refValue)) * 100 : null;
  const up = delta != null && delta > 0;

  return (
    <div className="flex flex-col gap-1 rounded-xl border p-2 sm:p-3 lg:p-4 lg:min-w-[130px] lg:flex-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <span className="text-[10px] sm:text-[11px] lg:text-xs font-semibold uppercase tracking-wider leading-tight" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-lg sm:text-2xl lg:text-3xl font-bold tabular-nums" style={{ color }}>
        {value != null ? fmtVal(value, dec) : '—'}
      </span>
      {unit && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      {delta != null && (
        <span
          className="text-[11px] font-semibold tabular-nums mt-0.5"
          style={{ color: up ? '#00E5A0' : '#FF4757' }}
        >
          {up ? '▲' : '▼'} {up ? '+' : ''}{fmtVal(delta, dec)}
          {pct != null && ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`}
        </span>
      )}
    </div>
  );
}

// ─── Evolution chart ──────────────────────────────────────────────────────────

function EvoChart({ rows, param, procs }: { rows: EspRow[]; param: ParamDef; procs: string[] }) {
  const series = buildMultiProcSeries(rows, procs, param.key);
  if (!series.length) return null;
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: param.color }}>
        {param.label} {param.unit ? `(${param.unit})` : ''}
      </p>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={series} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="hora" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={36} />
          <Tooltip content={(props) => <GlassTip active={props.active} payload={props.payload as unknown as TipEntry[]} label={props.label} unit={param.unit} />} />
          {procs.map((p) => (
            <Line key={p} type="monotone" dataKey={p} name={p} stroke={PROC_COLORS[p] ?? param.color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {procs.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-2">
          {procs.map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: PROC_COLORS[p] ?? param.color }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Silos table ──────────────────────────────────────────────────────────────

function SilosTable({ rows, loading }: { rows: EspRow[]; loading: boolean }) {
  if (loading) return <EmptyState msg="Cargando datos de silos…" />;
  const siloRows = rows.filter((r) => r.proceso_codigo === 'SILO');
  if (!siloRows.length) return <EmptyState msg="Sin datos de silos para el período." />;
  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            {['Silo', 'Destino', 'Calidad'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {siloRows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
              <td className="px-4 py-2.5 font-semibold" style={{ color: '#00D4FF' }}>{r.silo ?? '—'}</td>
              <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{r.destino ?? '—'}</td>
              <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>{r.calidad != null ? r.calidad.toFixed(2) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

const MAX_OFFSET = 7;

export default function LaboratorioAzucarPage() {
  const [offset, setOffset] = useState(0);

  const { data: selRes, isLoading: selLoading } = useAzucar(offset);
  const { data: hoyRes } = useAzucar(0);

  const selRows: EspRow[] = selRes?.data ?? [];
  const hoyRows: EspRow[] = hoyRes?.data ?? [];

  const azucarSel = selRows.filter((r) => AZUCAR_PROCS.includes(r.proceso_codigo));
  const azucarHoy = hoyRows.filter((r) => AZUCAR_PROCS.includes(r.proceso_codigo));

  const activeParams = PARAMS.filter((p) => hasData(azucarSel, p.key));
  const activeProcs  = AZUCAR_PROCS.filter((p) => azucarSel.some((r) => r.proceso_codigo === p));

  const fechaLabel = offset === 0 ? 'Día actual' : (selRes?.fecha ?? `Día −${offset}`);

  return (
    <div className="relative min-h-screen flex flex-col">
      <Sidebar />
      <TopBar plant="Laboratorio · Análisis de Azúcar" showAlertas={false} showResumenTurno={false} />

      <div className="p-5 sm:p-6 pb-3 shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border" style={{ background: 'var(--primary-soft, rgba(0,212,255,0.08))', borderColor: 'var(--primary)', color: 'var(--primary-light, #00D4FF)' }}>
            <IconFlask size={22} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Análisis de Azúcar
            </h2>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary, #A0B0C8)' }}>
              Parámetros de calidad · evolución horaria · día industrial
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={offset >= MAX_OFFSET}
            onClick={() => setOffset((o) => Math.min(o + 1, MAX_OFFSET))}
            className="p-1.5 rounded-lg border transition-all disabled:opacity-30"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <IconChevronLeft size={16} />
          </button>

          <div
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold min-w-[100px] text-center"
            style={{ borderColor: offset === 0 ? 'var(--primary)' : 'var(--border)', color: offset === 0 ? 'var(--primary-light, #00D4FF)' : 'var(--text-primary)', background: offset === 0 ? 'var(--primary-soft, rgba(0,212,255,0.08))' : 'transparent' }}
          >
            {fechaLabel}
          </div>

          <button
            type="button"
            disabled={offset <= 0}
            onClick={() => setOffset((o) => Math.max(o - 1, 0))}
            className="p-1.5 rounded-lg border transition-all disabled:opacity-30"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <IconChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="px-5 sm:px-6 pb-6 flex-1 space-y-5">
        <section>
          <SectionHeader title={offset === 0 ? 'Promedios del día' : `Promedios — ${fechaLabel}${offset > 0 ? ' · delta vs hoy' : ''}`} />
          {selLoading ? (
            <div className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</div>
          ) : azucarSel.length === 0 ? (
            <EmptyState msg="Sin lecturas para el período seleccionado." />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:flex lg:flex-wrap gap-2 sm:gap-3 lg:gap-4 xl:gap-5">
              {activeParams.map((p) => (
                <KpiCard
                  key={p.key as string}
                  label={p.label}
                  value={avgField(azucarSel, p.key)}
                  unit={p.unit}
                  dec={p.dec}
                  color={p.color}
                  refValue={offset > 0 ? avgField(azucarHoy, p.key) : undefined}
                />
              ))}
            </div>
          )}
        </section>

        {!selLoading && azucarSel.length > 0 && activeParams.length > 0 && (
          <section>
            <SectionHeader title="Evolución horaria por proceso" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeParams.map((p) => (
                <EvoChart key={p.key as string} rows={azucarSel} param={p} procs={activeProcs} />
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHeader title="Estado Silos" color="#7C6AFA" />
          <SilosTable rows={selRows} loading={selLoading} />
        </section>

        {selRows.some((r) => r.proceso_codigo === 'Soda_Cal') && (
          <section>
            <SectionHeader title="Cal / Soda / ART" color="#FFB800" />
            <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs border" style={{ background: 'rgba(255,183,0,0.06)', borderColor: 'rgba(255,183,0,0.25)', color: 'var(--text-muted)' }}>
              <IconAlertTriangle size={13} style={{ color: '#FFB800', flexShrink: 0, marginTop: 1 }} />
              <span><span style={{ color: '#FFB800', fontWeight: 600 }}>ART: </span>fuente destilería (pendiente de integración).</span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
