'use client';

import {
  IconChartLine,
  IconGauge,
  IconTemperature,
  IconRipple,
  IconChartBar,
  IconDroplet,
  IconActivity,
  IconScale,
  IconFlask,
  IconWaveSine,
} from '@tabler/icons-react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { useThresholds, evaluateValue } from '@/lib/hooks/useThresholds';
import { useTileOrder } from '@/lib/hooks/useTileOrder';
import { useKanbanLock } from '@/lib/hooks/useKanbanLock';
import { PremiumPanel } from './PremiumPanel';
import { PremiumTile, type TileAccent } from './PremiumTile';
import { SortableGroup } from './SortableGroup';
import { SortableTile } from './SortableTile';

function iconFor(key: string): React.ReactNode {
  const k = key.toLowerCase();
  if (k.includes('temp')) return <IconTemperature size={14} />;
  if (k.includes('press') || k.includes('pres')) return <IconGauge size={14} />;
  if (k.includes('caudal') || k.includes('flujo')) return <IconRipple size={14} />;
  if (k.includes('nivel')) return <IconChartBar size={14} />;
  if (k.includes('humed') || k.includes('agua')) return <IconDroplet size={14} />;
  if (k.includes('ph') || k.includes('encal')) return <IconFlask size={14} />;
  if (k.includes('color')) return <IconWaveSine size={14} />;
  if (k.includes('molienda') || k.includes('peso')) return <IconScale size={14} />;
  return <IconActivity size={14} />;
}

function accentForKey(key: string): TileAccent {
  const k = key.toLowerCase();
  if (k.includes('temp')) return 'warn';
  if (k.includes('press') || k.includes('pres')) return 'accent';
  if (k.includes('nivel')) return 'primary';
  if (k.includes('caudal') || k.includes('flujo') || k.includes('vino') || k.includes('alcohol') || k.includes('melaza')) return 'accent';
  if (k.includes('humed')) return 'primary';
  if (k.includes('color')) return 'warn';
  if (k.includes('ph') || k.includes('encal')) return 'accent';
  return 'primary';
}

// Keys que NO mostrar en panel — se exhiben en otros lugares o quedan obsoletos
// (cinta larga → KpiHero "Color azúcar"; bolsas → KpiHero "Bolsas azúcar"; cinta corta deprecated)
const HIDDEN_KEYS = [
  'color_cinta_corta',
  'humedad_cinta_corta',
  'color_cinta_larga',
  'humedad_cinta_larga',
];

// Substrings que ocultan cualquier key que los contenga (KPI ya presente en KpiHero)
const HIDDEN_SUBSTRINGS = ['bolsa'];

export function ProductionPanel() {
  const data = useDashboardData('produccion');
  const { data: thresholds } = useThresholds();
  const baseKeys = Array.from(data.keys())
    .filter((k) => {
      const lk = k.toLowerCase();
      return !HIDDEN_KEYS.includes(lk) && !HIDDEN_SUBSTRINGS.some((s) => lk.includes(s));
    })
    .sort();
  const { ordered, saveOrder } = useTileOrder('produccion', baseKeys);
  const { locked } = useKanbanLock();
  const entries = ordered
    .map((k) => [k, data.get(k)!] as const)
    .filter(([, item]) => item != null);
  const count = entries.length;

  return (
    <PremiumPanel
      title="PRODUCCIÓN"
      subtitle={`Clarificación · Tachos · Destilería · Azúcar · ${count} señal${count === 1 ? '' : 'es'}`}
      icon={<IconChartLine size={18} className="text-ok" />}
      accent="accent"
      headerRight={
        <span className="inline-flex items-center gap-1.5 text-2xs mono text-text-muted px-2 py-1 rounded-md bg-bg-card/60 border border-border shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
          <span className="tabular-nums">{count}</span>
        </span>
      }
    >
      {count === 0 ? (
        <EmptyState />
      ) : (
        <SortableGroup items={ordered} onReorder={saveOrder} disabled={locked}>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-2">
            {entries.map(([key, item]) => {
              const evalResult = evaluateValue(thresholds, 'produccion', key, item.value);
              return (
                <SortableTile key={key} id={key}>
                  <PremiumTile
                    icon={iconFor(key)}
                    label={key.replaceAll('_', ' ')}
                    value={item.value}
                    unit={item.unit ?? ''}
                    precision={2}
                    accent={accentForKey(key)}
                    updatedAt={item.updated_at}
                    alert={
                      evalResult.status === 'out' && evalResult.severity && evalResult.reason
                        ? {
                            severity: evalResult.severity,
                            reason: evalResult.reason,
                            min: evalResult.threshold?.min_value,
                            max: evalResult.threshold?.max_value,
                          }
                        : null
                    }
                  />
                </SortableTile>
              );
            })}
          </div>
        </SortableGroup>
      )}
    </PremiumPanel>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
      <div
        className="relative w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(0,229,160,0.15), transparent)',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      >
        <IconChartLine size={24} className="text-ok/60" />
      </div>
      <p className="text-xs text-text-muted">Esperando datos de producción…</p>
    </div>
  );
}
