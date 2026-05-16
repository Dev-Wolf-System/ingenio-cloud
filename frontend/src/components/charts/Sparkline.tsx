'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils/cn';

export interface SparklineProps {
  data: number[];
  height?: number;
  color?: string;
  className?: string;
}

export function Sparkline({ data, height = 18, color, className }: SparklineProps) {
  if (!data || data.length < 2) {
    return <div className={cn('h-[18px]', className)} />;
  }
  const series = data.map((value, i) => ({ i, value }));
  const stroke = color ?? 'var(--primary-light)';
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${stroke}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#spark-${stroke})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
