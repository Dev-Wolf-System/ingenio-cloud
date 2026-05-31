'use client';

import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  IconX,
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconActivity,
  IconTool,
} from '@tabler/icons-react';
import { useParadasMC } from '../_hooks/useParadasMC';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMin(m: number | null | undefined): string {
  if (m == null) return '—';
  if (m >= 120) return `${(m / 60).toFixed(1)} h`;
  return `${m.toFixed(0)} min`;
}

function fmtTs(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, '0');
  const mon = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${mon}`;
}

// ─── Tooltip type (local, no recharts generics) ───────────────────────────────

interface TooltipEntry {
  name?: string;
  value?: number | string;
  fill?: string;
  color?: string;
  dataKey?: string;
}

interface TipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | undefined;
}

function GlassTip({ active, payload, label }: TipProps) {
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0];
  return (
    <div
      style={{
        background: 'var(--bg-card, #1A2236)',
        border: '1px solid var(--border-strong, #1E3A5F)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 13,
        minWidth: 140,
      }}
    >
      <p style={{ color: 'var(--text-muted, #6B7A9E)', marginBottom: 4, fontSize: 11 }}>{label}</p>
      {payload.map((e, i) => (
        <p
          key={i}
          style={{ color: e.fill ?? e.color ?? '#00D4FF', margin: '2px 0', fontWeight: 600 }}
        >
          {e.name}: {e.value}
        </p>
      ))}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: 'var(--primary-light, #00D4FF)' }}
      >
        {title}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--border, #1E3A5F)' }} />
    </div>
  );
}

interface KpiTileProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}

function KpiTile({ label, value, sub, color = '#00D4FF', icon }: KpiTileProps) {
  return (
    <div
      className="flex-1 min-w-[120px] rounded-xl border p-3.5 flex flex-col gap-1"
      style={{
        background: 'var(--bg-card, #1A2236)',
        borderColor: 'var(--border, #1E3A5F)',
      }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon && <span style={{ color }}>{icon}</span>}
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
          {label}
        </span>
      </div>
      <span className="text-xl font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
      {sub && (
        <span className="text-[11px]" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ─── Period selector ──────────────────────────────────────────────────────────

const PERIODOS = [
  { key: 'turno' as const, label: 'Turno' },
  { key: 'dia' as const,   label: 'Día'   },
  { key: 'zafra' as const, label: 'Zafra' },
];

interface PeriodSelectorProps {
  periodo: 'turno' | 'dia' | 'zafra';
  offset: number;
  etiqueta: string;
  setPeriodo: (p: 'turno' | 'dia' | 'zafra') => void;
  stepBack: () => void;
  stepForward: () => void;
}

function PeriodSelector({ periodo, offset, etiqueta, setPeriodo, stepBack, stepForward }: PeriodSelectorProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
      style={{ background: 'var(--bg-card, #1A2236)', borderColor: 'var(--border, #1E3A5F)' }}
    >
      {/* Tabs */}
      <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border, #1E3A5F)' }}>
        {PERIODOS.map((p) => {
          const active = p.key === periodo;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriodo(p.key)}
              className="px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: active ? '#00D4FF' : 'transparent',
                color: active ? '#0A0E1A' : 'var(--text-muted, #6B7A9E)',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1.5 ml-auto">
        <button
          type="button"
          onClick={stepBack}
          disabled={offset >= 60}
          className="p-1 rounded-md transition-colors disabled:opacity-30"
          style={{ color: 'var(--text-muted, #6B7A9E)' }}
          aria-label="Período anterior"
        >
          <IconChevronLeft size={16} />
        </button>
        <span
          className="text-xs font-medium tabular-nums px-2 py-0.5 rounded min-w-[80px] text-center"
          style={{ color: 'var(--text-primary, #F0F4FF)', background: 'var(--bg-base, #0A0E1A)' }}
        >
          {etiqueta}
        </span>
        <button
          type="button"
          onClick={stepForward}
          disabled={offset <= 0}
          className="p-1 rounded-md transition-colors disabled:opacity-30"
          style={{ color: 'var(--text-muted, #6B7A9E)' }}
          aria-label="Período siguiente"
        >
          <IconChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

interface MotivoParetoProps {
  data: Array<{ motivo: string; n: number; minutos_total: number }>;
}

function MotivoParetoChart({ data }: MotivoParetoProps) {
  if (!data.length) {
    return (
      <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
        Sin paradas en el período
      </div>
    );
  }
  const sorted = data.slice().sort((a, b) => b.minutos_total - a.minutos_total).slice(0, 8);

  return (
    <div style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'var(--text-muted, #6B7A9E)' }}
            axisLine={false}
            tickLine={false}
            unit=" min"
          />
          <YAxis
            type="category"
            dataKey="motivo"
            width={100}
            tick={{ fontSize: 11, fill: 'var(--text-secondary, #A0B0C8)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={(props) => (
              <GlassTip
                active={props.active}
                payload={props.payload as unknown as TooltipEntry[]}
                label={props.label as string | undefined}
              />
            )}
          />
          <Bar dataKey="minutos_total" name="Minutos" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {sorted.map((_, i) => (
              <Cell
                key={i}
                fill={i === 0 ? '#FF4757' : i === 1 ? '#FFB800' : '#00D4FF'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface AreaChartProps {
  data: Array<{ area: string; n: number; minutos_total: number }>;
}

function AreaBarChart({ data }: AreaChartProps) {
  if (!data.length) {
    return (
      <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
        Sin datos por área
      </div>
    );
  }
  const sorted = data.slice().sort((a, b) => b.minutos_total - a.minutos_total).slice(0, 8);

  return (
    <div style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'var(--text-muted, #6B7A9E)' }}
            axisLine={false}
            tickLine={false}
            unit=" min"
          />
          <YAxis
            type="category"
            dataKey="area"
            width={90}
            tick={{ fontSize: 11, fill: 'var(--text-secondary, #A0B0C8)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={(props) => (
              <GlassTip
                active={props.active}
                payload={props.payload as unknown as TooltipEntry[]}
                label={props.label as string | undefined}
              />
            )}
          />
          <Bar dataKey="minutos_total" name="Minutos" fill="#00E5A0" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SeriesDiaProps {
  data: Array<{ dia: string; n: number; minutos: number }>;
}

function SeriesDiaChart({ data }: SeriesDiaProps) {
  if (!data.length) {
    return (
      <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
        Sin serie temporal disponible
      </div>
    );
  }
  const display = data.map((d) => ({ ...d, label: fmtDate(d.dia) }));

  return (
    <div style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={display} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--text-muted, #6B7A9E)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted, #6B7A9E)' }}
            axisLine={false}
            tickLine={false}
            width={32}
            unit=" m"
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={(props) => (
              <GlassTip
                active={props.active}
                payload={props.payload as unknown as TooltipEntry[]}
                label={props.label as string | undefined}
              />
            )}
          />
          <Bar dataKey="minutos" name="Min parada" fill="#FFB800" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Paradas table ────────────────────────────────────────────────────────────

interface ParadaRow {
  inicio: string;
  fin: string | null;
  minutos: number | null;
  motivo: string;
  maquina: string | null;
  origen: string | null;
}

function ParadasTable({ rows }: { rows: ParadaRow[] }) {
  if (!rows.length) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
        Sin paradas registradas en el período
      </div>
    );
  }

  return (
    <div
      className="overflow-auto rounded-xl border"
      style={{ borderColor: 'var(--border, #1E3A5F)', maxHeight: 280 }}
    >
      <table className="w-full text-sm min-w-[560px]">
        <thead
          className="sticky top-0"
          style={{ background: 'var(--bg-card, #1A2236)', zIndex: 1 }}
        >
          <tr style={{ borderBottom: '1px solid var(--border, #1E3A5F)' }}>
            {['Inicio', 'Fin', 'Duración', 'Área', 'Máquina', 'Motivo'].map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted, #6B7A9E)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                borderBottom: '1px solid var(--border, #1E3A5F)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}
            >
              <td
                className="px-3 py-2 tabular-nums font-mono text-xs"
                style={{ color: 'var(--text-secondary, #A0B0C8)' }}
              >
                {fmtTs(row.inicio)}
              </td>
              <td
                className="px-3 py-2 tabular-nums font-mono text-xs"
                style={{ color: row.fin ? 'var(--text-secondary, #A0B0C8)' : '#FFB800' }}
              >
                {row.fin ? fmtTs(row.fin) : 'En curso'}
              </td>
              <td
                className="px-3 py-2 tabular-nums font-semibold text-xs"
                style={{
                  color:
                    row.minutos == null
                      ? '#FFB800'
                      : row.minutos > 60
                      ? '#FF4757'
                      : row.minutos > 20
                      ? '#FFB800'
                      : '#00E5A0',
                }}
              >
                {fmtMin(row.minutos)}
              </td>
              <td
                className="px-3 py-2 text-xs"
                style={{ color: 'var(--text-secondary, #A0B0C8)' }}
              >
                {row.origen ?? '—'}
              </td>
              <td
                className="px-3 py-2 text-xs"
                style={{ color: 'var(--text-muted, #6B7A9E)' }}
              >
                {row.maquina ?? '—'}
              </td>
              <td
                className="px-3 py-2 text-xs font-medium"
                style={{ color: 'var(--text-primary, #F0F4FF)' }}
              >
                {row.motivo}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function ParadasModal() {
  const [open, setOpen] = useState(false);
  const { periodo, setPeriodo, offset, stepBack, stepForward, data, loading } = useParadasMC();

  const rel = data?.reliabilidad;
  const etiqueta = data?.rango?.etiqueta ?? '…';

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all hover:brightness-110"
        style={{
          borderColor: '#FF4757',
          color: '#FF4757',
          background: 'rgba(255,71,87,0.08)',
        }}
      >
        <IconAlertTriangle size={15} />
        Paradas del día
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
              className="relative w-full max-w-[92vw] xl:max-w-5xl rounded-2xl overflow-hidden border-2 flex flex-col max-h-[90vh]"
              style={{
                background:
                  'var(--panel-mesh-1, transparent), var(--panel-mesh-2, transparent), linear-gradient(135deg, var(--surface-panel-from, #111827), var(--surface-panel-to, #1A2236))',
                borderColor: 'var(--border-strong, #1E3A5F)',
                boxShadow: 'var(--panel-shadow, none), 0 40px 120px rgba(0,0,0,0.45)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top accent bar */}
              <div
                aria-hidden
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, #FF4757, #FFB800)' }}
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
                    background: 'rgba(255,71,87,0.10)',
                    borderColor: '#FF4757',
                    color: '#FF4757',
                  }}
                >
                  <IconActivity size={22} />
                </div>
                <div>
                  <h2
                    className="text-xl sm:text-2xl font-bold tracking-tight leading-tight"
                    style={{ color: 'var(--text-primary, #F0F4FF)', fontFamily: 'var(--font-display)' }}
                  >
                    Paradas de Molienda
                  </h2>
                  <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary, #A0B0C8)' }}>
                    Confiabilidad · MTBF · MTTR · detalle por área y motivo
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 sm:px-6 pb-6 overflow-y-auto flex-1 space-y-5">

                {/* Period selector */}
                <PeriodSelector
                  periodo={periodo}
                  offset={offset}
                  etiqueta={etiqueta}
                  setPeriodo={setPeriodo}
                  stepBack={stepBack}
                  stepForward={stepForward}
                />

                {loading ? (
                  <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
                    Cargando datos de paradas…
                  </div>
                ) : !data ? (
                  <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
                    Sin datos disponibles para el período seleccionado.
                  </div>
                ) : (
                  <>
                    {/* ── KPIs confiabilidad ── */}
                    <section>
                      <SectionHeader title="Confiabilidad" />
                      <div className="flex flex-wrap gap-3">
                        <KpiTile
                          label="Paradas"
                          value={rel ? String(rel.paradas_n) : '—'}
                          sub="en el período"
                          color="#FF4757"
                          icon={<IconAlertTriangle size={13} />}
                        />
                        <KpiTile
                          label="Downtime total"
                          value={fmtMin(rel?.downtime_total_min)}
                          sub={rel ? `de ${fmtMin(rel.span_min)} span` : undefined}
                          color="#FFB800"
                          icon={<IconClock size={13} />}
                        />
                        <KpiTile
                          label="MTBF"
                          value={fmtMin(rel?.mtbf_min)}
                          sub="entre fallas"
                          color="#00D4FF"
                          icon={<IconActivity size={13} />}
                        />
                        <KpiTile
                          label="MTTR"
                          value={fmtMin(rel?.mttr_min)}
                          sub="para reparar"
                          color="#00E5A0"
                          icon={<IconTool size={13} />}
                        />
                        <KpiTile
                          label="MTTF"
                          value={fmtMin(rel?.mttf_min)}
                          sub="tiempo libre de falla"
                          color="#7C6AFA"
                          icon={<IconActivity size={13} />}
                        />
                      </div>
                    </section>

                    {/* ── Gráficos ── */}
                    <section>
                      <SectionHeader title="Pareto por motivo (top 8)" />
                      <div
                        className="rounded-xl border p-4"
                        style={{
                          background: 'var(--bg-card, #1A2236)',
                          borderColor: 'var(--border, #1E3A5F)',
                        }}
                      >
                        <MotivoParetoChart data={data.por_motivo} />
                      </div>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <SectionHeader title="Por área" />
                        <div
                          className="rounded-xl border p-4"
                          style={{
                            background: 'var(--bg-card, #1A2236)',
                            borderColor: 'var(--border, #1E3A5F)',
                          }}
                        >
                          <AreaBarChart data={data.por_area} />
                        </div>
                      </div>

                      {data.series_dia.length > 1 && (
                        <div>
                          <SectionHeader title="Serie temporal (días)" />
                          <div
                            className="rounded-xl border p-4"
                            style={{
                              background: 'var(--bg-card, #1A2236)',
                              borderColor: 'var(--border, #1E3A5F)',
                            }}
                          >
                            <SeriesDiaChart data={data.series_dia} />
                          </div>
                        </div>
                      )}
                    </section>

                    {/* ── Tabla de paradas ── */}
                    <section>
                      <SectionHeader title={`Detalle de paradas · ${data.reliabilidad.paradas_n} registros`} />
                      <ParadasTable rows={data.paradas} />
                    </section>
                  </>
                )}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
