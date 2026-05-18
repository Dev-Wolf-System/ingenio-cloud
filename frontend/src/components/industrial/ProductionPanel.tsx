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
import { PremiumPanel } from './PremiumPanel';
import { PremiumTile, type TileAccent } from './PremiumTile';

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
  return 'neutral';
}

export function ProductionPanel() {
  const data = useDashboardData('produccion');
  const { data: thresholds } = useThresholds();
  const entries = Array.from(data.entries()).sort((a, b) => a[0].localeCompare(b[0]));
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
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-2">
          {entries.map(([key, item]) => {
            const evalResult = evaluateValue(thresholds, 'produccion', key, item.value);
            return (
              <PremiumTile
                key={key}
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
            );
          })}
        </div>
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
