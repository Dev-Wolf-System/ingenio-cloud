'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';

export interface MillSpeedPayload {
  turno?: string;
  desde?: string;
  hasta?: string;
  cantidad_puntos?: number;
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

export function MillSpeedChart({ data, className, height = 120 }: MillSpeedChartProps) {
  const labels = data?.labels ?? [];
  const valores = data?.valores ?? [];
  const points = labels.map((label, i) => ({ label, value: valores[i] ?? 0 }));

  return (
    <div className={cn('rounded-md border border-border bg-bg-card p-3', className)}>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-2xs uppercase tracking-wide text-text-muted">Vel. primer molino · {data?.turno ?? '—'}</div>
          {data?.desde && data?.hasta && (
            <div className="text-2xs text-text-disabled mono">{data.desde} → {data.hasta}</div>
          )}
        </div>
        <div className="flex items-center gap-3 text-2xs mono text-text-muted">
          <span>min <b className="text-text-secondary">{formatNumber(data?.minimo ?? 0, 1)}</b></span>
          <span>prom <b className="text-primary-light">{formatNumber(data?.promedio ?? 0, 1)}</b></span>
          <span>max <b className="text-text-secondary">{formatNumber(data?.maximo ?? 0, 1)}</b></span>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="h-[100px] flex items-center justify-center text-xs text-text-muted">
          Sin datos del turno anterior
        </div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mill-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-light)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--primary-light)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--text-muted)' }}
                formatter={(v: number) => [formatNumber(v, 2) + ' rpm', 'velocidad']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--primary-light)"
                strokeWidth={1.5}
                fill="url(#mill-grad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
