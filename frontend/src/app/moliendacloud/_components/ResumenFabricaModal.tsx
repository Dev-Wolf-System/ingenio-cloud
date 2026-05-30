'use client';

import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { IconX, IconBuildingFactory2 } from '@tabler/icons-react';
import { formatNumber } from '@/lib/utils/format';
import { useLab } from '../_hooks/useMoliendaCloud';
import type { LabRow } from '../_types';

const PROCESOS_FABRICA = ['Jugo Mixto', 'Clarificado', 'Melado', 'Jarabe Clarificado'];

function avg(vals: (number | null)[]): number | null {
  const filtered = vals.filter((v): v is number => v != null);
  if (!filtered.length) return null;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

function brix(r: LabRow): number | null {
  return r.brix_automatico ?? r.brix_manual;
}
function pol(r: LabRow): number | null {
  return r.pol_automatico ?? r.pol_manual;
}

interface ProcesoStats {
  proceso: string;
  avgBrix: number | null;
  avgPol: number | null;
  avgPureza: number | null;
  count: number;
}

function buildStats(rows: LabRow[]): ProcesoStats[] {
  const map: Record<string, LabRow[]> = {};
  rows.forEach((r) => {
    if (!map[r.proceso_codigo]) map[r.proceso_codigo] = [];
    map[r.proceso_codigo].push(r);
  });
  return Array.from(Object.entries(map)).map(([proceso, rs]) => ({
    proceso,
    avgBrix: avg(rs.map(brix)),
    avgPol: avg(rs.map(pol)),
    avgPureza: avg(rs.map((r) => r.pureza)),
    count: rs.length,
  }));
}

const PROCESO_ORDER: Record<string, number> = {
  'Jugo Mixto': 0,
  'Clarificado': 1,
  'Melado': 2,
  'Jarabe Clarificado': 3,
};

function MetricCell({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">{label}</p>
      <p className="tabular-nums text-sm font-semibold text-text-primary">
        {value != null ? formatNumber(value, 2) : '—'}
        <span className="text-xs font-normal text-text-muted ml-0.5">{unit}</span>
      </p>
    </div>
  );
}

export function ResumenFabricaModal() {
  const [open, setOpen] = useState(false);

  const { data: res, isLoading } = useLab(PROCESOS_FABRICA);
  const rows = res?.data ?? [];

  const stats = buildStats(rows).sort(
    (a, b) => (PROCESO_ORDER[a.proceso] ?? 99) - (PROCESO_ORDER[b.proceso] ?? 99),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:brightness-110"
        style={{
          borderColor: 'var(--accent, #FF6B35)',
          color: 'var(--accent, #FF6B35)',
          background: 'rgba(255,107,53,0.08)',
        }}
      >
        <IconBuildingFactory2 size={15} />
        Resumen de Fábrica
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={() => setOpen(false)}
          >
            <m.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative w-full max-w-2xl rounded-2xl overflow-hidden border-2 flex flex-col max-h-[90vh]"
              style={{
                background:
                  'var(--panel-mesh-1, transparent), var(--panel-mesh-2, transparent), linear-gradient(135deg, var(--surface-panel-from, #111827), var(--surface-panel-to, #1A2236))',
                borderColor: 'var(--border-strong, #1E3A5F)',
                boxShadow: 'var(--panel-shadow, none), 0 40px 120px rgba(0,0,0,0.45)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top accent bar */}
              <div
                aria-hidden
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, var(--accent, #FF6B35), var(--primary, #00D4FF))' }}
              />

              {/* Close */}
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary z-10"
                aria-label="Cerrar"
              >
                <IconX size={16} />
              </button>

              {/* Header */}
              <div className="p-6 pb-3 shrink-0 flex items-center gap-3.5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    background: 'rgba(255,107,53,0.10)',
                    borderColor: 'var(--accent, #FF6B35)',
                    color: 'var(--accent, #FF6B35)',
                  }}
                >
                  <IconBuildingFactory2 size={22} />
                </div>
                <div>
                  <h2
                    className="text-xl sm:text-2xl font-bold tracking-tight leading-tight text-text-primary"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Resumen de Fábrica
                  </h2>
                  <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
                    Promedios de laboratorio por jugo · día industrial
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-3">
                {isLoading ? (
                  <div className="py-16 text-center text-sm text-text-muted">Cargando datos de laboratorio…</div>
                ) : stats.length === 0 ? (
                  <div className="py-16 text-center text-sm text-text-muted">Sin lecturas disponibles para hoy.</div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle, #1E3A5F)' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: 'var(--bg-card, #1A2236)', borderBottom: '1px solid var(--border-subtle, #1E3A5F)' }}>
                            {['Proceso', 'Brix', 'Pol', 'Pureza', 'Lecturas'].map((h) => (
                              <th
                                key={h}
                                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stats.map((s, i) => (
                            <tr
                              key={s.proceso}
                              style={{
                                borderBottom: '1px solid var(--border-subtle, #1E3A5F)',
                                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                              }}
                            >
                              <td className="px-4 py-3 font-semibold text-text-primary">{s.proceso}</td>
                              <td className="px-4 py-3 tabular-nums text-text-secondary">
                                {s.avgBrix != null ? formatNumber(s.avgBrix, 2) : '—'}
                              </td>
                              <td className="px-4 py-3 tabular-nums text-text-secondary">
                                {s.avgPol != null ? formatNumber(s.avgPol, 2) : '—'}
                              </td>
                              <td className="px-4 py-3 tabular-nums text-text-secondary">
                                {s.avgPureza != null ? formatNumber(s.avgPureza, 1) : '—'}
                              </td>
                              <td className="px-4 py-3 tabular-nums">
                                <span
                                  className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold"
                                  style={{ background: 'var(--primary-soft, rgba(0,212,255,0.1))', color: 'var(--primary-light, #00D4FF)' }}
                                >
                                  {s.count}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-3">
                      {stats.map((s) => (
                        <div
                          key={s.proceso}
                          className="rounded-xl border p-4"
                          style={{ background: 'var(--bg-card, #1A2236)', borderColor: 'var(--border-subtle, #1E3A5F)' }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-text-primary">{s.proceso}</span>
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'var(--primary-soft, rgba(0,212,255,0.1))', color: 'var(--primary-light, #00D4FF)' }}
                            >
                              {s.count} lecturas
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <MetricCell label="Brix" value={s.avgBrix} unit="°" />
                            <MetricCell label="Pol" value={s.avgPol} unit="°" />
                            <MetricCell label="Pureza" value={s.avgPureza} unit="%" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
