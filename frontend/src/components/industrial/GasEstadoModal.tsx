'use client';

import { AnimatePresence, m } from 'motion/react';
import {
  Bar,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  IconX,
  IconFlame,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
} from '@tabler/icons-react';
import { formatNumber } from '@/lib/utils/format';
import { BloquesKpiStats } from './BloquesKpiStats';

/**
 * Reusa shape BloqueSerie del backend: campo `molienda_t` semánticamente
 * representa m³ de gas en este contexto (mismo buildBloqueSerie del service).
 */
export interface BloquePunto {
  label: string;
  molienda_t: number | null; // = gas_m3 (mismo backend serializer)
  acumulado_t: number;
  tendencia_t: number | null;
}

export interface BloqueSerie {
  puntos: BloquePunto[];
  stats: {
    acumulado_t: number;
    max_t: number;
    min_t: number;
    promedio_t: number;
    tendencia_pct: number;
  };
}

export interface GasBloquesPayload {
  anio_zafra?: number | null;
  zafra?: BloqueSerie;
  dia_corriente?: BloqueSerie;
  turno_actual?: BloqueSerie;
  dia_anterior?: BloqueSerie;
  turno_anterior?: BloqueSerie;
}

export interface GasEstadoModalProps {
  open: boolean;
  onClose: () => void;
  data?: GasBloquesPayload | null;
  loading?: boolean;
}

const EMPTY: BloqueSerie = {
  puntos: [],
  stats: { acumulado_t: 0, max_t: 0, min_t: 0, promedio_t: 0, tendencia_pct: 0 },
};

export function GasEstadoModal({ open, onClose, data, loading }: GasEstadoModalProps) {
  const anio = data?.anio_zafra ?? new Date().getFullYear();

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
            className="relative w-full max-w-[90vw] rounded-2xl overflow-hidden border-2 flex flex-col max-h-[90vh]"
            style={{
              background:
                'var(--panel-mesh-1), var(--panel-mesh-2), linear-gradient(135deg, var(--surface-panel-from), var(--surface-panel-to))',
              borderColor: 'var(--border-strong)',
              boxShadow: 'var(--panel-shadow), 0 40px 120px rgba(0,0,0,0.45)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              aria-hidden
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: 'linear-gradient(90deg, var(--warn), var(--accent))' }}
            />

            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary z-10"
              aria-label="Cerrar"
            >
              <IconX size={16} />
            </button>

            <div className="p-6 pb-3 shrink-0 flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                style={{
                  background: 'var(--warn-soft)',
                  borderColor: 'var(--warn)',
                  color: 'var(--warn)',
                }}
              >
                <IconFlame size={22} />
              </div>
              <div>
                <h2
                  className="text-xl sm:text-2xl font-bold tracking-tight leading-tight text-text-primary"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Consumo de gas
                </h2>
                <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
                  Zafra, día y turno · corriente y anterior
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-5">
              {loading ? (
                <div className="py-16 text-center text-sm text-text-muted">
                  Cargando datos de gas…
                </div>
              ) : (
                <>
                  <BloquesKpiStats
                    zafra={data?.zafra}
                    turnoActual={data?.turno_actual}
                    diaCorriente={data?.dia_corriente}
                    unidad="m³"
                    modo="worst"
                    accentVar="var(--warn)"
                  />
                  <Seccion titulo={`Zafra ${anio}`}>
                    <BloqueChart
                      subtitulo="Gas por día"
                      serie={data?.zafra ?? EMPTY}
                      showTrend
                    />
                  </Seccion>

                  <Seccion titulo="Consumo en curso">
                    <BloqueChart
                      subtitulo="Día corriente · hora × hora"
                      serie={data?.dia_corriente ?? EMPTY}
                      showTrend
                    />
                    <BloqueChart
                      subtitulo="Turno actual"
                      serie={data?.turno_actual ?? EMPTY}
                      showTrend
                    />
                  </Seccion>

                  <Seccion titulo="Consumo anterior">
                    <BloqueChart subtitulo="Día anterior" serie={data?.dia_anterior ?? EMPTY} />
                    <BloqueChart subtitulo="Turno anterior" serie={data?.turno_anterior ?? EMPTY} />
                  </Seccion>
                </>
              )}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-sm sm:text-base font-bold uppercase tracking-wider"
          style={{ color: 'var(--warn)' }}
        >
          {titulo}
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function BloqueChart({
  subtitulo,
  serie,
  showTrend = false,
}: {
  subtitulo: string;
  serie: BloqueSerie;
  showTrend?: boolean;
}) {
  const { puntos, stats } = serie;
  const conData = puntos.some((p) => p.molienda_t != null);
  const tend = stats.tendencia_pct;
  const gradId = `gb-bar-${subtitulo.replace(/[^a-zA-Z0-9]/g, '')}`;

  const trendIcon =
    tend > 2 ? <IconTrendingUp size={12} /> : tend < -2 ? <IconTrendingDown size={12} /> : <IconMinus size={12} />;
  const trendColor = tend > 2 ? 'var(--danger)' : tend < -2 ? 'var(--ok)' : 'var(--text-muted)';
  const trendLabel = tend > 2 ? `+${tend}%` : tend < -2 ? `${tend}%` : 'estable';

  return (
    <div className="rounded-xl border border-border bg-bg-card p-3">
      <div className="flex items-baseline justify-between mb-1.5 flex-wrap gap-2">
        <div className="text-sm sm:text-base uppercase tracking-wide text-text-muted font-semibold">
          {subtitulo}
        </div>
        <div className="flex items-center gap-2.5 text-sm sm:text-base mono text-text-muted">
          <span>min <b className="text-ok">{formatNumber(stats.min_t, 0)}</b></span>
          <span>prom <b style={{ color: 'var(--warn)' }}>{formatNumber(stats.promedio_t, 0)}</b></span>
          <span>max <b className="text-danger">{formatNumber(stats.max_t, 0)}</b></span>
          <span>acum <b className="text-text-primary">{formatNumber(stats.acumulado_t, 0)} m³</b></span>
          {showTrend && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded"
              style={{ color: trendColor, background: 'var(--bg-hover)' }}
            >
              {trendIcon}
              {trendLabel}
            </span>
          )}
        </div>
      </div>

      {!conData ? (
        <div className="h-[120px] flex items-center justify-center text-xs text-text-muted">
          Sin datos disponibles
        </div>
      ) : (
        <div style={{ height: 168 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={puntos} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--warn)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="var(--warn)" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={42}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={42}
                unit=" m³"
              />
              <Tooltip
                cursor={{ fill: 'var(--bg-hover)', opacity: 0.4 }}
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--text-muted)' }}
                formatter={(value, name) => {
                  if (value == null) return ['—', name];
                  const lbl = name === 'tendencia_t' ? 'Tendencia' : name === 'acumulado_t' ? 'Acumulado' : 'Gas';
                  return [`${formatNumber(Number(value), 0)} m³`, lbl];
                }}
              />
              <ReferenceLine y={stats.promedio_t} yAxisId="left" stroke="var(--accent)" strokeDasharray="4 3" strokeWidth={1.2} />
              <Bar yAxisId="left" dataKey="molienda_t" fill="var(--warn)" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {puntos.map((p, i) => (
                  <Cell
                    key={i}
                    fill={
                      p.molienda_t == null
                        ? 'transparent'
                        : p.molienda_t >= stats.max_t * 0.95
                        ? 'var(--danger)'
                        : p.molienda_t <= stats.min_t * 1.05 && p.molienda_t > 0
                        ? 'var(--ok)'
                        : `url(#${gradId})`
                    }
                  />
                ))}
              </Bar>
              {showTrend && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="tendencia_t"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
