'use client';

import type { ReactNode } from 'react';
import type { ActiveAlert } from './AlertasModalAuto';

interface AlertGroupProps {
  titular?: string;
  alerts: ActiveAlert[];
  renderItem: (a: ActiveAlert) => ReactNode;
}

export function AlertGroup({ titular, alerts, renderItem }: AlertGroupProps) {
  return (
    <div className="space-y-2 lg:space-y-3">
      {titular && (
        <p className="text-[10px] lg:text-xs font-semibold uppercase tracking-widest text-gray-500 px-1">
          {titular}
        </p>
      )}
      {alerts.map((a) => renderItem(a))}
    </div>
  );
}
