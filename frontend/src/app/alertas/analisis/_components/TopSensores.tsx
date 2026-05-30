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
import { IconRadar2 } from '@tabler/icons-react';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import type { AnalisisResponse } from '../_types';
import { C, fmtMin } from './chart-kit';

// top‐8, horizontal bar, color cycling
const BAR_COLORS = [C.red, C.amber, C.cyan, C.green, '#A89BFF', C.amber, C.red, C.muted];

export function TopSensores({
  sensores,
}: {
  sensores: AnalisisResponse['sensores'];
}) {
  const top8 = sensores.slice(0, 8).map((s) => ({
    name:  s.titulo.length > 28 ? s.titulo.slice(0, 26) + '…' : s.titulo,
    n:     s.n,
    mtbf:  s.mtbf_min,
    dur:   s.duracion_media_min,
  }));

  const isEmpty = top8.length === 0;

  return (
    <PremiumPanel
      title="Top Sensores"
      subtitle="Los 8 más frecuentes en el período"
      icon={<IconRadar2 size={17} className="text-primary-light" />}
      accent="warn"
    >
      {isEmpty ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-10"
          style={{ color: C.muted }}
        >
          <IconRadar2 size={28} className="opacity-25" />
          <p className="text-sm">Sin sensores registrados en este período</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(220, top8.length * 42)}>
          <BarChart
            layout="vertical"
            data={top8}
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: C.muted }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fontSize: 11, fill: C.muted }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={(props) => {
                if (!props.active || !props.payload?.length) return null;
                const d = props.payload[0].payload as typeof top8[number];
                return (
                  <div
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{
                      background: 'rgba(17,24,39,0.92)',
                      backdropFilter: 'blur(20px)',
                      border: `1px solid ${C.border}`,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}
                  >
                    <p className="font-semibold mb-1" style={{ color: '#F0F4FF' }}>
                      {props.label}
                    </p>
                    <p style={{ color: C.cyan }}>
                      Ocurrencias: <span className="font-bold tabular-nums">{d.n}</span>
                    </p>
                    <p style={{ color: C.amber }}>
                      MTBF: <span className="font-bold tabular-nums">{fmtMin(d.mtbf)}</span>
                    </p>
                    <p style={{ color: C.green }}>
                      Dur. media: <span className="font-bold tabular-nums">{fmtMin(d.dur)}</span>
                    </p>
                  </div>
                );
              }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="n" name="Ocurrencias" radius={[0, 5, 5, 0]} maxBarSize={22}>
              {top8.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </PremiumPanel>
  );
}
