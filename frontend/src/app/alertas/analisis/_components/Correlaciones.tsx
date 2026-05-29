'use client';

import { IconArrowsExchange } from '@tabler/icons-react';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import type { AnalisisResponse } from '../_types';
import { C } from './chart-kit';

export function Correlaciones({
  correlaciones,
}: {
  correlaciones: AnalisisResponse['correlaciones'];
}) {
  const isEmpty = correlaciones.length === 0;

  return (
    <PremiumPanel
      title="Correlaciones"
      subtitle="Alertas que disparan juntas"
      icon={<IconArrowsExchange size={17} className="text-primary-light" />}
      accent="accent"
    >
      {isEmpty ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-10"
          style={{ color: C.muted }}
        >
          <IconArrowsExchange size={28} className="opacity-25" />
          <p className="text-xs">Sin correlaciones detectadas en este período</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {correlaciones.map((c, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5"
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Sensors */}
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-xs font-semibold truncate"
                  style={{ color: '#D0D8F0', maxWidth: 140 }}
                >
                  {c.a}
                </span>
                <IconArrowsExchange size={13} style={{ color: C.muted, flexShrink: 0 }} />
                <span
                  className="text-xs font-semibold truncate"
                  style={{ color: '#D0D8F0', maxWidth: 140 }}
                >
                  {c.b}
                </span>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(0,212,255,0.12)',
                    border: '1px solid rgba(0,212,255,0.30)',
                    color: C.cyan,
                  }}
                >
                  {c.juntas}x
                </span>
                <span
                  className="text-[10px] tabular-nums px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(107,122,158,0.12)',
                    border: `1px solid ${C.border}`,
                    color: C.muted,
                  }}
                >
                  ≤{c.ventana_min} min
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PremiumPanel>
  );
}
