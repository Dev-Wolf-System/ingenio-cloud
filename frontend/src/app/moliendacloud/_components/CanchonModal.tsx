'use client';

import { AnimatePresence, m } from 'motion/react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  IconX,
  IconTruck,
  IconClock,
  IconUsers,
  IconActivity,
} from '@tabler/icons-react';
import { useCanchon, useBalanzaHora } from '../_hooks/useMoliendaCloud';
import type { CanchonResumen } from '../_types';

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipEntry { name?: string; value?: number; color?: string }

function GlassTip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: 'var(--bg-card, #1A2236)',
        border: '1px solid var(--border, #1E3A5F)',
        borderRadius: 8,
        padding: '8px 12px',
        minWidth: 140,
      }}
    >
      <p style={{ color: 'var(--text-muted, #6B7A9E)', fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color ?? '#00D4FF', fontSize: 13, fontWeight: 600 }}>
          Camiones: <span style={{ color: 'var(--text-primary, #F0F4FF)' }}>{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── KPI tiles ────────────────────────────────────────────────────────────────

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
      style={{ background: 'var(--bg-card, #1A2236)', borderColor: 'var(--border, #1E3A5F)' }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon && <span style={{ color }}>{icon}</span>}
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
          {label}
        </span>
      </div>
      <span className="text-xl lg:text-2xl xl:text-3xl font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
      {sub && (
        <span className="text-[11px] lg:text-xs" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function numOrDash(v: unknown, decimals = 0): string {
  if (v == null || typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function extractCanchonKpis(resumen: CanchonResumen | null | undefined) {
  if (!resumen) return { total: null, esperando: null, espPromedio: null, espMax: null };
  const r = resumen;
  const k = Object.keys(r);

  function findNum(...patterns: string[]): number | null {
    for (const p of patterns) {
      for (let i = 0; i < k.length; i++) {
        if (k[i].toLowerCase().includes(p.toLowerCase())) {
          const v = r[k[i]];
          if (typeof v === 'number' && Number.isFinite(v)) return v;
        }
      }
    }
    return null;
  }

  return {
    total:      findNum('total_camiones', 'total'),
    esperando:  findNum('esperando', 'en_espera', 'espera'),
    espPromedio: findNum('espera_promedio', 'minutos_espera_prom', 'prom_espera', 'espera_prom'),
    espMax:      findNum('espera_max', 'max_espera', 'minutos_espera_max'),
  };
}

// ─── Cumulative helper ────────────────────────────────────────────────────────

function buildCumulative(rows: Array<{ hora: number; hora_label: string; camiones: number }>) {
  let acc = 0;
  return rows.map((r) => {
    acc += r.camiones;
    return { ...r, acumulado: acc };
  });
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface CanchonModalProps {
  open: boolean;
  onClose: () => void;
}

export function CanchonModal({ open, onClose }: CanchonModalProps) {
  const canchon = useCanchon();
  const balanza = useBalanzaHora();

  const resumen = (canchon.data?.data ?? null) as CanchonResumen | null;
  const kpis = extractCanchonKpis(resumen);

  const rawRows = (balanza.data?.data ?? [])
    .map((r) => ({
      hora_label: String(r.hora_label ?? ''),
      hora: Number(r.hora ?? 0),
      camiones: Number(r.camiones ?? 0),
    }))
    .sort((a, b) => a.hora - b.hora);

  const cumulativeRows = buildCumulative(rawRows);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <m.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative w-full max-w-[92vw] lg:max-w-4xl xl:max-w-5xl rounded-2xl overflow-hidden border-2 flex flex-col max-h-[90vh]"
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
              onClick={onClose}
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
                  color: 'var(--primary, #00D4FF)',
                }}
              >
                <IconTruck size={22} />
              </div>
              <div>
                <h2
                  className="text-xl sm:text-2xl font-bold tracking-tight leading-tight"
                  style={{ color: 'var(--text-primary, #F0F4FF)', fontFamily: 'var(--font-display)' }}
                >
                  Canchón — Camiones del día
                </h2>
                <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary, #A0B0C8)' }}>
                  Llegadas por hora · día corriente
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 sm:px-6 pb-6 overflow-y-auto flex-1 space-y-5">

              {/* KPI row */}
              <div className="flex flex-wrap gap-3">
                <KpiTile
                  label="Total camiones"
                  value={numOrDash(kpis.total)}
                  sub="en el día"
                  color="#00D4FF"
                  icon={<IconTruck size={13} />}
                />
                {kpis.esperando != null && (
                  <KpiTile
                    label="Esperando balanza"
                    value={numOrDash(kpis.esperando)}
                    sub="en este momento"
                    color="#FFB800"
                    icon={<IconUsers size={13} />}
                  />
                )}
                {kpis.espPromedio != null && (
                  <KpiTile
                    label="Espera promedio"
                    value={`${numOrDash(kpis.espPromedio, 1)} min`}
                    sub="tiempo en canchón"
                    color="#00E5A0"
                    icon={<IconClock size={13} />}
                  />
                )}
                {kpis.espMax != null && (
                  <KpiTile
                    label="Espera máxima"
                    value={`${numOrDash(kpis.espMax, 1)} min`}
                    sub="máximo registrado"
                    color="#FF6B35"
                    icon={<IconActivity size={13} />}
                  />
                )}
              </div>

              {/* Chart — llegada por hora */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: 'var(--primary-light, #00D4FF)' }}
                  >
                    Llegadas por hora
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--border, #1E3A5F)' }} />
                </div>
                <div
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--bg-card, #1A2236)', borderColor: 'var(--border, #1E3A5F)' }}
                >
                  {balanza.isLoading ? (
                    <div className="h-52 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
                      Cargando…
                    </div>
                  ) : rawRows.length === 0 ? (
                    <div className="h-52 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
                      Sin registros para el día corriente
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={rawRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="bar-cyan-modal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#00D4FF" stopOpacity={0.4} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="hora_label"
                          tick={{ fontSize: 10, fill: 'var(--text-muted, #6B7A9E)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'var(--text-muted, #6B7A9E)' }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={(props) => (
                            <GlassTip
                              active={props.active}
                              payload={props.payload as unknown as TooltipEntry[] | undefined}
                              label={props.label as string | undefined}
                            />
                          )}
                          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        />
                        <Bar
                          dataKey="camiones"
                          name="camiones"
                          fill="url(#bar-cyan-modal)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={32}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Chart — acumulado del día */}
              {cumulativeRows.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: 'var(--accent, #FF6B35)' }}
                    >
                      Acumulado del día
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border, #1E3A5F)' }} />
                  </div>
                  <div
                    className="rounded-xl border p-4"
                    style={{ background: 'var(--bg-card, #1A2236)', borderColor: 'var(--border, #1E3A5F)' }}
                  >
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={cumulativeRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="bar-orange-modal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.85} />
                            <stop offset="100%" stopColor="#FF6B35" stopOpacity={0.35} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="hora_label"
                          tick={{ fontSize: 10, fill: 'var(--text-muted, #6B7A9E)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'var(--text-muted, #6B7A9E)' }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={(props) => (
                            <GlassTip
                              active={props.active}
                              payload={props.payload as unknown as TooltipEntry[] | undefined}
                              label={props.label as string | undefined}
                            />
                          )}
                          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        />
                        <Bar
                          dataKey="acumulado"
                          name="acumulado"
                          fill="url(#bar-orange-modal)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={32}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
