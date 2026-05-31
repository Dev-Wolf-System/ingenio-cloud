'use client';

import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { IconX, IconFlask, IconClock, IconAlertTriangle } from '@tabler/icons-react';
import { useAzucar } from '../_hooks/useMoliendaCloud';
import type { EspRow } from '../_hooks/useMoliendaCloud';

// ─── Pivot config ────────────────────────────────────────────────────────────

const PARAMS: { label: string; key: keyof EspRow; dec: number }[] = [
  { label: 'COLOR (ICUMSA)', key: 'color_icumsa', dec: 0 },
  { label: 'TURBIDEZ',       key: 'turbidez',     dec: 2 },
  { label: 'HUMEDAD %',      key: 'humedad',      dec: 2 },
  { label: 'CENIZAS %',      key: 'cenizas',      dec: 2 },
  { label: 'SEDIMENTO',      key: 'sediment_test', dec: 2 },
  { label: 'SO2 (ppm)',      key: 'so2_ppm',      dec: 0 },
];

// proceso_codigo → column label
const TIPO_LABELS: Record<string, string> = {
  'Cinta Corta': 'C.CORTA',
  'Cinta Larga': 'C.LARGA',
  'Envases':     'EMBOLSADO',
};

const TIPO_ORDER = ['Cinta Corta', 'Cinta Larga', 'Envases', 'CRUDO'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number | null, dec: number): string {
  if (v == null) return '—';
  return v.toFixed(dec);
}

function avgField(rows: EspRow[], key: keyof EspRow): number | null {
  const vals: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i][key];
    if (typeof v === 'number') vals.push(v);
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Pivot: rows grouped by proceso_codigo, averaged per param. Returns Map<proceso, Record<param_key, avg>> */
function buildPivot(rows: EspRow[]): Map<string, Record<string, number | null>> {
  const groups: Record<string, EspRow[]> = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const key = r.proceso_codigo;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  const pivot: Map<string, Record<string, number | null>> = new Map();
  const entries = Object.entries(groups);
  for (let i = 0; i < entries.length; i++) {
    const [proc, procRows] = entries[i];
    const rec: Record<string, number | null> = {};
    for (let j = 0; j < PARAMS.length; j++) {
      rec[PARAMS[j].key as string] = avgField(procRows, PARAMS[j].key);
    }
    pivot.set(proc, rec);
  }
  return pivot;
}

/** Columns present in pivot + CRUDO always added (as empty) */
function buildColumns(pivot: Map<string, Record<string, number | null>>): string[] {
  const present = new Set<string>();
  const keys = Array.from(pivot.keys());
  for (let i = 0; i < keys.length; i++) {
    // Only include types we recognize as azucar types (not SILO / Soda_Cal)
    if (TIPO_ORDER.includes(keys[i]) || TIPO_LABELS[keys[i]]) present.add(keys[i]);
  }
  // Always include CRUDO column
  present.add('CRUDO');
  return TIPO_ORDER.filter((t) => present.has(t));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: 'var(--primary-light, #00D4FF)' }}
      >
        {title}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--border, #1E3A5F)' }} />
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
      {msg}
    </div>
  );
}

interface PivotTableProps {
  rows: EspRow[];
  loading: boolean;
  emptyMsg: string;
}

function PivotTable({ rows, loading, emptyMsg }: PivotTableProps) {
  if (loading) return <EmptyState msg="Cargando datos…" />;

  // Filter to azucar process types only
  const azucarRows = rows.filter(
    (r) => TIPO_ORDER.includes(r.proceso_codigo) || TIPO_LABELS[r.proceso_codigo] != null,
  );
  if (!azucarRows.length) return <EmptyState msg={emptyMsg} />;

  const pivot = buildPivot(azucarRows);
  const cols = buildColumns(pivot);

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border, #1E3A5F)' }}>
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr style={{ background: 'var(--bg-card, #1A2236)', borderBottom: '1px solid var(--border, #1E3A5F)' }}>
            <th
              className="px-4 py-2.5 lg:py-3 text-left text-xs lg:text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted, #6B7A9E)' }}
            >
              Parámetro
            </th>
            {cols.map((col) => (
              <th
                key={col}
                className="px-4 py-2.5 lg:py-3 text-right text-xs lg:text-sm font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted, #6B7A9E)' }}
              >
                {TIPO_LABELS[col] ?? col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PARAMS.map((param, pi) => {
            return (
              <tr
                key={param.key as string}
                style={{
                  borderBottom: '1px solid var(--border, #1E3A5F)',
                  background: pi % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                <td
                  className="px-4 py-2.5 lg:py-3 text-xs lg:text-sm font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary, #A0B0C8)' }}
                >
                  {param.label}
                </td>
                {cols.map((col) => {
                  const rec = pivot.get(col);
                  const val = rec ? (rec[param.key as string] as number | null) : null;
                  // CRUDO: always dashes
                  const isCrudo = col === 'CRUDO';
                  return (
                    <td
                      key={col}
                      className="px-4 py-2.5 lg:py-3 text-right tabular-nums font-mono lg:text-base"
                      style={{
                        color: isCrudo
                          ? 'var(--text-muted, #6B7A9E)'
                          : val != null
                          ? 'var(--text-primary, #F0F4FF)'
                          : 'var(--text-muted, #6B7A9E)',
                      }}
                    >
                      {isCrudo ? '—' : fmt(val, param.dec)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SilosTable({ rows, loading }: { rows: EspRow[]; loading: boolean }) {
  if (loading) return <EmptyState msg="Cargando datos de silos…" />;
  const siloRows = rows.filter((r) => r.proceso_codigo === 'SILO');
  if (!siloRows.length) return <EmptyState msg="Sin datos de silos para el período." />;

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border, #1E3A5F)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--bg-card, #1A2236)', borderBottom: '1px solid var(--border, #1E3A5F)' }}>
            {['Silo', 'Estado / Destino', 'Calidad'].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 lg:py-3 text-left text-xs lg:text-sm font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted, #6B7A9E)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {siloRows.map((r, i) => (
            <tr
              key={i}
              style={{
                borderBottom: '1px solid var(--border, #1E3A5F)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}
            >
              <td className="px-4 py-2.5 lg:py-3 font-semibold lg:text-base" style={{ color: 'var(--primary-light, #00D4FF)' }}>
                {r.silo ?? '—'}
              </td>
              <td className="px-4 py-2.5 lg:py-3 lg:text-base" style={{ color: 'var(--text-primary, #F0F4FF)' }}>
                {r.destino ?? '—'}
              </td>
              <td className="px-4 py-2.5 lg:py-3 tabular-nums lg:text-base" style={{ color: 'var(--text-primary, #F0F4FF)' }}>
                {r.calidad != null ? r.calidad.toFixed(2) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SodaCalTable({ rows, loading }: { rows: EspRow[]; loading: boolean }) {
  if (loading) return <EmptyState msg="Cargando datos de Cal/Soda…" />;
  const scRows = rows.filter((r) => r.proceso_codigo === 'Soda_Cal');
  if (!scRows.length) return <EmptyState msg="Sin datos de Cal/Soda para el período." />;

  // Collect non-null fields from all rows
  const fieldKeys: (keyof EspRow)[] = [
    'color_icumsa', 'turbidez', 'humedad', 'cenizas', 'sediment_test', 'so2_ppm',
    'granulometria_20', 'granulometria_30', 'calidad',
  ];
  const fieldLabels: Record<string, string> = {
    color_icumsa: 'Color (ICUMSA)',
    turbidez: 'Turbidez',
    humedad: 'Humedad %',
    cenizas: 'Cenizas %',
    sediment_test: 'Sedimento',
    so2_ppm: 'SO2 (ppm)',
    granulometria_20: 'Granulometría 20',
    granulometria_30: 'Granulometría 30',
    calidad: 'Calidad',
  };

  const presentFields = fieldKeys.filter((k) =>
    scRows.some((r) => r[k] != null),
  );

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border, #1E3A5F)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-card, #1A2236)', borderBottom: '1px solid var(--border, #1E3A5F)' }}>
              <th
                className="px-4 py-2.5 lg:py-3 text-left text-xs lg:text-sm font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted, #6B7A9E)' }}
              >
                Hora
              </th>
              {presentFields.map((k) => (
                <th
                  key={k as string}
                  className="px-4 py-2.5 lg:py-3 text-right text-xs lg:text-sm font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted, #6B7A9E)' }}
                >
                  {fieldLabels[k as string] ?? (k as string)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scRows.map((r, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: '1px solid var(--border, #1E3A5F)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                <td
                  className="px-4 py-2.5 tabular-nums font-medium"
                  style={{ color: 'var(--text-secondary, #A0B0C8)' }}
                >
                  {r.hora_lectura ?? '—'}
                </td>
                {presentFields.map((k) => {
                  const v = r[k];
                  return (
                    <td
                      key={k as string}
                      className="px-4 py-2.5 lg:py-3 text-right tabular-nums font-mono lg:text-base"
                      style={{ color: 'var(--text-primary, #F0F4FF)' }}
                    >
                      {typeof v === 'number' ? v.toFixed(2) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* ART note */}
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs border"
        style={{
          background: 'rgba(255,183,0,0.06)',
          borderColor: 'rgba(255,183,0,0.25)',
          color: 'var(--text-muted, #6B7A9E)',
        }}
      >
        <IconAlertTriangle size={13} style={{ color: '#FFB800', flexShrink: 0, marginTop: 1 }} />
        <span>
          <span style={{ color: '#FFB800', fontWeight: 600 }}>ART: </span>
          fuente destilería (pendiente de integración).
        </span>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function AnalisisAzucarModal() {
  const [open, setOpen] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  // Rango filtrado
  const { data: rangoRes, isLoading: rangoLoading } = useAzucar(
    desde || undefined,
    hasta || undefined,
  );
  // Promedio del día (sin rango)
  const { data: diaRes, isLoading: diaLoading } = useAzucar();

  const rangoRows: EspRow[] = rangoRes?.data ?? [];
  const diaRows: EspRow[] = diaRes?.data ?? [];

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all hover:brightness-110"
        style={{
          borderColor: 'var(--primary, #00D4FF)',
          color: 'var(--primary-light, #00D4FF)',
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
            onClick={handleClose}
          >
            <m.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative w-full max-w-[92vw] lg:max-w-5xl xl:max-w-6xl rounded-2xl overflow-hidden border-2 flex flex-col max-h-[90vh]"
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
                style={{ background: 'linear-gradient(90deg, var(--primary, #00D4FF), var(--accent, #FF6B35))' }}
              />

              {/* Close */}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 p-1.5 rounded-md transition-colors z-10"
                style={{ color: 'var(--text-muted, #6B7A9E)' }}
                aria-label="Cerrar"
              >
                <IconX size={16} />
              </button>

              {/* Header */}
              <div className="p-5 sm:p-6 pb-3 shrink-0 flex items-center gap-3.5">
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    background: 'var(--primary-soft, rgba(0,212,255,0.08))',
                    borderColor: 'var(--primary, #00D4FF)',
                    color: 'var(--primary-light, #00D4FF)',
                  }}
                >
                  <IconFlask size={22} />
                </div>
                <div>
                  <h2
                    className="text-xl sm:text-2xl font-bold tracking-tight leading-tight"
                    style={{ color: 'var(--text-primary, #F0F4FF)', fontFamily: 'var(--font-display)' }}
                  >
                    Análisis de Azúcar
                  </h2>
                  <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary, #A0B0C8)' }}>
                    Parámetros de calidad · legacy.especiales
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 sm:px-6 pb-6 overflow-y-auto flex-1 space-y-5">

                {/* ── Selector de hora ── */}
                <div
                  className="rounded-xl border p-4 space-y-3"
                  style={{
                    borderColor: 'var(--border, #1E3A5F)',
                    background: 'var(--bg-card, #1A2236)',
                  }}
                >
                  <div
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                    style={{ color: 'var(--text-muted, #6B7A9E)' }}
                  >
                    <IconClock size={13} />
                    Rango horario (opcional)
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
                      Desde
                      <input
                        type="time"
                        value={desde}
                        onChange={(e) => setDesde(e.target.value)}
                        className="rounded-md px-2 py-1 text-xs border"
                        style={{
                          background: 'var(--bg-base, #0A0E1A)',
                          borderColor: 'var(--border, #1E3A5F)',
                          color: 'var(--text-primary, #F0F4FF)',
                          colorScheme: 'dark',
                        }}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted, #6B7A9E)' }}>
                      Hasta
                      <input
                        type="time"
                        value={hasta}
                        onChange={(e) => setHasta(e.target.value)}
                        className="rounded-md px-2 py-1 text-xs border"
                        style={{
                          background: 'var(--bg-base, #0A0E1A)',
                          borderColor: 'var(--border, #1E3A5F)',
                          color: 'var(--text-primary, #F0F4FF)',
                          colorScheme: 'dark',
                        }}
                      />
                    </label>
                    {(desde || hasta) && (
                      <button
                        type="button"
                        onClick={() => { setDesde(''); setHasta(''); }}
                        className="text-xs underline"
                        style={{ color: 'var(--text-muted, #6B7A9E)' }}
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Matriz pivot — rango ── */}
                <section>
                  <SectionHeader
                    title={desde || hasta ? `Análisis (${desde || '—'} → ${hasta || '—'})` : 'Análisis (todo el día)'}
                  />
                  <PivotTable rows={rangoRows} loading={rangoLoading} emptyMsg="Sin lecturas para el rango seleccionado." />
                </section>

                {/* ── Promedio del día ── (solo si hay rango) */}
                {(desde || hasta) && (
                  <section>
                    <SectionHeader title="Promedio del día" />
                    <PivotTable rows={diaRows} loading={diaLoading} emptyMsg="Sin lecturas para el día." />
                  </section>
                )}

                {/* ── Estado Silos ── */}
                <section>
                  <SectionHeader title="Estado Silos" />
                  <SilosTable rows={diaRows} loading={diaLoading} />
                </section>

                {/* ── Cal / Soda / ART ── */}
                <section>
                  <SectionHeader title="Cal / Soda / ART" />
                  <SodaCalTable rows={diaRows} loading={diaLoading} />
                </section>

              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
