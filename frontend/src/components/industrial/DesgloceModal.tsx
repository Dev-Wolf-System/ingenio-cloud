'use client';

import { AnimatePresence, m } from 'motion/react';
import { IconX } from '@tabler/icons-react';
import { formatNumber } from '@/lib/utils/format';

export interface DesgloceRow {
  label: string;
  value: number | null;
  unit?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  rows: DesgloceRow[];
  totalLabel?: string;
  total?: number | null;
  totalUnit?: string;
  precision?: number;
  accentVar?: string;
}

export function DesgloceModal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  rows,
  totalLabel,
  total,
  totalUnit,
  precision = 2,
  accentVar = 'var(--warn)',
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <m.div
            initial={{ y: 32, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="relative w-full max-w-sm rounded-2xl overflow-hidden border-2 flex flex-col"
            style={{
              background:
                'var(--panel-mesh-1), var(--panel-mesh-2), linear-gradient(135deg, var(--surface-panel-from), var(--surface-panel-to))',
              borderColor: 'var(--border-strong)',
              boxShadow: 'var(--panel-shadow), 0 40px 80px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              aria-hidden
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: `linear-gradient(90deg, ${accentVar}, var(--primary))` }}
            />

            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary z-10"
              aria-label="Cerrar"
            >
              <IconX size={16} />
            </button>

            {/* Header */}
            <div className="p-5 pb-3 flex items-center gap-3">
              {icon && (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    background: 'color-mix(in srgb, currentColor 10%, transparent)',
                    borderColor: accentVar,
                    color: accentVar,
                  }}
                >
                  {icon}
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold tracking-tight text-text-primary">{title}</h2>
                {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
              </div>
            </div>

            {/* Rows */}
            <div className="px-5 pb-5 space-y-2">
              {rows.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl px-4 py-3 border border-border bg-bg-card"
                >
                  <span className="text-sm text-text-secondary font-medium">{row.label}</span>
                  <span className="mono text-base font-bold tabular-nums" style={{ color: accentVar }}>
                    {row.value != null ? formatNumber(row.value, precision) : '—'}
                    {row.unit && (
                      <span className="text-xs text-text-muted font-normal ml-1">{row.unit}</span>
                    )}
                  </span>
                </div>
              ))}

              {totalLabel != null && (
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3 border-2 mt-1"
                  style={{ borderColor: accentVar, background: 'color-mix(in srgb, currentColor 6%, transparent)' }}
                >
                  <span className="text-sm font-bold text-text-primary uppercase tracking-wide">{totalLabel}</span>
                  <span
                    className="mono text-xl font-bold tabular-nums"
                    style={{ color: accentVar }}
                  >
                    {total != null ? formatNumber(total, precision) : '—'}
                    {totalUnit && (
                      <span className="text-xs text-text-muted font-normal ml-1">{totalUnit}</span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
