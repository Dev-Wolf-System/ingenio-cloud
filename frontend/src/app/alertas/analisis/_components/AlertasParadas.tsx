'use client';

import { IconEngine, IconClockStop } from '@tabler/icons-react';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import type { AnalisisResponse } from '../_types';
import { C, sevColor, fmtMin } from './chart-kit';

function fmtOffset(min: number): string {
  if (min === 0) return '0 min';
  const sign = min < 0 ? '−' : '+';
  return `${sign}${Math.abs(min)} min`;
}

function offsetColor(min: number): string {
  if (min < 0) return C.amber;              // antes de la parada
  if (min === 0) return 'var(--text-muted)';
  return C.green;                           // después
}

export function AlertasParadas({
  paradas,
}: {
  paradas: AnalisisResponse['paradas'];
}) {
  const isEmpty = paradas.length === 0;

  return (
    <PremiumPanel
      title="Paradas con Alertas"
      subtitle="Eventos de parada y alertas relacionadas"
      icon={<IconClockStop size={17} className="text-primary-light" />}
      accent="warn"
    >
      {isEmpty ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-10 text-text-muted"
        >
          <IconClockStop size={28} className="opacity-25" />
          <p className="text-sm">Sin paradas registradas en este período</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {paradas.map((p, i) => {
            const hasAlerts = p.alertas_relacionadas.length > 0;
            const maxSev    = p.alertas_relacionadas.some((a) => a.severidad === 'critical')
              ? 'critical'
              : p.alertas_relacionadas.some((a) => a.severidad === 'warn')
              ? 'warn'
              : null;

            const borderColor = maxSev === 'critical'
              ? C.red
              : maxSev === 'warn'
              ? C.amber
              : 'var(--border)';

            return (
              <div
                key={i}
                className="rounded-xl p-4 flex flex-col gap-3"
                style={{
                  background: 'var(--bg-card)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${borderColor}`,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
                }}
              >
                {/* ── parada header ── */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className="text-base lg:text-lg font-bold truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {p.motivo}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.maquina && (
                        <span className="text-xs lg:text-sm" style={{ color: 'var(--text-muted)' }}>
                          <IconEngine size={11} className="inline mr-0.5" />
                          {p.maquina}
                        </span>
                      )}
                      {p.origen && (
                        <span className="text-xs lg:text-sm" style={{ color: 'var(--text-muted)' }}>
                          · {p.origen}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* duration badge */}
                  {p.minutos !== null && (
                    <span
                      className="shrink-0 text-xs font-bold tabular-nums px-2.5 py-1 rounded-full"
                      style={{
                        background: 'rgba(255,184,0,0.12)',
                        border: '1px solid rgba(255,184,0,0.30)',
                        color: C.amber,
                      }}
                    >
                      {fmtMin(p.minutos)}
                    </span>
                  )}
                </div>

                {/* ── alertas relacionadas ── */}
                {hasAlerts ? (
                  <div className="flex flex-wrap gap-1.5">
                    {p.alertas_relacionadas.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1 text-xs lg:text-sm px-2.5 py-1 rounded-full"
                        style={{
                          background: `${sevColor(a.severidad)}12`,
                          border: `1px solid ${sevColor(a.severidad)}30`,
                          color: 'var(--text-primary)',
                        }}
                        title={`${a.titulo} — ${fmtOffset(a.offset_min)}`}
                      >
                        {/* severity dot */}
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: sevColor(a.severidad) }}
                        />
                        <span className="truncate max-w-[120px]">{a.titulo}</span>
                        <span
                          className="shrink-0 font-bold tabular-nums"
                          style={{ color: offsetColor(a.offset_min) }}
                        >
                          {fmtOffset(a.offset_min)}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">
                    Sin alertas asociadas
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PremiumPanel>
  );
}
