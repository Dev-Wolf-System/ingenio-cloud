'use client';

import { cn } from '@/lib/utils/cn';
import type { MetricReading } from '@/types/metrics';

export interface HealthScoreProps {
  metrics: Map<string, MetricReading>;
  className?: string;
}

export function HealthScore({ metrics, className }: HealthScoreProps) {
  const values = Array.from(metrics.values());
  if (values.length === 0) {
    return <span className={cn('text-text-muted text-xs mono', className)}>—</span>;
  }
  const score =
    values.reduce((acc, m) => {
      if (m.status === 'ok') return acc + 100;
      if (m.status === 'warn') return acc + 60;
      if (m.status === 'alarm') return acc + 0;
      return acc + 50;
    }, 0) / values.length;
  const rounded = Math.round(score);
  const color =
    rounded >= 85 ? 'text-ok' : rounded >= 60 ? 'text-warn' : 'text-danger';
  const dots =
    rounded >= 85 ? '●●●' : rounded >= 60 ? '●●○' : '●○○';
  return (
    <span className={cn('inline-flex items-center gap-2 mono text-xs', color, className)}>
      <span>{dots}</span>
      <span className="font-semibold">{rounded}/100</span>
    </span>
  );
}
