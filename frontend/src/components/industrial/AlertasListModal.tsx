'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { IconX, IconAlertTriangle } from '@tabler/icons-react';
import { AlertGroup } from './AlertGroup';
import type { ActiveAlert } from './AlertasModalAuto';
import { normalizeSeverity, SEV_ORDER, type Severity } from '@/lib/severity';

interface AlertasListModalProps {
  open: boolean;
  onClose: () => void;
  alerts: ActiveAlert[];
}

// Orden de severidad (más crítica primero), derivado de SEV_ORDER.
const SEVERIDADES_ORDENADAS = (Object.keys(SEV_ORDER) as Severity[]).sort(
  (a, b) => SEV_ORDER[a] - SEV_ORDER[b]
);

export function AlertasListModal({ open, onClose, alerts }: AlertasListModalProps) {
  const grouped = SEVERIDADES_ORDENADAS.map((sev) => ({
    sev,
    items: alerts.filter((a) => normalizeSeverity(a.severity) === sev),
  })).filter((g) => g.items.length > 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl border"
            style={{ background: 'var(--bg-surface, #111827)', borderColor: 'var(--border, #1E3A5F)' }}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
          >
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border, #1E3A5F)', background: 'var(--bg-surface, #111827)' }}>
              <div className="flex items-center gap-2">
                <IconAlertTriangle size={16} className="text-warn" />
                <h2 className="text-sm font-semibold text-text-primary">Alertas activas ({alerts.length})</h2>
              </div>
              <button onClick={onClose} className="p-1 rounded hover:bg-white/5" aria-label="Cerrar">
                <IconX size={16} className="text-text-muted" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {grouped.length === 0 && (
                <p className="text-sm text-text-muted text-center py-6">Sin alertas activas</p>
              )}
              {grouped.map(({ sev, items }) => (
                <AlertGroup
                  key={sev}
                  titular={sev}
                  alerts={items}
                  renderItem={(a) => (
                    <div
                      key={a.id}
                      className="rounded-lg border p-3 text-sm"
                      style={{ borderColor: 'var(--border, #1E3A5F)', background: 'var(--bg-card, #1A2236)' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-text-primary truncate">{a.title}</p>
                        <span className="text-xs text-text-muted uppercase tracking-wide flex-shrink-0">{a.area}</span>
                      </div>
                      {a.detected_at && (
                        <p className="text-xs text-text-muted mt-1">
                          Desde {new Date(a.detected_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  )}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
