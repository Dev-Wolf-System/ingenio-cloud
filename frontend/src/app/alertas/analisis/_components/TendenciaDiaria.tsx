'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { IconChartLine, IconInfoCircle } from '@tabler/icons-react';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import type { AnalisisResponse } from '../_types';
import { C, GlassTooltip } from './chart-kit';

export function TendenciaDiaria({
  porDia,
}: {
  porDia: AnalisisResponse['series']['por_dia'];
}) {
  const tooFew = porDia.length <= 1;

  // Format dia label: ISO date → DD/MM
  const data = porDia.map((d) => {
    const parts = d.dia.split('-');
    const label =
      parts.length === 3
        ? `${parts[2]}/${parts[1]}`
        : d.dia;
    return { date: label, n: d.n, dur: Math.round(d.duracion_media_min) };
  });

  return (
    <PremiumPanel
      title="Tendencia Diaria"
      subtitle="Cantidad de alertas por día"
      icon={<IconChartLine size={17} className="text-primary-light" />}
      accent="primary"
    >
      {tooFew ? (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-5 my-4"
          style={{
            background: 'rgba(0,212,255,0.06)',
            border: '1px solid rgba(0,212,255,0.18)',
          }}
        >
          <IconInfoCircle size={20} style={{ color: C.cyan }} className="shrink-0" />
          <p className="text-sm leading-relaxed" style={{ color: '#A8B8D0' }}>
            La tendencia diaria se ve mejor en período{' '}
            <span className="font-semibold" style={{ color: C.cyan }}>
              Zafra
            </span>
            . Seleccioná ese período para ver la evolución completa.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
            <defs>
              <linearGradient id="tendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.cyan} stopOpacity={0.35} />
                <stop offset="95%" stopColor={C.cyan} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: C.muted }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: C.muted }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={<GlassTooltip />}
              cursor={{ stroke: C.cyan, strokeWidth: 1, strokeDasharray: '4 2' }}
            />
            <Area
              type="monotone"
              dataKey="n"
              name="Alertas"
              stroke={C.cyan}
              strokeWidth={2}
              fill="url(#tendGrad)"
              dot={{ r: 3, fill: C.cyan, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </PremiumPanel>
  );
}
