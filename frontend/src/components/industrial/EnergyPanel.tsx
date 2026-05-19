'use client';

import {
  IconBolt,
  IconGauge,
  IconTemperature,
  IconRipple,
  IconChartBar,
  IconDroplet,
  IconActivity,
} from '@tabler/icons-react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { useThresholds, evaluateValue } from '@/lib/hooks/useThresholds';
import { useTileOrder } from '@/lib/hooks/useTileOrder';
import { PremiumPanel } from './PremiumPanel';
import { PremiumTile, type TileAccent } from './PremiumTile';
import { SortableGroup } from './SortableGroup';
import { SortableTile } from './SortableTile';

function iconFor(key: string): React.ReactNode {
  const k = key.toLowerCase();
  if (k.includes('temp')) return <IconTemperature size={14} />;
  if (k.includes('press') || k.includes('pres')) return <IconGauge size={14} />;
  if (k.includes('caudal') || k.includes('flujo') || k.includes('vapor')) return <IconRipple size={14} />;
  if (k.includes('nivel')) return <IconChartBar size={14} />;
  if (k.includes('humed') || k.includes('agua')) return <IconDroplet size={14} />;
  return <IconActivity size={14} />;
}

function accentForKey(key: string): TileAccent {
  const k = key.toLowerCase();
  if (k.includes('temp')) return 'warn';
  if (k.includes('press') || k.includes('pres') || k.includes('vapor')) return 'accent';
  if (k.includes('caudal') || k.includes('gas')) return 'warn';
  if (k.includes('potencia') || k.includes('weg') || k.includes('siemens')) return 'accent';
  return 'primary';
}

export function EnergyPanel() {
  const data = useDashboardData('energia');
  const { data: thresholds } = useThresholds();
  const baseKeys = Array.from(data.keys()).sort();
  const { ordered, saveOrder } = useTileOrder('energia', baseKeys);
  const entries = ordered
    .map((k) => [k, data.get(k)!] as const)
    .filter(([, item]) => item != null);
  const count = entries.length;

  return (
    <PremiumPanel
      title="ENERGÍA"
      subtitle={`Caldera · Vapor · Termodinámica · ${count} señal${count === 1 ? '' : 'es'}`}
      icon={<IconBolt size={18} className="text-warn" />}
      accent="warn"
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
        <SortableGroup items={ordered} onReorder={saveOrder}>
          <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {entries.map(([key, item]) => {
              const evalResult = evaluateValue(thresholds, 'energia', key, item.value);
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
          background: 'radial-gradient(circle, rgba(255,184,0,0.15), transparent)',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      >
        <IconBolt size={24} className="text-warn/60" />
      </div>
      <p className="text-xs text-text-muted">Esperando datos de energía…</p>
    </div>
  );
}
