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
  IconScale,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
} from '@tabler/icons-react';
import { formatNumber } from '@/lib/utils/format';

export interface BloquePunto {
  label: string;
  molienda_t: number | null;
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

export interface MoliendaBloquesPayload {
  anio_zafra?: number | null;
  zafra?: BloqueSerie;
  dia_corriente?: BloqueSerie;
  turno_actual?: BloqueSerie;
  dia_anterior?: BloqueSerie;
  turno_anterior?: BloqueSerie;
}

export interface MoliendaEstadoModalProps {
  open: boolean;
  onClose: () => void;
  data?: MoliendaBloquesPayload | null;
  loading?: boolean;
}

const EMPTY: BloqueSerie = {
  puntos: [],
  stats: { acumulado_t: 0, max_t: 0, min_t: 0, promedio_t: 0, tendencia_pct: 0 },
};

export function MoliendaEstadoModal({ open, onClose, data, loading }: MoliendaEstadoModalProps) {
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
            className="relative w-full max-w-3xl rounded-2xl overflow-hidden border-2 flex flex-col max-h-[88vh]"
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
              style={{ background: 'linear-gradient(90deg, var(--primary), var(--accent))' }}
            />

            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary z-10"
              aria-label="Cerrar"
            >
              <IconX size={16} />
            </button>

            {/* Header */}
            <div className="p-6 pb-3 shrink-0 flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                style={{
                  background: 'var(--primary-soft)',
                  borderColor: 'var(--primary)',
                  color: 'var(--primary-light)',
                }}
              >
                <IconScale size={22} />
              </div>
              <div>
                <h2
                  className="text-xl sm:text-2xl font-bold tracking-tight leading-tight text-text-primary"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Estado de molienda
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Zafra, día y turno · corriente y anterior
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-5">
              {loading ? (
                <div className="py-16 text-center text-sm text-text-muted">
                  Cargando datos de molienda…
                </div>
              ) : (
                <>
                  <Seccion titulo={`Zafra ${anio}`}>
                    <BloqueChart
                      subtitulo="Molienda por día"
                      serie={data?.zafra ?? EMPTY}
                      showTrend
                    />
                  </Seccion>

                  <Seccion titulo="Molienda en curso">
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

                  <Seccion titulo="Molienda anterior">
                    <BloqueChart
                      subtitulo="Día anterior"
                      serie={data?.dia_anterior ?? EMPTY}
                    />
                    <BloqueChart
                      subtitulo="Turno anterior"
                      serie={data?.turno_anterior ?? EMPTY}
                    />
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
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--primary-light)' }}
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

  const trendIcon =
    tend > 2 ? <IconTrendingUp size={12} /> : tend < -2 ? <IconTrendingDown size={12} /> : <IconMinus size={12} />;
  const trendColor = tend > 2 ? 'var(--ok)' : tend < -2 ? 'var(--danger)' : 'var(--text-muted)';
  const trendLabel = tend > 2 ? `+${tend}%` : tend < -2 ? `${tend}%` : 'estable';

  return (
    <div className="rounded-xl border border-border bg-bg-card p-3">
      <div className="flex items-baseline justify-between mb-1.5 flex-wrap gap-2">
        <div className="text-2xs uppercase tracking-wide text-text-muted font-semibold">
          {subtitulo}
        </div>
        <div className="flex items-center gap-2.5 text-2xs mono text-text-muted">
          <span>min <b className="text-warn">{formatNumber(stats.min_t, 0)}</b></span>
          <span>prom <b className="text-primary-light">{formatNumber(stats.promedio_t, 0)}</b></span>
          <span>max <b className="text-ok">{formatNumber(stats.max_t, 0)}</b></span>
          <span>acum <b className="text-text-primary">{formatNumber(stats.acumulado_t, 0)} t</b></span>
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
                <linearGradient id={`mb-bar-${subtitulo}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-light)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={42}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={36}
                unit=" t"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 9, fill: 'var(--accent)' }}
                axisLine={false}
                tickLine={false}
                width={42}
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
                  const lbl =
                    name === 'acumulado_t'
                      ? 'Acumulado'
                      : name === 'tendencia_t'
                      ? 'Tendencia'
                      : 'Molienda';
                  return [`${formatNumber(Number(value), 1)} t`, lbl];
                }}
              />
              <ReferenceLine
                yAxisId="left"
                y={stats.promedio_t}
                stroke="var(--accent)"
                strokeDasharray="4 3"
                strokeWidth={1}
              />
              <Bar
                yAxisId="left"
                dataKey="molienda_t"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {puntos.map((p, i) => (
                  <Cell
                    key={i}
                    fill={
                      p.molienda_t == null
                        ? 'transparent'
                        : p.molienda_t >= stats.max_t
                        ? 'var(--ok)'
                        : p.molienda_t <= stats.min_t
                        ? 'var(--warn)'
                        : `url(#mb-bar-${subtitulo})`
                    }
                  />
                ))}
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="acumulado_t"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {showTrend && (
                <Line
                  yAxisId="left"
                  type="linear"
                  dataKey="tendencia_t"
                  stroke="var(--primary-light)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  connectNulls
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
