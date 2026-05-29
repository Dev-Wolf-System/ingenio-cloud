'use client';

import { IconAlertTriangle, IconFilter } from '@tabler/icons-react';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import { type Area, type Threshold, type SensorKey, AREAS } from '../_types';
import { NumberInput, SeveritySelect, Toggle, FilterPill, LoadingState, EmptyState } from './shared';

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
              className="text-xs bg-bg-card/60 border border-border rounded-md pl-7 pr-2 py-1.5 text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary-light/50 w-36 sm:w-44"
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
              <tr className="text-left text-[10px] lg:text-xs uppercase tracking-wider text-text-muted border-b border-border">
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Área</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Sensor</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium text-center">Valor actual</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Mínimo</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Máximo</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Severidad</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium text-center">Activa</th>
              </tr>
            </thead>
            <tbody>
              {filteredSensors.map((s) => {
                const t = getThreshold(s.area, s.key);
                const areaConf = AREAS.find((a) => a.id === s.area)!;
                const outOfRange =
                  (t.min_value != null && s.value < t.min_value) ||
                  (t.max_value != null && s.value > t.max_value);
                return (
                  <tr
                    key={`${s.area}::${s.key}`}
                    className="border-b border-border/30 hover:bg-bg-hover/40 transition-colors"
                  >
                    <td className="px-3 lg:px-4 py-2 lg:py-3">
                      <span
                        className="text-[10px] lg:text-xs font-semibold uppercase tracking-wider mono px-2 lg:px-2.5 py-0.5 lg:py-1 rounded"
                        style={{
                          color: areaConf.color,
                          background: `${areaConf.color}1A`,
                          border: `1px solid ${areaConf.color}33`,
                        }}
                      >
                        {areaConf.label}
                      </span>
                    </td>
                    <td className="px-3 lg:px-4 py-2 lg:py-3">
                      <div className="font-medium text-text-primary text-xs lg:text-sm">
                        {s.key.replaceAll('_', ' ')}
                      </div>
                      <div className="text-2xs lg:text-xs text-text-disabled mono">{s.unit ?? '—'}</div>
                    </td>
                    <td className="px-3 lg:px-4 py-2 lg:py-3 text-center">
                      <span
                        className={`mono tabular-nums text-sm lg:text-base font-semibold ${outOfRange && t.enabled ? 'text-danger' : 'text-text-primary'}`}
                      >
                        {Number.isFinite(s.value) ? s.value.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td className="px-3 lg:px-4 py-2 lg:py-3">
                      <NumberInput
                        value={t.min_value}
                        onChange={(v) => update(s.area, s.key, { min_value: v })}
                      />
                    </td>
                    <td className="px-3 lg:px-4 py-2 lg:py-3">
                      <NumberInput
                        value={t.max_value}
                        onChange={(v) => update(s.area, s.key, { max_value: v })}
                      />
                    </td>
                    <td className="px-3 lg:px-4 py-2 lg:py-3">
                      <SeveritySelect
                        value={t.severity}
                        onChange={(v) => update(s.area, s.key, { severity: v })}
                      />
                    </td>
                    <td className="px-3 lg:px-4 py-2 lg:py-3 text-center">
                      <Toggle
                        enabled={t.enabled}
                        onChange={(v) => update(s.area, s.key, { enabled: v })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PremiumPanel>
  );
}
