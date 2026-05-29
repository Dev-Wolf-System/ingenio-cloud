'use client';

import {
  IconAlertTriangle,
  IconAlertCircle,
  IconInfoCircle,
  IconRefresh,
  IconHistory,
  IconClockFilled,
} from '@tabler/icons-react';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import { type HistoryAlert, SEVERITY_STYLE } from '../_types';
import { LoadingState } from './shared';

interface HistorialPanelProps {
  history: HistoryAlert[];
  historyTotal: number;
  historyLoading: boolean;
  reloadHistory: () => void;
}

export function HistorialPanel({
  history,
  historyTotal,
  historyLoading,
  reloadHistory,
}: HistorialPanelProps) {
  return (
    <PremiumPanel
      title="HISTORIAL DE ALERTAS"
      subtitle={`${historyTotal} eventos registrados · inicio → normalización`}
      icon={<IconHistory size={18} className="text-primary-light" />}
      accent="neutral"
      headerRight={
        <button
          onClick={reloadHistory}
          disabled={historyLoading}
          className="inline-flex items-center gap-1.5 text-2xs lg:text-xs text-text-muted hover:text-primary-light transition-colors px-3 py-1.5 rounded-md hover:bg-bg-hover border border-border"
        >
          <IconRefresh size={12} className={historyLoading ? 'animate-spin' : ''} />
          Recargar
        </button>
      }
    >
      {historyLoading && history.length === 0 ? (
        <LoadingState />
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-disabled gap-2">
          <IconHistory size={32} className="opacity-30" />
          <p className="text-sm">Sin alertas resueltas aún</p>
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] lg:text-xs uppercase tracking-wider text-text-muted border-b border-border">
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Sev.</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Área</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Alerta</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Valor</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">
                  <span className="flex items-center gap-1"><IconClockFilled size={10} />Inicio</span>
                </th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Normalización</th>
                <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium text-center">Duración</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const sev = SEVERITY_STYLE[h.severity] ?? SEVERITY_STYLE.info;
                const SevIcon = h.severity === 'critical' ? IconAlertCircle : h.severity === 'warn' ? IconAlertTriangle : IconInfoCircle;
                const durMin = h.resolved_at
                  ? Math.round((new Date(h.resolved_at).getTime() - new Date(h.detected_at).getTime()) / 60_000)
                  : null;
                const fmtDur = durMin == null ? '—' : durMin < 60 ? `${durMin} min` : `${Math.floor(durMin / 60)}h ${durMin % 60}m`;
                const fmtDate = (iso: string) =>
                  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                return (
                  <tr key={h.id} className="border-b border-border/30 hover:bg-bg-hover/40 transition-colors">
                    <td className="px-3 lg:px-4 py-2 lg:py-3">
                      <SevIcon size={14} style={{ color: sev.color }} />
                    </td>
                    <td className="px-3 lg:px-4 py-2 lg:py-3">
                      <span
                        className="text-[10px] lg:text-xs font-semibold uppercase tracking-wider mono px-1.5 py-0.5 rounded"
                        style={{ color: sev.color, background: sev.bg, border: `1px solid ${sev.color}44` }}
                      >
                        {h.area}
                      </span>
                    </td>
                    <td className="px-3 lg:px-4 py-2 lg:py-3 max-w-[220px]">
                      <p className="text-xs lg:text-sm font-medium text-text-primary truncate">{h.title}</p>
                      {h.message && <p className="text-2xs lg:text-xs text-text-disabled truncate">{h.message}</p>}
                    </td>
                    <td className="px-3 lg:px-4 py-2 lg:py-3">
                      {h.metadata?.value != null ? (
                        <span className="mono tabular-nums text-xs lg:text-sm font-semibold" style={{ color: sev.color }}>
                          {h.metadata.value}{h.metadata.unit ? ` ${h.metadata.unit}` : ''}
                        </span>
                      ) : <span className="text-text-disabled">—</span>}
                    </td>
                    <td className="px-3 lg:px-4 py-2 lg:py-3">
                      <span className="mono text-2xs lg:text-xs text-text-primary tabular-nums">{fmtDate(h.detected_at)}</span>
                    </td>
                    <td className="px-3 lg:px-4 py-2 lg:py-3">
                      {h.resolved_at ? (
                        <span className="mono text-2xs lg:text-xs text-ok tabular-nums">{fmtDate(h.resolved_at)}</span>
                      ) : (
                        <span className="text-2xs lg:text-xs text-warn font-semibold">activa</span>
                      )}
                    </td>
                    <td className="px-3 lg:px-4 py-2 lg:py-3 text-center">
                      <span className={`mono text-xs lg:text-sm tabular-nums font-semibold ${durMin != null && durMin > 60 ? 'text-danger' : durMin != null && durMin > 15 ? 'text-warn' : 'text-ok'}`}>
                        {fmtDur}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PremiumPanel>
  );
}
