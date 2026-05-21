'use client';

import { AnimatePresence, m } from 'motion/react';
import {
  IconX,
  IconPlayerPause,
  IconClock,
  IconTool,
  IconUser,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { formatNumber } from '@/lib/utils/format';

export interface ParadaDetalle {
  desde?: string | null;
  hasta?: string | null;
  rango?: string | null;
  estado?: string | null;
  motivo?: string | null;
  origen?: string | null;
  maquina?: string | null;
  minutos_neto?: number | null;
}

export interface ParadasDetalleModalProps {
  open: boolean;
  onClose: () => void;
  turno?: string | null;
  rango?: string | null;
  paradas: ParadaDetalle[];
  totalMinutos?: number | null;
}

function esAbierta(estado?: string | null): boolean {
  return (estado ?? '').toLowerCase().includes('abiert');
}

export function ParadasDetalleModal({
  open,
  onClose,
  turno,
  rango,
  paradas,
  totalMinutos,
}: ParadasDetalleModalProps) {
  const count = paradas.length;
  const abiertas = paradas.filter((p) => esAbierta(p.estado)).length;

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <m.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative w-full max-w-2xl rounded-2xl overflow-hidden border-2 flex flex-col max-h-[85vh]"
            style={{
              background:
                'var(--panel-mesh-1), var(--panel-mesh-2), linear-gradient(135deg, var(--surface-panel-from), var(--surface-panel-to))',
              borderColor: 'var(--border-strong)',
              boxShadow: 'var(--panel-shadow), 0 40px 120px rgba(0,0,0,0.45)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              aria-hidden
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: 'linear-gradient(90deg, var(--danger), var(--warn))' }}
            />

            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary z-10"
              aria-label="Cerrar"
            >
              <IconX size={16} />
            </button>

            {/* Header */}
            <div className="p-6 pb-4 shrink-0">
              <div className="flex items-start gap-3.5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    background: 'var(--danger-soft)',
                    borderColor: 'var(--danger)',
                    color: 'var(--danger)',
                  }}
                >
                  <IconPlayerPause size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2
                    className="text-xl sm:text-2xl font-bold tracking-tight leading-tight text-text-primary"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Detalle de paradas
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {turno ? `${turno} · ` : ''}
                    {rango ?? 'Turno anterior'}
                  </p>
                </div>
              </div>

              {/* Resumen */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                <StatBox label="Eventos" value={String(count)} />
                <StatBox
                  label="Tiempo total"
                  value={
                    totalMinutos != null && totalMinutos > 0
                      ? `${formatNumber(totalMinutos, 0)} min`
                      : '—'
                  }
                />
                <StatBox
                  label="Abiertas"
                  value={String(abiertas)}
                  danger={abiertas > 0}
                />
              </div>
            </div>

            {/* Lista */}
            <div className="px-6 pb-6 overflow-y-auto flex-1">
              {count === 0 ? (
                <div className="rounded-xl border border-border-subtle bg-bg-card py-10 text-center">
                  <div className="text-sm text-text-muted">
                    Sin paradas registradas en el turno anterior
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {paradas.map((p, i) => {
                    const abierta = esAbierta(p.estado);
                    return (
                      <m.li
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                        className="rounded-xl border p-3.5"
                        style={{
                          background: 'var(--bg-card)',
                          borderColor: abierta ? 'var(--warn)' : 'var(--border-subtle)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <IconAlertTriangle
                              size={15}
                              style={{ color: abierta ? 'var(--warn)' : 'var(--danger)' }}
                              className="shrink-0"
                            />
                            <span className="text-sm font-semibold text-text-primary truncate">
                              {p.motivo ?? 'Parada sin motivo'}
                            </span>
                          </div>
                          <span
                            className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full shrink-0"
                            style={{
                              background: abierta ? 'var(--warn-soft)' : 'var(--ok-soft)',
                              color: abierta ? 'var(--warn)' : 'var(--ok)',
                            }}
                          >
                            {abierta ? 'Abierta' : 'Cerrada'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5 pl-[23px]">
                          <Meta
                            icon={<IconClock size={12} />}
                            text={p.rango ?? `${p.desde ?? '—'} → ${p.hasta ?? '—'}`}
                          />
                          {p.minutos_neto != null && (
                            <Meta
                              icon={<IconClock size={12} />}
                              text={`${formatNumber(p.minutos_neto, 0)} min`}
                              strong
                            />
                          )}
                          {p.maquina && (
                            <Meta icon={<IconTool size={12} />} text={p.maquina} />
                          )}
                          {p.origen && (
                            <Meta icon={<IconUser size={12} />} text={p.origen} />
                          )}
                        </div>
                      </m.li>
                    );
                  })}
                </ul>
              )}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function StatBox({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-2.5 border text-center"
      style={{
        background: danger ? 'var(--danger-soft)' : 'var(--surface-tile-from)',
        borderColor: danger ? 'var(--danger)' : 'var(--border-subtle)',
      }}
    >
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
        {label}
      </div>
      <div
        className="text-lg font-bold mono tabular-nums mt-0.5 leading-none"
        style={{ color: danger ? 'var(--danger)' : 'var(--text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}

function Meta({
  icon,
  text,
  strong,
}: {
  icon: React.ReactNode;
  text: string;
  strong?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      style={{ color: strong ? 'var(--text-primary)' : 'var(--text-muted)' }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <span className={strong ? 'font-semibold mono' : ''}>{text}</span>
    </span>
  );
}
