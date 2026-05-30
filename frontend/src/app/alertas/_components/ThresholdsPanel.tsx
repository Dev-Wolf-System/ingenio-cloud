'use client';

import { useMemo, useState } from 'react';
import { IconAlertTriangle, IconChevronDown, IconChevronRight, IconFilter } from '@tabler/icons-react';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import { type Area, type Threshold, type SensorKey, AREAS } from '../_types';
import { NumberInput, SeveritySelect, Toggle, FilterPill, LoadingState, EmptyState } from './shared';

// ── Live status badge ────────────────────────────────────────────────────────

type LiveStatus = 'in-range' | 'out-of-range' | 'no-reading' | 'no-threshold';

function getLiveStatus(t: Threshold, value: number): LiveStatus {
  if (!Number.isFinite(value)) return 'no-reading';
  if (!t.enabled) return 'no-threshold';
  const hasMin = t.min_value != null;
  const hasMax = t.max_value != null;
  if (!hasMin && !hasMax) return 'no-threshold';
  const outOfRange =
    (hasMin && value < t.min_value!) ||
    (hasMax && value > t.max_value!);
  return outOfRange ? 'out-of-range' : 'in-range';
}

const STATUS_CONF: Record<LiveStatus, { label: string; color: string; bg: string }> = {
  'in-range':     { label: 'En rango',    color: '#00E5A0', bg: 'rgba(0,229,160,0.12)' },
  'out-of-range': { label: 'Fuera',       color: '#FF4757', bg: 'rgba(255,71,87,0.14)' },
  'no-reading':   { label: 'Sin lectura', color: '#6B7A9E', bg: 'rgba(107,122,158,0.12)' },
  'no-threshold': { label: 'Sin umbral',  color: '#4FBFE5', bg: 'rgba(79,191,229,0.10)' },
};

function StatusBadge({ status }: { status: LiveStatus }) {
  const conf = STATUS_CONF[status];
  return (
    <span
      className="text-xs uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: conf.color, background: conf.bg, border: `1px solid ${conf.color}33` }}
    >
      {conf.label}
    </span>
  );
}

// ── Compact number input for escalation ──────────────────────────────────────

function SmallNumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder: string;
}) {
  return (
    <input
      type="number"
      step="any"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? null : Number(v));
      }}
      placeholder={placeholder}
      className="w-14 mono tabular-nums text-sm bg-bg-card/60 border border-border rounded px-1.5 py-0.5 text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary-light/50"
    />
  );
}

// ── Area section header ──────────────────────────────────────────────────────

function AreaHeader({
  label,
  color,
  enabledCount,
  total,
  open,
  onToggle,
}: {
  label: string;
  color: string;
  enabledCount: number;
  total: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <tr
      className="cursor-pointer select-none border-b border-border"
      onClick={onToggle}
      style={{ background: `${color}0A` }}
    >
      <td colSpan={9} className="px-3 lg:px-4 py-2">
        <div className="flex items-center gap-2">
          {open
            ? <IconChevronDown size={14} style={{ color }} />
            : <IconChevronRight size={14} style={{ color }} />}
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color }}
          >
            {label}
          </span>
          <span className="text-xs text-text-muted ml-1">
            {enabledCount}/{total} activos
          </span>
        </div>
      </td>
    </tr>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface ThresholdsPanelProps {
  loading: boolean;
  filteredSensors: SensorKey[];
  areaFilter: Area | 'all';
  setAreaFilter: (v: Area | 'all') => void;
  search: string;
  setSearch: (v: string) => void;
  getThreshold: (area: Area, key: string) => Threshold;
  update: (area: Area, key: string, patch: Partial<Threshold>) => void;
}

export function ThresholdsPanel({
  loading,
  filteredSensors,
  areaFilter,
  setAreaFilter,
  search,
  setSearch,
  getThreshold,
  update,
}: ThresholdsPanelProps) {
  // Track open/closed per area — default all open
  const [openAreas, setOpenAreas] = useState<Record<string, boolean>>(
    () => Object.fromEntries(AREAS.map((a) => [a.id, true]))
  );

  const toggleArea = (areaId: string) =>
    setOpenAreas((prev) => ({ ...prev, [areaId]: !prev[areaId] }));

  // Group filtered sensors by area, preserving AREAS order
  const grouped = useMemo(() => {
    return AREAS
      .map((areaConf) => ({
        areaConf,
        sensors: filteredSensors.filter((s) => s.area === areaConf.id),
      }))
      .filter((g) => g.sensors.length > 0);
  }, [filteredSensors]);

  return (
    <PremiumPanel
      title="UMBRALES DE ALERTAS"
      subtitle="Configurá rangos mín/máx por sensor · disparo automático cuando se exceda"
      icon={<IconAlertTriangle size={18} className="text-warn" />}
      accent="warn"
      headerRight={
        <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">
          <div className="flex items-center gap-1 bg-bg-card/60 border border-border rounded-md p-0.5 overflow-x-auto">
            <FilterPill active={areaFilter === 'all'} onClick={() => setAreaFilter('all')} label="Todas" />
            {AREAS.map((a) => (
              <FilterPill
                key={a.id}
                active={areaFilter === a.id}
                onClick={() => setAreaFilter(a.id)}
                label={a.label}
                color={a.color}
              />
            ))}
          </div>
          <div className="relative">
            <IconFilter size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-disabled" />
            <input
              type="text"
              placeholder="Buscar sensor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm bg-bg-card/60 border border-border rounded-md pl-7 pr-2 py-1.5 text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary-light/50 w-36 sm:w-44"
            />
          </div>
        </div>
      }
    >
      {loading ? (
        <LoadingState />
      ) : filteredSensors.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs lg:text-sm uppercase tracking-wider text-text-muted border-b border-border">
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Sensor</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium text-center">Estado</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium text-center">Valor actual</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Mínimo</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Máximo</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Severidad</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Escalado</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Nota</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium text-center">Activa</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ areaConf, sensors }) => {
                const enabledCount = sensors.filter((s) => getThreshold(s.area, s.key).enabled).length;
                const isOpen = openAreas[areaConf.id] ?? true;
                return [
                  <AreaHeader
                    key={`header-${areaConf.id}`}
                    label={areaConf.label}
                    color={areaConf.color}
                    enabledCount={enabledCount}
                    total={sensors.length}
                    open={isOpen}
                    onToggle={() => toggleArea(areaConf.id)}
                  />,
                  ...(isOpen
                    ? sensors.map((s) => {
                        const t = getThreshold(s.area, s.key);
                        const status = getLiveStatus(t, s.value);
                        const outOfRange = status === 'out-of-range';
                        return (
                          <tr
                            key={`${s.area}::${s.key}`}
                            className="border-b border-border/30 hover:bg-bg-hover/40 transition-colors"
                          >
                            {/* Sensor name */}
                            <td className="px-3 lg:px-4 py-2 lg:py-3">
                              <div className="font-medium text-text-primary text-sm lg:text-base">
                                {s.key.replaceAll('_', ' ')}
                              </div>
                              <div className="text-xs text-text-disabled mono">{s.unit ?? '—'}</div>
                            </td>

                            {/* Live status */}
                            <td className="px-3 lg:px-4 py-2 lg:py-3 text-center">
                              <StatusBadge status={status} />
                            </td>

                            {/* Current value */}
                            <td className="px-3 lg:px-4 py-2 lg:py-3 text-center">
                              <span
                                className={`mono tabular-nums text-sm lg:text-base font-semibold ${outOfRange ? 'text-danger' : 'text-text-primary'}`}
                              >
                                {Number.isFinite(s.value) ? s.value.toFixed(2) : '—'}
                              </span>
                            </td>

                            {/* Min */}
                            <td className="px-3 lg:px-4 py-2 lg:py-3">
                              <NumberInput
                                value={t.min_value}
                                onChange={(v) => update(s.area, s.key, { min_value: v })}
                              />
                            </td>

                            {/* Max */}
                            <td className="px-3 lg:px-4 py-2 lg:py-3">
                              <NumberInput
                                value={t.max_value}
                                onChange={(v) => update(s.area, s.key, { max_value: v })}
                              />
                            </td>

                            {/* Severity */}
                            <td className="px-3 lg:px-4 py-2 lg:py-3">
                              <SeveritySelect
                                value={t.severity}
                                onChange={(v) => update(s.area, s.key, { severity: v })}
                              />
                            </td>

                            {/* Escalation overrides */}
                            <td className="px-3 lg:px-4 py-2 lg:py-3">
                              {/* Escalar a crítica toggle */}
                              <div className="flex items-center gap-1.5 mb-1">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={t.escalate_enabled !== false}
                                  onClick={() => update(s.area, s.key, { escalate_enabled: t.escalate_enabled === false ? true : false })}
                                  className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 focus:outline-none ${
                                    t.escalate_enabled !== false
                                      ? 'bg-primary/80 border-primary/60'
                                      : 'bg-bg-card border-border'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                      t.escalate_enabled !== false ? 'translate-x-3.5' : 'translate-x-0.5'
                                    } mt-0.5`}
                                  />
                                </button>
                                <span className={`text-xs whitespace-nowrap ${t.escalate_enabled !== false ? 'text-text-muted' : 'text-text-disabled'}`}>
                                  Escalar a crítica
                                </span>
                              </div>
                              {/* Overrides — dimmed when escalation is disabled */}
                              <div className={`flex items-center gap-1 transition-opacity ${t.escalate_enabled === false ? 'opacity-30 pointer-events-none' : ''}`}>
                                <SmallNumberInput
                                  value={t.escalate_after_min}
                                  onChange={(v) => update(s.area, s.key, { escalate_after_min: v })}
                                  placeholder="min"
                                />
                                <span className="text-[10px] text-text-disabled">/</span>
                                <SmallNumberInput
                                  value={t.escalate_drift_pct}
                                  onChange={(v) => update(s.area, s.key, { escalate_drift_pct: v })}
                                  placeholder="%"
                                />
                              </div>
                              <div className={`text-xs mt-0.5 whitespace-nowrap transition-opacity ${t.escalate_enabled === false ? 'opacity-30' : 'text-text-disabled'}`}>tiempo / deriva</div>
                            </td>

                            {/* Notes */}
                            <td className="px-3 lg:px-4 py-2 lg:py-3">
                              <input
                                type="text"
                                value={t.notes ?? ''}
                                onChange={(e) => update(s.area, s.key, { notes: e.target.value || null })}
                                placeholder="nota…"
                                className="w-28 lg:w-36 text-sm bg-bg-card/60 border border-border rounded px-2 py-1 text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary-light/50"
                              />
                            </td>

                            {/* Enabled toggle */}
                            <td className="px-3 lg:px-4 py-2 lg:py-3 text-center">
                              <Toggle
                                enabled={t.enabled}
                                onChange={(v) => update(s.area, s.key, { enabled: v })}
                              />
                            </td>
                          </tr>
                        );
                      })
                    : []),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </PremiumPanel>
  );
}
