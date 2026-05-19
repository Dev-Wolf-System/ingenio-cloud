'use client';

import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';

/**
 * Payload nuevo Node-RED:
 *   {
 *     turno, desde, hasta, cantidad_puntos,
 *     stats: { promedio_rpm, maximo_rpm, minimo_rpm },
 *     grafico: { labels[], velocidad_promedio[], velocidad_maxima[], velocidad_minima[] }
 *   }
 *
 * Compat: tolera legacy { promedio, maximo, minimo, labels, valores } por si
 * llega de cache viejo en shift_kpis_cache.
 */
export interface MillSpeedPayload {
  turno?: string;
  desde?: string;
  hasta?: string;
  cantidad_puntos?: number;
  // Nuevo
  stats?: {
    promedio_rpm?: number;
    maximo_rpm?: number;
    minimo_rpm?: number;
  };
  grafico?: {
    labels?: string[];
    velocidad_promedio?: number[];
    velocidad_maxima?: number[];
    velocidad_minima?: number[];
  };
  // Legacy
  promedio?: number;
  maximo?: number;
  minimo?: number;
  labels?: string[];
  valores?: number[];
}

export interface MillSpeedChartProps {
  data?: MillSpeedPayload | null;
  className?: string;
  height?: number;
}

export function MillSpeedChart({ data, className, height = 140 }: MillSpeedChartProps) {
  // Stats — prioriza formato nuevo
  const promedio = data?.stats?.promedio_rpm ?? data?.promedio ?? 0;
  const maximo = data?.stats?.maximo_rpm ?? data?.maximo ?? 0;
  const minimo = data?.stats?.minimo_rpm ?? data?.minimo ?? 0;

  // Grafico — prioriza formato nuevo
  const labels = data?.grafico?.labels ?? data?.labels ?? [];
  const velProm = data?.grafico?.velocidad_promedio ?? data?.valores ?? [];
  const velMax = data?.grafico?.velocidad_maxima ?? [];
  const velMin = data?.grafico?.velocidad_minima ?? [];
  const hasBanda = velMax.length === labels.length && velMin.length === labels.length;

  const points = labels.map((label, i) => ({
    label,
    promedio: velProm[i] ?? 0,
    maximo: velMax[i] ?? velProm[i] ?? 0,
    minimo: velMin[i] ?? velProm[i] ?? 0,
    // Para el Area de banda recharts necesita un base y un delta
    rango: hasBanda ? (velMax[i] ?? 0) - (velMin[i] ?? 0) : 0,
    rangoBase: hasBanda ? velMin[i] ?? 0 : 0,
  }));

  return (
    <div className={cn('rounded-md border border-border bg-bg-card p-3', className)}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <div>
          <div className="text-2xs uppercase tracking-wide text-text-muted">
            Vel. primer molino · {data?.turno ?? '—'}
          </div>
          {data?.desde && data?.hasta && (
            <div className="text-2xs text-text-disabled mono">
              {data.desde} → {data.hasta}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-2xs mono text-text-muted">
          <span>
            min <b className="text-text-secondary">{formatNumber(minimo, 1)}</b>
          </span>
          <span>
            prom <b className="text-primary-light">{formatNumber(promedio, 1)}</b>
          </span>
          <span>
            max <b className="text-text-secondary">{formatNumber(maximo, 1)}</b>
          </span>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="h-[100px] flex items-center justify-center text-xs text-text-muted">
          Sin datos del turno anterior
        </div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mill-prom" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-light)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--primary-light)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="mill-band" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-light)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--primary-light)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                minTickGap={32}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--text-muted)' }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    promedio: 'Promedio',
                    maximo: 'Máximo',
                    minimo: 'Mínimo',
                  };
                  return [`${formatNumber(value, 2)} rpm`, labels[name] ?? name];
                }}
              />

              {/* Banda min-max (solo si hay datos) */}
              {hasBanda && (
                <>
                  {/* Base invisible: nivel min */}
                  <Area
                    type="monotone"
                    dataKey="rangoBase"
                    stackId="band"
                    stroke="transparent"
                    fill="transparent"
                    isAnimationActive={false}
                  />
                  {/* Delta visible: max - min */}
                  <Area
                    type="monotone"
                    dataKey="rango"
                    stackId="band"
                    stroke="transparent"
                    fill="url(#mill-band)"
                    isAnimationActive={false}
                  />
                </>
              )}

              {/* Línea promedio principal */}
              <Area
                type="monotone"
                dataKey="promedio"
                stroke="var(--primary-light)"
                strokeWidth={1.8}
                fill="url(#mill-prom)"
                isAnimationActive={false}
              />

              {/* Líneas min y max sutiles (solo si hay banda) */}
              {hasBanda && (
                <>
                  <Line
                    type="monotone"
                    dataKey="maximo"
                    stroke="var(--text-muted)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="minimo"
                    stroke="var(--text-muted)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
