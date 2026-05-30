'use client';

import { IconLayoutGrid } from '@tabler/icons-react';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import type { AnalisisResponse } from '../_types';
import { C } from './chart-kit';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function heatColor(intensity: number): string {
  if (intensity === 0) return 'rgba(255,255,255,0.03)';
  const alpha = 0.12 + intensity * 0.75;
  // cyan → red gradient by intensity
  const r = Math.round(255 * Math.min(1, intensity * 2));
  const g = Math.round(212 - 200 * intensity);
  const b = Math.round(255 * Math.max(0, 1 - intensity * 2));
  return `rgba(${r},${g},${b},${alpha})`;
}

export function Heatmap({
  heatmap,
}: {
  heatmap: AnalisisResponse['series']['heatmap'];
}) {
  // Build lookup dow → hora → n
  const lookup: Record<string, number> = {};
  heatmap.forEach((cell) => {
    lookup[`${cell.dow}-${cell.hora}`] = cell.n;
  });

  const allN = heatmap.map((c) => c.n);
  const maxN = allN.length > 0 ? Math.max(1, ...allN) : 1;

  const isEmpty = heatmap.length === 0 || maxN === 0;

  return (
    <PremiumPanel
      title="Densidad Horaria"
      subtitle="Alertas por hora y día de semana"
      icon={<IconLayoutGrid size={17} className="text-primary-light" />}
      accent="primary"
    >
      {isEmpty ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-10"
          style={{ color: C.muted }}
        >
          <IconLayoutGrid size={28} className="opacity-25" />
          <p className="text-sm">Sin datos para el mapa de calor</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Hour axis */}
          <div className="flex gap-[1px] mb-0.5 ml-8">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="flex-1 text-center"
                style={{ fontSize: 9, color: C.muted, minWidth: 14 }}
              >
                {h % 4 === 0 ? h : ''}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {DAYS.map((day, dayIdx) => (
            <div key={dayIdx} className="flex items-center gap-[1px] mb-[2px]">
              <span
                className="w-7 text-right pr-1 shrink-0"
                style={{ fontSize: 10, color: C.muted }}
              >
                {day}
              </span>
              {Array.from({ length: 24 }, (_, h) => {
                const n         = lookup[`${dayIdx}-${h}`] ?? 0;
                const intensity = n / maxN;
                return (
                  <div
                    key={h}
                    title={`${day} ${h}:00 · ${n} alerta${n !== 1 ? 's' : ''}`}
                    className="rounded-[2px] flex-1 cursor-default"
                    style={{
                      height: 18,
                      minWidth: 14,
                      background: heatColor(intensity),
                      border: n > 0 ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
                    }}
                  />
                );
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3">
            <span style={{ fontSize: 10, color: C.muted }}>Baja</span>
            <div className="flex gap-[2px]">
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v, i) => (
                <div
                  key={i}
                  className="rounded-[2px]"
                  style={{ width: 12, height: 8, background: heatColor(v) }}
                />
              ))}
            </div>
            <span style={{ fontSize: 8, color: C.muted }}>Alta</span>
          </div>
        </div>
      )}
    </PremiumPanel>
  );
}
