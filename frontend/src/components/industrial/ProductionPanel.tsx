'use client';

import { IconChartLine } from '@tabler/icons-react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { MetricTile } from './MetricTile';
import { PanelHeader } from './PanelHeader';

export function ProductionPanel() {
  const data = useDashboardData('produccion');
  const entries = Array.from(data.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <section className="flex flex-col rounded-lg border border-border bg-bg-surface p-4 overflow-hidden">
      <PanelHeader
        title="Producción"
        icon={<IconChartLine size={18} />}
        badge={
          <span className="text-2xs text-text-muted mono">
            {entries.length} {entries.length === 1 ? 'señal' : 'señales'}
          </span>
        }
      />
      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
          Esperando datos desde Node-RED...
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 flex-1 content-start overflow-auto">
          {entries.map(([key, item]) => (
            <MetricTile
              key={key}
              size="sm"
              label={key.replaceAll('_', ' ')}
              value={item.value}
              unit={item.unit ?? ''}
              precision={2}
              status="ok"
              area="produccion"
              sensorKey={key}
            />
          ))}
        </div>
      )}
    </section>
  );
}
