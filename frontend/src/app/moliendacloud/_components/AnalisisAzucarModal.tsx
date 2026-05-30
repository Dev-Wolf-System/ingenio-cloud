'use client';

import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { IconX, IconFlask, IconClock } from '@tabler/icons-react';
import { formatNumber } from '@/lib/utils/format';
import { useLab } from '../_hooks/useMoliendaCloud';
import type { LabRow } from '../_types';

const PROCESOS_AZUCAR = ['Azúcar de 3era'];

function avg(rows: LabRow[], pick: (r: LabRow) => number | null): number | null {
  const vals = rows.map(pick).filter((v): v is number => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function sum(rows: LabRow[], pick: (r: LabRow) => number | null): number | null {
  const vals = rows.map(pick).filter((v): v is number => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0);
}

function brix(r: LabRow): number | null {
  return r.brix_automatico ?? r.brix_manual;
}
function pol(r: LabRow): number | null {
  return r.pol_automatico ?? r.pol_manual;
}

function Pill({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-semibold border transition-colors"
      style={{
        background: active ? 'var(--primary)' : 'var(--bg-card)',
        borderColor: active ? 'var(--primary)' : 'var(--border)',
        color: active ? 'var(--bg-base)' : 'var(--text-muted)',
      }}
    >
      {children}
    </button>
  );
}

const PRESETS = [
  { label: 'Todo el día', desde: '', hasta: '' },
  { label: 'Turno 1 (05–13)', desde: '05:00', hasta: '13:00' },
  { label: 'Turno 2 (13–21)', desde: '13:00', hasta: '21:00' },
  { label: 'Turno 3 (21–05)', desde: '21:00', hasta: '05:00' },
];

export function AnalisisAzucarModal() {
  const [open, setOpen] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [activePreset, setActivePreset] = useState(0);

  const { data: res, isLoading } = useLab(PROCESOS_AZUCAR, desde || undefined, hasta || undefined);
  const rows = res?.data ?? [];

  function applyPreset(idx: number) {
    setActivePreset(idx);
    const p = PRESETS[idx];
    setDesde(p.desde);
    setHasta(p.hasta);
  }

  const avgBrix = avg(rows, brix);
  const avgPol = avg(rows, pol);
  const avgPureza = avg(rows, (r) => r.pureza);
  const totalKilos = sum(rows, (r) => r.kilos);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:brightness-110"
        style={{
          borderColor: 'var(--primary)',
          color: 'var(--primary-light)',
          background: 'var(--primary-soft, rgba(0,212,255,0.08))',
        }}
      >
        <IconFlask size={15} />
        Análisis de Azúcar
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
              className="relative w-full max-w-3xl rounded-2xl overflow-hidden border-2 flex flex-col max-h-[90vh]"
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
                style={{ background: 'linear-gradient(90deg, var(--primary), var(--accent))' }}
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
                    background: 'var(--primary-soft, rgba(0,212,255,0.08))',
                    borderColor: 'var(--primary)',
                    color: 'var(--primary-light)',
                  }}
                >
                  <IconFlask size={22} />
                </div>
                <div>
                  <h2
                    className="text-xl sm:text-2xl font-bold tracking-tight leading-tight text-text-primary"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Análisis de Azúcar
                  </h2>
                  <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
                    Lecturas de laboratorio ·{' '}
                    <span className="opacity-60">procesos a confirmar</span>
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-4">
                {/* Horario selector */}
                <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border-subtle, #1E3A5F)', background: 'var(--bg-card, #1A2236)' }}>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    <IconClock size={13} />
                    Rango horario
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((p, i) => (
                      <Pill key={p.label} active={activePreset === i} onClick={() => applyPreset(i)}>
                        {p.label}
                      </Pill>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-2 text-xs text-text-muted">
                      Desde
                      <input
                        type="time"
                        value={desde}
                        onChange={(e) => { setDesde(e.target.value); setActivePreset(-1); }}
                        className="rounded-md px-2 py-1 text-xs border"
                        style={{
                          background: 'var(--bg-base, #0A0E1A)',
                          borderColor: 'var(--border, #1E3A5F)',
                          color: 'var(--text-primary, #F0F4FF)',
                          colorScheme: 'dark',
                        }}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-text-muted">
                      Hasta
                      <input
                        type="time"
                        value={hasta}
                        onChange={(e) => { setHasta(e.target.value); setActivePreset(-1); }}
                        className="rounded-md px-2 py-1 text-xs border"
                        style={{
                          background: 'var(--bg-base, #0A0E1A)',
                          borderColor: 'var(--border, #1E3A5F)',
                          color: 'var(--text-primary, #F0F4FF)',
                          colorScheme: 'dark',
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Summary row */}
                {!isLoading && rows.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Brix prom', value: avgBrix != null ? formatNumber(avgBrix, 2) : '—', unit: '°' },
                      { label: 'Pol prom', value: avgPol != null ? formatNumber(avgPol, 2) : '—', unit: '°' },
                      { label: 'Pureza prom', value: avgPureza != null ? formatNumber(avgPureza, 1) : '—', unit: '%' },
                      { label: 'Kilos total', value: totalKilos != null ? formatNumber(totalKilos, 0) : '—', unit: 'kg' },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-xl p-3 border text-center"
                        style={{ background: 'var(--bg-card, #1A2236)', borderColor: 'var(--border-subtle, #1E3A5F)' }}
                      >
                        <p className="text-xs text-text-muted mb-1">{s.label}</p>
                        <p className="tabular-nums text-lg font-bold" style={{ color: 'var(--primary-light, #00D4FF)' }}>
                          {s.value}
                          <span className="text-xs font-normal text-text-muted ml-0.5">{s.unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Table */}
                {isLoading ? (
                  <div className="py-16 text-center text-sm text-text-muted">Cargando lecturas…</div>
                ) : rows.length === 0 ? (
                  <div className="py-16 text-center text-sm text-text-muted">Sin lecturas para el rango seleccionado.</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle, #1E3A5F)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--bg-card, #1A2236)', borderBottom: '1px solid var(--border-subtle, #1E3A5F)' }}>
                          {['Hora', 'Brix', 'Pol', 'Pureza', 'Kilos'].map((h) => (
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
                        {rows.map((r, i) => {
                          const b = brix(r);
                          const p = pol(r);
                          return (
                            <tr
                              key={i}
                              style={{
                                borderBottom: '1px solid var(--border-subtle, #1E3A5F)',
                                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                              }}
                            >
                              <td className="px-4 py-2.5 tabular-nums text-text-secondary font-medium">
                                {r.hora_lectura ?? '—'}
                              </td>
                              <td className="px-4 py-2.5 tabular-nums text-text-primary">
                                {b != null ? formatNumber(b, 2) : '—'}
                              </td>
                              <td className="px-4 py-2.5 tabular-nums text-text-primary">
                                {p != null ? formatNumber(p, 2) : '—'}
                              </td>
                              <td className="px-4 py-2.5 tabular-nums text-text-primary">
                                {r.pureza != null ? formatNumber(r.pureza, 1) : '—'}
                              </td>
                              <td className="px-4 py-2.5 tabular-nums text-text-primary">
                                {r.kilos != null ? formatNumber(r.kilos, 0) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
