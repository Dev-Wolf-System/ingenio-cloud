'use client';

import { useMemo, useState } from 'react';
import {
  IconAlertTriangle,
  IconAlertCircle,
  IconInfoCircle,
  IconRefresh,
  IconHistory,
  IconClockFilled,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import { type HistoryAlert, AREAS, SEVERITY_STYLE } from '../_types';
import { FilterPill, LoadingState } from './shared';

// ── turno helpers ─────────────────────────────────────────────────────────────

type Turno = 'all' | '05' | '13' | '21';

const TURNOS: { value: Turno; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: '05',  label: 'Mañana' },
  { value: '13',  label: 'Tarde' },
  { value: '21',  label: 'Noche' },
];

function getTurno(isoDate: string): Turno {
  const h = new Date(isoDate).getHours();
  if (h >= 5 && h <= 12)  return '05';
  if (h >= 13 && h <= 20) return '13';
  return '21';
}

// ── types ─────────────────────────────────────────────────────────────────────

interface HistorialPanelProps {
  history: HistoryAlert[];
  historyTotal: number;
  historyLoading: boolean;
  reloadHistory: () => void;
  historyPage: number;
  setHistoryPage: (p: number) => void;
  historyPageCount: number;
}

// ── component ────────────────────────────────────────────────────────────────

export function HistorialPanel({
  history,
  historyTotal,
  historyLoading,
  reloadHistory,
  historyPage,
  setHistoryPage,
  historyPageCount,
}: HistorialPanelProps) {
  const [filterTurno, setFilterTurno]   = useState<Turno>('all');
  const [filterArea, setFilterArea]     = useState<string>('all');
  const [filterSev, setFilterSev]       = useState<string>('all');

  const filtered = useMemo(() => {
    return history.filter((h) => {
      if (filterTurno !== 'all' && getTurno(h.detected_at) !== filterTurno) return false;
      if (filterArea  !== 'all' && h.area !== filterArea) return false;
      if (filterSev   !== 'all' && h.severity !== filterSev) return false;
      return true;
    });
  }, [history, filterTurno, filterArea, filterSev]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

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
      {/* ── Filters row ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 pb-3 border-b border-border/40">
        {/* Turno */}
        <div className="flex items-center gap-1">
          <span className="text-2xs text-text-muted uppercase tracking-wider mr-1">Turno:</span>
          {TURNOS.map((t) => (
            <FilterPill
              key={t.value}
              label={t.label}
              active={filterTurno === t.value}
              onClick={() => setFilterTurno(t.value)}
            />
          ))}
        </div>

        {/* Área */}
        <div className="flex items-center gap-1">
          <span className="text-2xs text-text-muted uppercase tracking-wider mr-1">Área:</span>
          <FilterPill label="Todas" active={filterArea === 'all'} onClick={() => setFilterArea('all')} />
          {AREAS.map((a) => (
            <FilterPill
              key={a.id}
              label={a.label}
              active={filterArea === a.id}
              onClick={() => setFilterArea(a.id)}
              color={a.color}
            />
          ))}
        </div>

        {/* Severidad */}
        <div className="flex items-center gap-1">
          <span className="text-2xs text-text-muted uppercase tracking-wider mr-1">Sev:</span>
          <FilterPill label="Todas" active={filterSev === 'all'} onClick={() => setFilterSev('all')} />
          {(['info', 'warn', 'critical'] as const).map((s) => (
            <FilterPill
              key={s}
              label={SEVERITY_STYLE[s].label}
              active={filterSev === s}
              onClick={() => setFilterSev(s)}
              color={SEVERITY_STYLE[s].color}
            />
          ))}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {historyLoading && history.length === 0 ? (
        <LoadingState />
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-disabled gap-2">
          <IconHistory size={32} className="opacity-30" />
          <p className="text-sm">Sin alertas resueltas aún</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-text-disabled gap-2">
          <IconHistory size={28} className="opacity-30" />
          <p className="text-sm">Sin resultados con los filtros actuales</p>
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
              {filtered.map((h) => {
                const sev = SEVERITY_STYLE[h.severity] ?? SEVERITY_STYLE.info;
                const SevIcon = h.severity === 'critical' ? IconAlertCircle : h.severity === 'warn' ? IconAlertTriangle : IconInfoCircle;
                const durMin = h.resolved_at
                  ? Math.round((new Date(h.resolved_at).getTime() - new Date(h.detected_at).getTime()) / 60_000)
                  : null;
                const fmtDur = durMin == null ? '—' : durMin < 60 ? `${durMin} min` : `${Math.floor(durMin / 60)}h ${durMin % 60}m`;
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

      {/* ── Paginator ─────────────────────────────────────────────────────── */}
      {historyTotal > 0 && (
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-border/40">
          <span className="text-2xs text-text-muted mono">
            {historyTotal} eventos · página <span className="text-text-primary font-semibold">{historyPage + 1}</span> de {historyPageCount}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setHistoryPage(historyPage - 1)}
              disabled={historyPage === 0 || historyLoading}
              className="p-1.5 rounded border border-border text-text-muted hover:text-primary-light hover:border-primary-light/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Página anterior"
            >
              <IconChevronLeft size={14} />
            </button>
            <button
              onClick={() => setHistoryPage(historyPage + 1)}
              disabled={historyPage >= historyPageCount - 1 || historyLoading}
              className="p-1.5 rounded border border-border text-text-muted hover:text-primary-light hover:border-primary-light/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Página siguiente"
            >
              <IconChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </PremiumPanel>
  );
}
