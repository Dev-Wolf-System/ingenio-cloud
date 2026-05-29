'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { IconChartBar } from '@tabler/icons-react';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import type { AnalisisResponse } from '../_types';
import { C, GlassTooltip } from './chart-kit';

const TURNO_COLOR: Record<string, string> = {
  'Mañana': C.amber,
  'Tarde':  C.cyan,
  'Noche':  '#6366F1',
};

export function ComparativaTurnos({
  porTurno,
  comparativa,
}: {
  porTurno: AnalisisResponse['series']['por_turno'];
  comparativa: AnalisisResponse['comparativa'];
}) {
  const data = porTurno.map((t) => ({
    name:  t.turno,
    n:     t.n,
    fill:  TURNO_COLOR[t.turno] ?? C.muted,
  }));

  const isEmpty = data.every((d) => d.n === 0);

  const prevTotal = comparativa?.total_prev;

  return (
    <PremiumPanel
      title="Alertas por Turno"
      subtitle={
        prevTotal !== null && prevTotal !== undefined
          ? `Período anterior: ${prevTotal} en total`
          : 'Distribución por turno operativo'
      }
      icon={<IconChartBar size={17} className="text-primary-light" />}
      accent="primary"
    >
      {isEmpty ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-10"
          style={{ color: C.muted }}
        >
          <IconChartBar size={28} className="opacity-25" />
          <p className="text-xs">Sin alertas en este período</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: C.muted }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: C.muted }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={<GlassTooltip />}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="n" name="Alertas" radius={[6, 6, 0, 0]} maxBarSize={72}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </PremiumPanel>
  );
}
