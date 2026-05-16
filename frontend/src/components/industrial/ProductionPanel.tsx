'use client';

import { IconChartLine, IconRadar } from '@tabler/icons-react';
import Image from 'next/image';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { MetricTile } from './MetricTile';
import { PanelHeader } from './PanelHeader';

export function ProductionPanel() {
  const data = useDashboardData('produccion');
  const entries = Array.from(data.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <section className="flex flex-col rounded-xl border border-border bg-bg-surface/60 p-4 overflow-hidden backdrop-blur-sm relative">
      <PanelHeader
        title="Producción"
        subtitle="Clarificación · Tachos · Destilería · Azúcar"
        icon={<IconChartLine size={15} />}
        badge={
          <span className="inline-flex items-center gap-1.5 text-2xs mono text-text-muted px-2 py-1 rounded-md bg-bg-card border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
            <span className="tabular-nums">{entries.length}</span>
            <span>{entries.length === 1 ? 'señal' : 'señales'}</span>
          </span>
        }
      />
      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
          <div className="relative w-16 h-16 opacity-40">
            <Image src="/logo-ingenio-cloud.png" alt="" fill className="object-contain" />
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <IconRadar size={14} style={{ animation: 'spin 3s linear infinite' }} />
            Esperando datos de Node-RED...
          </div>
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
              timestamp={item.updated_at}
            />
          ))}
        </div>
      )}
    </section>
  );
}
