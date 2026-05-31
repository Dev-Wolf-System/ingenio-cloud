'use client';

import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { IconX, IconFlask, IconClock, IconAlertTriangle } from '@tabler/icons-react';
import { useAzucar } from '../_hooks/useMoliendaCloud';
import type { EspRow } from '../_hooks/useMoliendaCloud';

// ─── Param definitions ────────────────────────────────────────────────────────

interface ParamDef {
  key: keyof EspRow;
  label: string;
  unit: string;
  dec: number;
  color: string;
}

const PARAMS: ParamDef[] = [
  { key: 'color_icumsa',    label: 'Color ICUMSA',   unit: 'UI',  dec: 0, color: '#00D4FF' },
  { key: 'turbidez',        label: 'Turbidez',        unit: '',    dec: 2, color: '#FF6B35' },
  { key: 'humedad',         label: 'Humedad',         unit: '%',   dec: 2, color: '#00E5A0' },
  { key: 'cenizas',         label: 'Cenizas',         unit: '%',   dec: 2, color: '#FFB800' },
  { key: 'sediment_test',   label: 'Sedimento',       unit: '',    dec: 2, color: '#7C6AFA' },
  { key: 'so2_ppm',         label: 'SO₂',             unit: 'ppm', dec: 0, color: '#F43F5E' },
  { key: 'granulometria_20',label: 'Granulometría 20',unit: '',    dec: 2, color: '#0EA5E9' },
  { key: 'granulometria_30',label: 'Granulometría 30',unit: '',    dec: 2, color: '#F59E0B' },
  { key: 'calidad',         label: 'Calidad',         unit: '',    dec: 2, color: '#00D4FF' },
];

// Process codes we care about for azúcar quality charts
const AZUCAR_PROCS = ['Cinta Corta', 'Cinta Larga', 'Envases'];
const PROC_COLORS: Record<string, string> = {
  'Cinta Corta': '#00D4FF',
  'Cinta Larga': '#FF6B35',
  'Envases':     '#00E5A0',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avgField(rows: EspRow[], key: keyof EspRow): number | null {
  const vals: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i][key];
    if (typeof v === 'number') vals.push(v);
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function hasData(rows: EspRow[], key: keyof EspRow): boolean {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][key] != null) return true;
  }
  return false;
}

function fmtVal(v: number | null, dec: number): string {
  if (v == null) return '—';
  return v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Multi-proc series: group by hora, avg per proc */
function buildMultiProcSeries(
  rows: EspRow[],
  procs: string[],
  key: keyof EspRow,
): Array<Record<string, unknown>> {
  const horasSet: Set<string> = new Set();
  const byProcHora: Record<string, Record<string, number[]>> = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!procs.includes(r.proceso_codigo)) continue;
    const v = r[key];
    if (typeof v !== 'number') continue;
    const hora = r.hora_lectura ? r.hora_lectura.slice(0, 2) + ':00' : '??';
    horasSet.add(hora);
    if (!byProcHora[r.proceso_codigo]) byProcHora[r.proceso_codigo] = {};
    if (!byProcHora[r.proceso_codigo][hora]) byProcHora[r.proceso_codigo][hora] = [];
    byProcHora[r.proceso_codigo][hora].push(v);
  }
  const horas = Array.from(horasSet).sort();
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
        minWidth: 140,
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

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, unit, color }: { label: string; value: number | null; unit: string; color: string }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-xl border p-3"
      style={{ background: 'var(--bg-card, #1A2236)', borderColor: 'var(--border, #1E3A5F)', minWidth: 100 }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
        {label}
      </span>
      <span className="text-xl lg:text-2xl xl:text-3xl font-bold tabular-nums" style={{ color }}>
        {value != null ? fmtVal(value, value < 10 ? 2 : 0) : '—'}
      </span>
      {unit && (
        <span className="text-[10px]" style={{ color: 'var(--text-muted, #6B7A9E)' }}>{unit}</span>
      )}
    </div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionHeader({ title, color = 'var(--primary-light, #00D4FF)' }: { title: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
        {title}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--border, #1E3A5F)' }} />
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
      {msg}
    </div>
  );
}

// ─── Evolution chart (single param, multi-proc lines) ────────────────────────

interface EvoChartProps {
  rows: EspRow[];
  param: ParamDef;
  procs: string[];
}

function EvoChart({ rows, param, procs }: EvoChartProps) {
  const series = buildMultiProcSeries(rows, procs, param.key);
  if (!series.length) return null;

  return (
    <div
      className="rounded-xl border p-3"
      style={{ background: 'var(--bg-card, #1A2236)', borderColor: 'var(--border, #1E3A5F)' }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: param.color }}>
        {param.label} {param.unit ? `(${param.unit})` : ''}
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={series} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="hora" tick={{ fontSize: 10, fill: 'var(--text-muted, #6B7A9E)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted, #6B7A9E)' }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            content={(props) => (
              <GlassTip
                active={props.active}
                payload={props.payload as unknown as TipEntry[] | undefined}
                label={props.label}
                unit={param.unit}
              />
            )}
          />
          {procs.map((p) => (
            <Line
              key={p}
              type="monotone"
              dataKey={p}
              name={p}
              stroke={PROC_COLORS[p] ?? param.color}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {procs.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-2">
          {procs.map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: PROC_COLORS[p] ?? param.color }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted, #6B7A9E)' }}>{p}</span>
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
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border, #1E3A5F)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--bg-card, #1A2236)', borderBottom: '1px solid var(--border, #1E3A5F)' }}>
            {['Silo', 'Destino', 'Calidad'].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted, #6B7A9E)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {siloRows.map((r, i) => (
            <tr
              key={i}
              style={{
                borderBottom: '1px solid var(--border, #1E3A5F)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}
            >
              <td className="px-4 py-2.5 font-semibold" style={{ color: '#00D4FF' }}>{r.silo ?? '—'}</td>
              <td className="px-4 py-2.5" style={{ color: 'var(--text-primary, #F0F4FF)' }}>{r.destino ?? '—'}</td>
              <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-primary, #F0F4FF)' }}>
                {r.calidad != null ? r.calidad.toFixed(2) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function AnalisisAzucarModal() {
  const [open, setOpen] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data: rangoRes, isLoading: rangoLoading } = useAzucar(desde || undefined, hasta || undefined);
  const { data: diaRes, isLoading: diaLoading } = useAzucar();

  const rangoRows: EspRow[] = rangoRes?.data ?? [];
  const diaRows: EspRow[] = diaRes?.data ?? [];

  // For KPIs and charts use rango rows (which equals día rows when no filter)
  const displayRows = rangoRows;
  const azucarRows = displayRows.filter(
    (r) => AZUCAR_PROCS.includes(r.proceso_codigo),
  );

  // Params that have any data in display rows
  const activeParams = PARAMS.filter((p) => hasData(azucarRows, p.key));
  // Active procs present in azucarRows
  const activeProcs = AZUCAR_PROCS.filter((p) => azucarRows.some((r) => r.proceso_codigo === p));

  function handleClose() { setOpen(false); }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg border text-[11px] sm:text-sm font-medium transition-all hover:brightness-110 whitespace-nowrap shrink-0"
        style={{
          borderColor: 'var(--primary, #00D4FF)',
          color: 'var(--primary-light, #00D4FF)',
          background: 'var(--primary-soft, rgba(0,212,255,0.08))',
        }}
      >
        <IconFlask size={14} />
        Análisis de Azúcar
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={handleClose}
          >
            <m.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative w-full max-w-[92vw] lg:max-w-6xl xl:max-w-7xl rounded-2xl overflow-hidden border-2 flex flex-col max-h-[90vh]"
              style={{
                background: 'linear-gradient(135deg, var(--surface-panel-from, #111827), var(--surface-panel-to, #1A2236))',
                borderColor: 'var(--border-strong, #1E3A5F)',
                boxShadow: '0 40px 120px rgba(0,0,0,0.45)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top accent bar */}
              <div
                aria-hidden
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, var(--primary, #00D4FF), var(--accent, #FF6B35))' }}
              />

              {/* Close */}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 p-1.5 rounded-md transition-colors z-10"
                style={{ color: 'var(--text-muted, #6B7A9E)' }}
                aria-label="Cerrar"
              >
                <IconX size={16} />
              </button>

              {/* Header */}
              <div className="p-5 sm:p-6 pb-3 shrink-0 flex items-center gap-3.5">
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    background: 'var(--primary-soft, rgba(0,212,255,0.08))',
                    borderColor: 'var(--primary, #00D4FF)',
                    color: 'var(--primary-light, #00D4FF)',
                  }}
                >
                  <IconFlask size={22} />
                </div>
                <div>
                  <h2
                    className="text-xl sm:text-2xl font-bold tracking-tight leading-tight"
                    style={{ color: 'var(--text-primary, #F0F4FF)', fontFamily: 'var(--font-display)' }}
                  >
                    Análisis de Azúcar
                  </h2>
                  <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary, #A0B0C8)' }}>
                    Parámetros de calidad · evolución horaria · día industrial
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 sm:px-6 pb-6 overflow-y-auto flex-1 space-y-5">

                {/* Rango horario */}
                <div
                  className="rounded-xl border p-4 space-y-3"
                  style={{ borderColor: 'var(--border, #1E3A5F)', background: 'var(--bg-card, #1A2236)' }}
                >
                  <div
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                    style={{ color: 'var(--text-muted, #6B7A9E)' }}
                  >
                    <IconClock size={13} />
                    Rango horario (opcional)
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
                      Desde
                      <input
                        type="time"
                        value={desde}
                        onChange={(e) => setDesde(e.target.value)}
                        className="rounded-md px-2 py-1 text-xs border"
                        style={{ background: 'var(--bg-base, #0A0E1A)', borderColor: 'var(--border, #1E3A5F)', color: 'var(--text-primary, #F0F4FF)', colorScheme: 'dark' }}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
                      Hasta
                      <input
                        type="time"
                        value={hasta}
                        onChange={(e) => setHasta(e.target.value)}
                        className="rounded-md px-2 py-1 text-xs border"
                        style={{ background: 'var(--bg-base, #0A0E1A)', borderColor: 'var(--border, #1E3A5F)', color: 'var(--text-primary, #F0F4FF)', colorScheme: 'dark' }}
                      />
                    </label>
                    {(desde || hasta) && (
                      <button
                        type="button"
                        onClick={() => { setDesde(''); setHasta(''); }}
                        className="text-xs underline"
                        style={{ color: 'var(--text-muted, #6B7A9E)' }}
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                {/* KPIs promedio del día */}
                <section>
                  <SectionHeader
                    title={desde || hasta ? `Promedios (${desde || '—'} → ${hasta || '—'})` : 'Promedios del día'}
                  />
                  {rangoLoading ? (
                    <div className="py-6 text-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>Cargando…</div>
                  ) : azucarRows.length === 0 ? (
                    <EmptyState msg="Sin lecturas para el período seleccionado." />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {activeParams.map((p) => {
                        const avg = avgField(azucarRows, p.key);
                        return (
                          <KpiCard
                            key={p.key as string}
                            label={p.label}
                            value={avg}
                            unit={p.unit}
                            color={p.color}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Evolución horaria — charts */}
                {!rangoLoading && azucarRows.length > 0 && activeParams.length > 0 && (
                  <section>
                    <SectionHeader title="Evolución horaria por proceso" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeParams.map((p) => (
                        <EvoChart
                          key={p.key as string}
                          rows={azucarRows}
                          param={p}
                          procs={activeProcs}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Promedio del día (solo si hay filtro de rango) */}
                {(desde || hasta) && (
                  <section>
                    <SectionHeader title="Promedios del día completo" />
                    {diaLoading ? (
                      <div className="py-4 text-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>Cargando…</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {PARAMS.filter((p) => hasData(diaRows.filter((r) => AZUCAR_PROCS.includes(r.proceso_codigo)), p.key)).map((p) => {
                          const diaAzucar = diaRows.filter((r) => AZUCAR_PROCS.includes(r.proceso_codigo));
                          const avg = avgField(diaAzucar, p.key);
                          return (
                            <KpiCard
                              key={p.key as string}
                              label={p.label}
                              value={avg}
                              unit={p.unit}
                              color={p.color}
                            />
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                {/* Estado silos */}
                <section>
                  <SectionHeader title="Estado Silos" color="#7C6AFA" />
                  <SilosTable rows={diaRows} loading={diaLoading} />
                </section>

                {/* Cal/Soda note */}
                {diaRows.some((r) => r.proceso_codigo === 'Soda_Cal') && (
                  <section>
                    <SectionHeader title="Cal / Soda / ART" color="#FFB800" />
                    <div
                      className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs border"
                      style={{
                        background: 'rgba(255,183,0,0.06)',
                        borderColor: 'rgba(255,183,0,0.25)',
                        color: 'var(--text-muted, #6B7A9E)',
                      }}
                    >
                      <IconAlertTriangle size={13} style={{ color: '#FFB800', flexShrink: 0, marginTop: 1 }} />
                      <span>
                        <span style={{ color: '#FFB800', fontWeight: 600 }}>ART: </span>
                        fuente destilería (pendiente de integración).
                      </span>
                    </div>
                  </section>
                )}

              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
