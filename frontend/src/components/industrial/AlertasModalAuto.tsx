'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  IconAlertTriangle,
  IconAlertCircle,
  IconInfoCircle,
  IconX,
  IconRobot,
  IconLoader2,
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconBell,
  IconBellOff,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAlertAudio } from '@/lib/hooks/useAlertAudio';

const REDISPLAY_MS = 5 * 60_000; // 5 min

interface AlertMeta {
  value?: number;
  min_value?: number;
  max_value?: number;
  unit?: string;
  updated_at?: string;
}

export interface ActiveAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  area: string;
  title: string;
  message: string;
  metadata?: AlertMeta;
  detected_at: string;
}

interface AnalisisCausa {
  causa_probable: string;
  factores_contribuyentes: string[];
  acciones_sugeridas: string[];
  cached?: boolean;
}

interface Props {
  alerts: ActiveAlert[];
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

const severityStyles = {
  critical: {
    badge: 'bg-red-500/20 text-red-400 border border-red-500/30',
    dot: 'bg-red-500',
    icon: <IconAlertCircle size={16} className="text-red-400 flex-shrink-0" />,
    glow: '0 0 40px rgba(239,68,68,0.15)',
    bar: 'bg-red-500',
  },
  warning: {
    badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    dot: 'bg-amber-500',
    icon: <IconAlertTriangle size={16} className="text-amber-400 flex-shrink-0" />,
    glow: '0 0 40px rgba(245,158,11,0.15)',
    bar: 'bg-amber-500',
  },
  info: {
    badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    dot: 'bg-blue-500',
    icon: <IconInfoCircle size={16} className="text-blue-400 flex-shrink-0" />,
    glow: '0 0 40px rgba(59,130,246,0.12)',
    bar: 'bg-blue-500',
  },
};

function relativeTime(isoStr: string): string {
  const diff = Math.round((Date.now() - new Date(isoStr).getTime()) / 60_000);
  if (diff < 1) return 'ahora';
  if (diff < 60) return `hace ${diff} min`;
  return `hace ${Math.round(diff / 60)} h`;
}

function ValueBar({ alert }: { alert: ActiveAlert }) {
  const { value, min_value, max_value, unit } = alert.metadata ?? {};
  if (value == null || (min_value == null && max_value == null)) return null;
  const min = min_value ?? 0;
  const max = max_value ?? value * 1.5;
  const pct = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  const outOfRange = value < (min_value ?? -Infinity) || value > (max_value ?? Infinity);
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
        <span>{min_value ?? '—'}{unit ? ` ${unit}` : ''}</span>
        <span className={`font-semibold text-xs ${outOfRange ? 'text-red-400' : 'text-green-400'}`}>
          {value}{unit ? ` ${unit}` : ''}
        </span>
        <span>{max_value ?? '—'}{unit ? ` ${unit}` : ''}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 relative overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${outOfRange ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
        {min_value != null && (
          <div className="absolute top-0 h-full w-px bg-green-500/50" style={{ left: '0%' }} />
        )}
        {max_value != null && (
          <div className="absolute top-0 h-full w-px bg-green-500/50" style={{ left: '100%' }} />
        )}
      </div>
    </div>
  );
}

function AlertItem({ alert }: { alert: ActiveAlert }) {
  const [expanded, setExpanded] = useState(false);
  const [analisis, setAnalisis] = useState<AnalisisCausa | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sev = severityStyles[alert.severity] ?? severityStyles.info;

  const fetchAnalisis = useCallback(async () => {
    if (analisis || loading) return;
    setLoading(true);
    setError(false);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
      const res = await fetch(`${apiUrl}/alerts/${alert.id}/analisis-causa`);
      if (!res.ok) throw new Error('fail');
      const data = await res.json() as AnalisisCausa;
      setAnalisis(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [alert.id, analisis, loading]);

  const toggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next && !analisis && !loading) fetchAnalisis();
  }, [expanded, analisis, loading, fetchAnalisis]);

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors overflow-hidden">
      <div className="p-3 lg:p-4">
        <div className="flex items-start gap-2.5 lg:gap-3">
          <div className="mt-0.5 lg:w-5 lg:h-5 flex-shrink-0">{sev.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] lg:text-xs font-semibold uppercase tracking-wider px-1.5 lg:px-2 py-0.5 rounded-md ${sev.badge}`}>
                {alert.severity}
              </span>
              <span className="text-[10px] lg:text-xs text-gray-500 uppercase tracking-wide">{alert.area}</span>
              <span className="text-[10px] lg:text-xs text-gray-600 ml-auto">{relativeTime(alert.detected_at)}</span>
            </div>
            <p className="text-sm lg:text-base font-semibold text-white mt-1 leading-tight">{alert.title}</p>
            <p className="text-xs lg:text-sm text-gray-400 mt-0.5 leading-snug">{alert.message}</p>
            <ValueBar alert={alert} />
          </div>
        </div>

        <button
          onClick={toggle}
          className="mt-2.5 lg:mt-3 w-full flex items-center justify-center gap-1.5 text-xs lg:text-sm text-gray-400 hover:text-blue-400 transition-colors py-1 lg:py-1.5 rounded-lg hover:bg-white/5"
        >
          <IconRobot size={12} />
          {expanded ? 'Ocultar análisis IA' : 'Analizar causa con IA'}
          {expanded ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5 bg-blue-950/20 p-3">
              {loading && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <IconLoader2 size={14} className="animate-spin text-blue-400" />
                  Analizando con IA...
                </div>
              )}
              {error && (
                <p className="text-xs text-red-400">No se pudo obtener el análisis. Intentá de nuevo.</p>
              )}
              {analisis && !loading && (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">Causa probable</p>
                    <p className="text-gray-300 leading-relaxed">{analisis.causa_probable}</p>
                  </div>
                  {analisis.factores_contribuyentes?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">Factores</p>
                      <ul className="space-y-0.5">
                        {analisis.factores_contribuyentes.map((f, i) => (
                          <li key={i} className="text-gray-400 flex gap-1.5"><span className="text-amber-500/60">·</span>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analisis.acciones_sugeridas?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-1">Acciones</p>
                      <ul className="space-y-0.5">
                        {analisis.acciones_sugeridas.map((a, i) => (
                          <li key={i} className="text-gray-300 flex gap-1.5"><span className="text-green-500">→</span>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analisis.cached && (
                    <p className="text-[9px] text-gray-600 text-right">Análisis en caché · actualiza en 5 min</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const LS_MODAL = 'alert_modal_enabled';
const LS_BEEP = 'alert_beep_enabled';
const LS_VOICE = 'alert_voice_enabled';

function getLs(key: string, def: boolean): boolean {
  if (typeof window === 'undefined') return def;
  const v = localStorage.getItem(key);
  return v === null ? def : v === 'true';
}

export function AlertasModalAuto({ alerts }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [beepOn, setBeepOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const dismissedAtRef = useRef<number | null>(null);
  const redisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hook de audio
  useAlertAudio(alerts);

  // Leer estado de toggles al montar
  useEffect(() => {
    setBeepOn(getLs(LS_BEEP, true));
    setVoiceOn(getLs(LS_VOICE, false));
  }, []);

  // Escuchar cambios de localStorage desde la página de config
  useEffect(() => {
    const handler = () => {
      setBeepOn(getLs(LS_BEEP, true));
      setVoiceOn(getLs(LS_VOICE, false));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const sorted = [...alerts].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );

  const dominantSev = sorted[0]?.severity ?? 'info';
  const sev = severityStyles[dominantSev] ?? severityStyles.info;

  const openModal = useCallback(() => {
    setIsOpen(true);
    dismissedAtRef.current = null;
    if (redisplayTimerRef.current) clearTimeout(redisplayTimerRef.current);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    if (alerts.length > 0) {
      dismissedAtRef.current = Date.now();
      redisplayTimerRef.current = setTimeout(() => {
        if (alerts.length > 0) openModal();
      }, REDISPLAY_MS);
    }
  }, [alerts.length, openModal]);

  // Detectar alertas nuevas
  useEffect(() => {
    const currentIds = new Set(alerts.map((a) => a.id));

    if (alerts.length === 0) {
      setIsOpen(false);
      dismissedAtRef.current = null;
      if (redisplayTimerRef.current) clearTimeout(redisplayTimerRef.current);
      prevIdsRef.current = currentIds;
      return;
    }

    const nuevas = alerts.filter((a) => !prevIdsRef.current.has(a.id));
    if (nuevas.length > 0 && dismissedAtRef.current === null) {
      // Solo abrir modal si el toggle modal está ON
      if (getLs(LS_MODAL, true)) {
        openModal();
      }
    }

    prevIdsRef.current = currentIds;
  }, [alerts, openModal]);

  // Cleanup timer al desmontar
  useEffect(() => {
    return () => {
      if (redisplayTimerRef.current) clearTimeout(redisplayTimerRef.current);
    };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={closeModal}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-[#0F1623] overflow-hidden"
              style={{ boxShadow: `0 24px 64px rgba(0,0,0,0.5), ${sev.glow}` }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4 border-b border-white/8 flex-shrink-0">
                <div className="flex items-center gap-2.5 lg:gap-3">
                  <div className="relative flex items-center justify-center">
                    <span className={`absolute w-5 lg:w-7 h-5 lg:h-7 rounded-full ${sev.dot} opacity-30 animate-ping`} />
                    <span className={`w-2.5 lg:w-3.5 h-2.5 lg:h-3.5 rounded-full ${sev.dot}`} />
                  </div>
                  <div>
                    <h2 className="text-sm lg:text-xl font-bold text-white leading-tight">
                      {alerts.length} {alerts.length === 1 ? 'alerta activa' : 'alertas activas'}
                    </h2>
                    <p className="text-[10px] lg:text-sm text-gray-500">
                      {alerts.filter(a => a.severity === 'critical').length > 0
                        ? `${alerts.filter(a => a.severity === 'critical').length} críticas · acción requerida`
                        : 'Revisión recomendada'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1.5 lg:p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors"
                >
                  <IconX size={16} className="lg:w-5 lg:h-5" />
                </button>
              </div>

              {/* Alert list */}
              <div className="flex-1 overflow-y-auto p-3 lg:p-5 space-y-2 lg:space-y-3 scrollbar-thin scrollbar-thumb-white/10">
                {sorted.map((alert) => (
                  <AlertItem key={alert.id} alert={alert} />
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 lg:px-6 py-2.5 lg:py-3.5 border-t border-white/8 flex-shrink-0 bg-white/[0.02]">
                {/* Indicadores de audio */}
                <div className="flex items-center gap-2">
                  <span title={beepOn ? 'Beep activo' : 'Beep desactivado'}>
                    {beepOn
                      ? <IconBell size={13} className="text-gray-500" />
                      : <IconBellOff size={13} className="text-gray-700" />}
                  </span>
                  <span title={voiceOn ? 'Voz activa' : 'Voz desactivada'}>
                    {voiceOn
                      ? <IconVolume size={13} className="text-gray-500" />
                      : <IconVolumeOff size={13} className="text-gray-700" />}
                  </span>
                  <Link
                    href="/alertas"
                    className="text-[10px] lg:text-[11px] text-gray-700 hover:text-gray-500 transition-colors"
                    onClick={closeModal}
                    title="Configurar audio"
                  >
                    Configurar
                  </Link>
                </div>
                <Link
                  href="/alertas"
                  className="flex items-center gap-1 text-[11px] lg:text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  onClick={closeModal}
                >
                  Ver historial <IconExternalLink size={11} className="lg:w-3.5 lg:h-3.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
