'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';
import type { MetricStatus } from '@/types/metrics';
import { Sparkline } from '@/components/charts/Sparkline';
import { useSparkline } from '@/lib/hooks/useSparkline';

const tileVariants = cva(
  'relative rounded-md transition-all duration-200 border border-border bg-bg-card',
  {
    variants: {
      status: {
        ok: 'border-l-2 border-l-ok',
        warn: 'border-l-2 border-l-warn',
        alarm: 'border-l-[3px] border-l-danger animate-pulse-alarm',
        unknown: 'border-l border-l-text-muted opacity-70',
      },
      size: {
        sm: 'p-3 min-h-[72px]',
        md: 'p-4 min-h-[88px]',
        lg: 'p-5 min-h-[112px]',
      },
    },
    defaultVariants: {
      status: 'unknown',
      size: 'md',
    },
  },
);

export interface MetricTileProps extends VariantProps<typeof tileVariants> {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  precision?: number;
  status?: MetricStatus;
  className?: string;
  /** Si se pasa area+sensorKey, fetch sparkline desde Influx via /api/metrics/sparkline */
  area?: 'energia' | 'produccion';
  sensorKey?: string;
}

export function MetricTile({
  label,
  value,
  unit,
  precision = 1,
  status = 'unknown',
  size,
  className,
  area,
  sensorKey,
}: MetricTileProps) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current !== value && prev.current !== undefined) {
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 400);
      prev.current = value;
      return () => clearTimeout(id);
    }
    prev.current = value;
  }, [value]);

  const sparkQuery = useSparkline(area ?? 'energia', area && sensorKey ? sensorKey : null, 30);
  const sparklineData = sparkQuery.data ?? [];

  const displayValue =
    typeof value === 'number' && Number.isFinite(value)
      ? formatNumber(value, precision)
      : value ?? '—';

  const sparkColor =
    status === 'alarm' ? 'var(--danger)' :
    status === 'warn' ? 'var(--warn)' :
    status === 'ok' ? 'var(--ok)' : 'var(--primary-light)';

  return (
    <div className={cn(tileVariants({ status, size }), flash && 'animate-flash', className)}>
      <div className="text-2xs uppercase tracking-wide text-text-muted font-medium truncate">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="mono text-fluid-value font-medium text-text-primary">{displayValue}</span>
        {unit && <span className="text-xs text-text-muted">{unit}</span>}
      </div>
      {area && sensorKey && sparklineData.length >= 2 && (
        <Sparkline data={sparklineData} color={sparkColor} className="mt-1.5 opacity-70" />
      )}
    </div>
  );
}
