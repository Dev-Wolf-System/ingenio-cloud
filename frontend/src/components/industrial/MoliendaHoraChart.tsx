'use client';

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
import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';

export interface MoliendaHoraPayload {
  turno?: string | null;
  tendencia_pct?: number;
  stats?: {
    promedio?: number;
    maximo?: number;
    minimo?: number;
    periodo_max?: string | null;
    periodo_min?: string | null;
  } | null;
  puntos?: Array<{
    periodo: string;
    molienda_t: number | null;
    media_movil: number | null;
  }>;
  stale?: boolean;
}

export interface MoliendaHoraChartProps {
  data?: MoliendaHoraPayload | null;
  className?: string;
  height?: number;
}

export function MoliendaHoraChart({ data, className, height = 160 }: MoliendaHoraChartProps) {
  const turno = data?.turno ?? '—';
  const promedio = data?.stats?.promedio ?? 0;
  const maximo = data?.stats?.maximo ?? 0;
  const minimo = data?.stats?.minimo ?? 0;
  const periodoMax = data?.stats?.periodo_max ?? null;
  const periodoMin = data?.stats?.periodo_min ?? null;
  const tendencia = data?.tendencia_pct ?? 0;

  const puntos = data?.puntos ?? [];
  const conData = puntos.some((p) => p.molienda_t != null);

  const trendIcon =
    tendencia > 2 ? <IconTrendingUp size={12} /> : tendencia < -2 ? <IconTrendingDown size={12} /> : <IconMinus size={12} />;
  const trendColor =
    tendencia > 2 ? 'var(--ok)' : tendencia < -2 ? 'var(--danger)' : 'var(--text-muted)';
  const trendLabel =
    tendencia > 2 ? `+${tendencia}%` : tendencia < -2 ? `${tendencia}%` : 'estable';

  return (
    <div className={cn('rounded-md border border-border bg-bg-card p-3', className)}>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <div>
          <div className="text-2xs uppercase tracking-wide text-text-muted">
            Molienda hora × hora · {turno}
          </div>
          <div className="text-2xs text-text-disabled mono">Turno anterior</div>
        </div>
        <div className="flex items-center gap-3 text-2xs mono text-text-muted">
          <span>min <b className="text-warn">{formatNumber(minimo, 1)}</b></span>
          <span>prom <b className="text-primary-light">{formatNumber(promedio, 1)}</b></span>
          <span>max <b className="text-ok">{formatNumber(maximo, 1)}</b></span>
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded"
            style={{ color: trendColor, background: 'var(--bg-hover)' }}
          >
            {trendIcon}
            {trendLabel}
          </span>
        </div>
      </div>

      {/* Sub-línea pico/valle */}
      {conData && (periodoMax || periodoMin) && (
        <div className="text-[10px] text-text-disabled mono mb-2">
          {periodoMax && (
            <span className="text-ok">▲ Pico {formatNumber(maximo, 1)} t · {periodoMax}</span>
          )}
          {periodoMax && periodoMin && <span className="mx-2">·</span>}
          {periodoMin && (
            <span className="text-warn">▼ Valle {formatNumber(minimo, 1)} t · {periodoMin}</span>
          )}
        </div>
      )}

      {!conData ? (
        <div className="h-[120px] flex items-center justify-center text-xs text-text-muted">
          Sin datos de molienda del turno anterior
        </div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={puntos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mol-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-light)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="periodo"
                tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={44}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={38}
                unit=" t"
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
                  if (value == null) return ['—', name === 'media_movil' ? 'Tendencia' : 'Molienda'];
                  const lbl = name === 'media_movil' ? 'Tendencia' : 'Molienda';
                  return [`${formatNumber(Number(value), 2)} t`, lbl];
                }}
              />
              {/* Promedio referencia */}
              <ReferenceLine
                y={promedio}
                stroke="var(--accent)"
                strokeDasharray="4 3"
                strokeWidth={1.2}
              />
              {/* Barras volumen — verde pico, ámbar valle */}
              <Bar dataKey="molienda_t" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {puntos.map((p, i) => (
                  <Cell
                    key={i}
                    fill={
                      p.molienda_t == null
                        ? 'transparent'
                        : p.molienda_t >= maximo
                        ? 'var(--ok)'
                        : p.molienda_t <= minimo
                        ? 'var(--warn)'
                        : 'url(#mol-bar)'
                    }
                  />
                ))}
              </Bar>
              {/* Línea tendencia (media móvil 3h) */}
              <Line
                type="monotone"
                dataKey="media_movil"
                stroke="var(--primary-light)"
                strokeWidth={2}
                dot={{ r: 2.5, fill: 'var(--primary-light)' }}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
