'use client';

import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from 'recharts';
import {
  IconX, IconTruck, IconClock, IconUsers, IconActivity,
  IconBuildingWarehouse, IconLeaf, IconBrain, IconAlertTriangle,
} from '@tabler/icons-react';
import { useCanchon, useAnalisCana } from '../_hooks/useMoliendaCloud';
import type { CanchonResumen } from '../_types';
import type { FincaAnalisRow, CañeroAnalisRow } from '../_hooks/useMoliendaCloud';

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TipEntry { name?: string; value?: number | string; color?: string }

function GlassTip({ active, payload, label, unit = '' }: { active?: boolean; payload?: TipEntry[]; label?: unknown; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card,#1A2236)', border: '1px solid var(--border,#1E3A5F)', borderRadius: 8, padding: '8px 12px', minWidth: 160 }}>
      <p style={{ color: 'var(--text-muted,#6B7A9E)', fontSize: 11, marginBottom: 4 }}>{String(label ?? '')}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ color: e.color ?? '#00D4FF', fontSize: 13, fontWeight: 600, margin: '2px 0' }}>
          {e.name}: <span style={{ color: 'var(--text-primary,#F0F4FF)' }}>{typeof e.value === 'number' ? e.value.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : e.value}{unit ? ` ${unit}` : ''}</span>
        </p>
      ))}
    </div>
  );
}

// ─── KPI tiles ────────────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, color = '#00D4FF', icon }: { label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-[110px] rounded-xl border p-3 flex flex-col gap-1" style={{ background: 'var(--bg-card,#1A2236)', borderColor: 'var(--border,#1E3A5F)' }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon && <span style={{ color }}>{icon}</span>}
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted,#6B7A9E)' }}>{label}</span>
      </div>
      <span className="text-xl lg:text-2xl font-bold tabular-nums" style={{ color }}>{value}</span>
      {sub && <span className="text-[11px]" style={{ color: 'var(--text-muted,#6B7A9E)' }}>{sub}</span>}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, color = 'var(--primary,#00D4FF)' }: { title: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{title}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border,#1E3A5F)' }} />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function n(v: unknown, dec = 0): string {
  if (v == null || typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function rtoColor(rto: number, avg: number): string {
  if (rto < avg - 0.3) return '#FF4757';
  if (rto < avg) return '#FFB800';
  return '#00E5A0';
}

function truncate(s: string, max = 18): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function extractCanchonKpis(resumen: CanchonResumen | null | undefined) {
  if (!resumen) return { total: null, esperando: null, espPromedio: null, espMax: null };
  const r = resumen;
  const k = Object.keys(r);
  function findNum(...patterns: string[]): number | null {
    for (const p of patterns) for (const key of k) if (key.toLowerCase().includes(p.toLowerCase())) { const v = r[key]; if (typeof v === 'number' && Number.isFinite(v)) return v; }
    return null;
  }
  return { total: findNum('total_camiones', 'total'), esperando: findNum('esperando', 'en_espera', 'espera'), espPromedio: findNum('espera_promedio', 'minutos_espera_prom', 'prom_espera'), espMax: findNum('espera_max', 'max_espera', 'minutos_espera_max') };
}

// ─── Finca chart (horizontal bar) ────────────────────────────────────────────

function FincaBarChart({ data, avg, dataKey, unit, label }: { data: FincaAnalisRow[]; avg: number; dataKey: keyof FincaAnalisRow; unit: string; label: string }) {
  const top = data.slice(0, 12);
  const chartData = top.map((f) => ({ ...f, label: truncate(f.finca) }));
  const barH = 26;
  const height = Math.max(200, chartData.length * barH + 40);
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--bg-card,#1A2236)', borderColor: 'var(--border,#1E3A5F)' }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted,#6B7A9E)' }}>{label}</p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted,#6B7A9E)' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 10, fill: 'var(--text-muted,#6B7A9E)' }} axisLine={false} tickLine={false} />
          {dataKey === 'rto' && <ReferenceLine x={avg} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 3" />}
          <Tooltip content={(p) => <GlassTip active={p.active} payload={p.payload as TipEntry[] | undefined} label={p.label} unit={unit} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey={dataKey} name={label} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
            {chartData.map((f, i) => (
              <Cell key={i} fill={dataKey === 'rto' ? rtoColor(f.rto, avg) : '#00D4FF'} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Cañero chart ─────────────────────────────────────────────────────────────

function CañeroChart({ data }: { data: CañeroAnalisRow[] }) {
  const chartData = data.map((c) => ({ ...c, label: truncate(c.cañero, 22) }));
  const height = Math.max(120, chartData.length * 30 + 40);
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--bg-card,#1A2236)', borderColor: 'var(--border,#1E3A5F)' }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted,#6B7A9E)' }}>Toneladas por cañero</p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted,#6B7A9E)' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 10, fill: 'var(--text-muted,#6B7A9E)' }} axisLine={false} tickLine={false} />
          <Tooltip content={(p) => <GlassTip active={p.active} payload={p.payload as TipEntry[] | undefined} label={p.label} unit="t" />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="ton_neta" name="Ton neta" fill="#7C6AFA" fillOpacity={0.85} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Fincas bajas en rendimiento ──────────────────────────────────────────────

function FincasBajas({ data, avg }: { data: FincaAnalisRow[]; avg: number }) {
  const bajas = data.filter((f) => f.vs_avg < -0.2 && f.camiones >= 5).sort((a, b) => a.rto - b.rto).slice(0, 8);
  if (!bajas.length) return (
    <div className="rounded-xl border p-4 flex items-center gap-2" style={{ background: 'var(--bg-card,#1A2236)', borderColor: 'var(--border,#1E3A5F)' }}>
      <span style={{ color: '#00E5A0' }}>✓</span>
      <span className="text-sm" style={{ color: 'var(--text-muted,#6B7A9E)' }}>Todas las fincas con volumen significativo están dentro del rango promedio.</span>
    </div>
  );
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card,#1A2236)', borderColor: 'var(--border,#1E3A5F)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: 'rgba(255,71,87,0.08)' }}>
            {['Finca', 'Camiones', 'Ton neta', 'Rto %', 'vs avg'].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider" style={{ color: '#FF4757' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bajas.map((f, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border,#1E3A5F)' }}>
              <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary,#F0F4FF)' }}>{f.finca}</td>
              <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--text-muted,#6B7A9E)' }}>{f.camiones}</td>
              <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--text-muted,#6B7A9E)' }}>{n(f.ton_neta, 1)}</td>
              <td className="px-3 py-2 tabular-nums font-bold" style={{ color: rtoColor(f.rto, avg) }}>{n(f.rto, 2)}</td>
              <td className="px-3 py-2 tabular-nums font-semibold" style={{ color: '#FF4757' }}>{n(f.vs_avg, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────

function AiPanel({ insight, loading }: { insight: { resumen: string; alertas: string[]; recomendaciones: string[] } | null | undefined; loading: boolean }) {
  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'rgba(124,106,250,0.06)', borderColor: 'rgba(124,106,250,0.25)' }}>
      <div className="flex items-center gap-2">
        <IconBrain size={16} style={{ color: '#7C6AFA' }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7C6AFA' }}>Análisis IA</span>
      </div>
      {loading && !insight ? (
        <div className="space-y-2">
          {[100, 80, 90].map((w, i) => <div key={i} className="h-3 rounded animate-pulse" style={{ width: `${w}%`, background: 'rgba(124,106,250,0.15)' }} />)}
        </div>
      ) : !insight ? (
        <p className="text-sm" style={{ color: 'var(--text-muted,#6B7A9E)' }}>Sin análisis disponible.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary,#F0F4FF)' }}>{insight.resumen}</p>
          {insight.alertas.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#FFB800' }}>Alertas agronómicas</p>
              {insight.alertas.map((a, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <IconAlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: '#FFB800' }} />
                  <span style={{ color: 'var(--text-primary,#F0F4FF)' }}>{a}</span>
                </div>
              ))}
            </div>
          )}
          {insight.recomendaciones.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#00E5A0' }}>Recomendaciones</p>
              {insight.recomendaciones.map((r, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span style={{ color: '#00E5A0' }}>→</span>
                  <span style={{ color: 'var(--text-primary,#F0F4FF)' }}>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface CanchonModalProps { open: boolean; onClose: () => void }

export function CanchonModal({ open, onClose }: CanchonModalProps) {
  const [zafra, setZafra] = useState<number | undefined>(undefined);
  const canchon = useCanchon();
  const analis = useAnalisCana(zafra);

  const resumen = (canchon.data?.data ?? null) as CanchonResumen | null;
  const kpis = extractCanchonKpis(resumen);

  const data = analis.data;
  const zafras = data?.zafras ?? [];
  const stats = data?.stats;
  const por_finca = data?.por_finca ?? [];
  const por_cañero = data?.por_cañero ?? [];
  const insight = data?.insight;

  // On first load, pick current year if no zafra selected
  const activeZafra = zafra ?? (zafras[0]?.anio);
  const rto_avg = stats?.rto_avg ?? 0;

  // Sort for rto chart: ascending (lowest first)
  const finca_por_rto = [...por_finca].sort((a, b) => a.rto - b.rto);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <m.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative w-full max-w-[94vw] lg:max-w-6xl xl:max-w-7xl rounded-2xl overflow-hidden border-2 flex flex-col max-h-[92vh]"
            style={{ background: 'linear-gradient(135deg,var(--surface-panel-from,#111827),var(--surface-panel-to,#1A2236))', borderColor: 'var(--border-strong,#1E3A5F)', boxShadow: '0 40px 120px rgba(0,0,0,0.45)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg,var(--primary,#00D4FF),var(--accent,#FF6B35))' }} />

            <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-md z-10" style={{ color: 'var(--text-muted,#6B7A9E)' }} aria-label="Cerrar">
              <IconX size={16} />
            </button>

            {/* Header */}
            <div className="p-5 sm:p-6 pb-3 shrink-0 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border" style={{ background: 'rgba(0,212,255,0.08)', borderColor: 'var(--primary,#00D4FF)', color: 'var(--primary,#00D4FF)' }}>
                <IconBuildingWarehouse size={22} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary,#F0F4FF)', fontFamily: 'var(--font-display)' }}>
                  Análisis Cañero · Zafra
                </h2>
                <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary,#A0B0C8)' }}>
                  Desglose por finca, rendimiento y cañeros · análisis IA
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 sm:px-6 pb-6 overflow-y-auto flex-1 space-y-5">

              {/* KPIs del día (canchón real-time) */}
              <div>
                <SectionHeader title="Estado actual — canchón" color="var(--primary,#00D4FF)" />
                <div className="flex flex-wrap gap-3">
                  <KpiTile label="Total hoy" value={n(kpis.total)} sub="camiones en el día" color="#00D4FF" icon={<IconTruck size={13} />} />
                  {kpis.esperando != null && <KpiTile label="Esperando" value={n(kpis.esperando)} sub="en este momento" color="#FFB800" icon={<IconUsers size={13} />} />}
                  {kpis.espPromedio != null && <KpiTile label="Espera prom." value={`${n(kpis.espPromedio, 1)} min`} sub="tiempo en canchón" color="#00E5A0" icon={<IconClock size={13} />} />}
                  {kpis.espMax != null && <KpiTile label="Espera máx." value={`${n(kpis.espMax, 1)} min`} color="#FF6B35" icon={<IconActivity size={13} />} />}
                </div>
              </div>

              {/* Selector zafra */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3" style={{ background: 'var(--bg-card,#1A2236)', borderColor: 'var(--border,#1E3A5F)' }}>
                <IconLeaf size={14} style={{ color: '#00E5A0' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted,#6B7A9E)' }}>Zafra</span>
                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border,#1E3A5F)' }}>
                  {zafras.map((z) => {
                    const active = z.anio === (activeZafra ?? zafras[0]?.anio);
                    return (
                      <button key={z.anio} type="button"
                        onClick={() => setZafra(z.anio)}
                        className="px-3 py-1.5 text-xs font-semibold transition-all"
                        style={{ background: active ? '#00E5A0' : 'transparent', color: active ? '#0A0E1A' : 'var(--text-muted,#6B7A9E)' }}
                      >
                        {z.anio}
                      </button>
                    );
                  })}
                </div>
                {analis.isFetching && <span className="text-[10px] animate-pulse" style={{ color: 'var(--text-muted,#6B7A9E)' }}>Cargando…</span>}
              </div>

              {/* KPIs zafra */}
              {stats && (
                <div>
                  <SectionHeader title={`Totales zafra ${activeZafra}`} color="#00E5A0" />
                  <div className="flex flex-wrap gap-3">
                    <KpiTile label="Camiones" value={n(stats.camiones)} sub="con análisis" color="#00D4FF" icon={<IconTruck size={13} />} />
                    <KpiTile label="Ton. neta" value={`${n(stats.ton_neta, 0)} t`} sub="caña neta total" color="#00E5A0" icon={<IconLeaf size={13} />} />
                    <KpiTile label="Rto. promedio" value={`${n(stats.rto_avg, 2)}%`} sub="ponderado zafra" color="#FFB800" />
                    <KpiTile label="Fincas" value={n(stats.fincas_count)} sub="proveedoras activas" color="#7C6AFA" />
                  </div>
                </div>
              )}

              {/* Charts: finca por volumen + finca por rendimiento */}
              {por_finca.length > 0 && (
                <div>
                  <SectionHeader title="Análisis por finca" color="#00D4FF" />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <FincaBarChart data={por_finca} avg={rto_avg} dataKey="ton_neta" unit="t" label="Aporte — ton. neta (mayor a menor)" />
                    <FincaBarChart data={finca_por_rto} avg={rto_avg} dataKey="rto" unit="%" label="Rendimiento % (menor a mayor · línea = promedio)" />
                  </div>
                </div>
              )}

              {/* Fincas bajo rendimiento */}
              {por_finca.length > 0 && (
                <div>
                  <SectionHeader title="Fincas bajo rendimiento" color="#FF4757" />
                  <FincasBajas data={por_finca} avg={rto_avg} />
                </div>
              )}

              {/* Cañeros */}
              {por_cañero.length > 0 && (
                <div>
                  <SectionHeader title="Desglose por cañero" color="#7C6AFA" />
                  <CañeroChart data={por_cañero} />
                </div>
              )}

              {/* AI analysis */}
              <div>
                <SectionHeader title="Análisis IA" color="#7C6AFA" />
                <AiPanel insight={insight} loading={analis.isLoading} />
              </div>

            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
