'use client';

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import { useBalanzaHora } from '../_hooks/useMoliendaCloud';

function GlassTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '8px 12px',
        backdropFilter: 'blur(12px)',
        minWidth: 140,
      }}
    >
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color, fontSize: 13, fontWeight: 600 }}>
          {entry.name === 'camiones' ? '🚛 Camiones' : '🌿 Caña (t)'}:{' '}
          <span style={{ color: 'var(--text-primary)' }}>
            {entry.name === 'cana_molida_t'
              ? `${Number(entry.value ?? 0).toFixed(1)} t`
              : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export function CanchonHoraChart() {
  const { data: res, isLoading } = useBalanzaHora();

  const rows = (res?.data ?? [])
    .map((r) => ({
      hora_label: String(r.hora_label ?? ''),
      hora: Number(r.hora ?? 0),
      camiones: Number(r.camiones ?? 0),
      cana_molida_t: Number(r.cana_molida_kg ?? 0) / 1000,
    }))
    .sort((a, b) => a.hora - b.hora);

  return (
    <PremiumPanel
      title="LLEGADA DE CAMIONES · HORA × HORA"
      subtitle="Canchón · día corriente"
      accent="primary"
    >
      {isLoading ? (
        <div
          className="flex items-center justify-center py-10 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Cargando…
        </div>
      ) : rows.length === 0 ? (
        <div
          className="flex items-center justify-center py-10 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Sin registros para el día corriente
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="bar-cyan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#00D4FF" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="hora_label"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              width={30}
              allowDecimals={false}
            />
            <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar
              yAxisId="left"
              dataKey="camiones"
              name="camiones"
              fill="url(#bar-cyan)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </PremiumPanel>
  );
}
