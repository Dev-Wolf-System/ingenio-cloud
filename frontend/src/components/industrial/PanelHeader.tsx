import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface PanelHeaderProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export function PanelHeader({ title, icon, badge, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">{title}</h2>
      </div>
      {badge && <div>{badge}</div>}
    </div>
  );
}
