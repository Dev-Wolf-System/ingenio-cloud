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
          className="flex flex-col items-center justify-center gap-2 py-10 text-text-muted"
        >
          <IconArrowsExchange size={28} className="opacity-25" />
          <p className="text-sm">Sin correlaciones detectadas en este período</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {correlaciones.map((c, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Sensors */}
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-sm lg:text-base font-semibold truncate text-text-primary"
                  style={{ maxWidth: 140 }}
                >
                  {c.a}
                </span>
                <IconArrowsExchange size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span
                  className="text-sm lg:text-base font-semibold truncate text-text-primary"
                  style={{ maxWidth: 140 }}
                >
                  {c.b}
                </span>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-xs lg:text-sm font-bold tabular-nums px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(0,212,255,0.12)',
                    border: '1px solid rgba(0,212,255,0.30)',
                    color: C.cyan,
                  }}
                >
                  {c.juntas}x
                </span>
                <span
                  className="text-xs lg:text-sm tabular-nums px-2 py-0.5 rounded-full"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
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
