import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface PanelHeaderProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  subtitle?: string;
  className?: string;
}

export function PanelHeader({ title, icon, badge, subtitle, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-3 pb-2 border-b border-border', className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span className="w-7 h-7 rounded-md bg-primary-soft text-primary-light flex items-center justify-center shrink-0">
            {icon}
          </span>
        )}
        <div className="flex flex-col leading-tight min-w-0">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-text-primary truncate">
            {title}
          </h2>
          {subtitle && (
            <span className="text-2xs text-text-muted truncate">{subtitle}</span>
          )}
        </div>
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  );
}
