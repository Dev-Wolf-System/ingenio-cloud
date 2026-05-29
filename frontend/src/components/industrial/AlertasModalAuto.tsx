'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { useAlertModalBehavior, effectiveSeverity } from '@/lib/hooks/useAlertModalBehavior';
import { normalizeSeverity, SEV_ORDER } from '@/lib/severity';
import { AlertGroup } from './AlertGroup';

interface AlertMeta {
  value?: number;
  min_value?: number;
  max_value?: number;
  unit?: string;
  updated_at?: string;
  normal_since?: string;
  triage?: {
    severidad?: 'info' | 'warn' | 'critical';
    grupo?: string;
    prioridad?: number;
    titular?: string;
    recomendacion?: string;
  };
}

export interface ActiveAlert {
  id: string;
  severity: 'critical' | 'warn' | 'info';
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

const LS_BEEP = 'alert_beep_enabled';
const LS_VOICE = 'alert_voice_enabled';

function getLs(key: string, def: boolean): boolean {
  if (typeof window === 'undefined') return def;
  const v = localStorage.getItem(key);
  return v === null ? def : v === 'true';
}

const severityStyles = {
  critical: {
    badge: 'bg-red-500/20 text-red-400 border border-red-500/30',
    dot: 'bg-red-500',
    icon: <IconAlertCircle size={16} className="text-red-400 flex-shrink-0" />,
    glow: '0 0 40px rgba(239,68,68,0.15)',
    bar: 'bg-red-500',
  },
  warn: {
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
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{min_value ?? '—'}{unit ? ` ${unit}` : ''}</span>
        <span className={`font-bold text-sm ${outOfRange ? 'text-red-400' : 'text-green-400'}`}>
          {value}{unit ? ` ${unit}` : ''}
        </span>
        <span>{max_value ?? '—'}{unit ? ` ${unit}` : ''}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 relative overflow-hidden">
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
  const sev = severityStyles[normalizeSeverity(alert.severity)] ?? severityStyles.info;
  const recomendacion = alert.metadata?.triage?.recomendacion;

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
              <span className={`text-xs lg:text-sm font-semibold uppercase tracking-wider px-1.5 lg:px-2 py-0.5 rounded-md ${sev.badge}`}>
                {alert.severity}
              </span>
              <span className="text-xs lg:text-sm text-gray-500 uppercase tracking-wide">{alert.area}</span>
              <span className="text-xs lg:text-sm text-gray-600 ml-auto">{relativeTime(alert.detected_at)}</span>
            </div>
            <p className="text-base lg:text-lg font-semibold text-white mt-1 leading-tight">{alert.title}</p>
            <p className="text-sm lg:text-base text-gray-400 mt-0.5 leading-snug">{alert.message}</p>
            <ValueBar alert={alert} />
          </div>
        </div>

        {recomendacion && (
          <div className="mt-2.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-[10px] lg:text-xs font-semibold uppercase tracking-wider text-amber-400 mb-0.5">
              Recomendación IA
            </p>
            <p className="text-xs lg:text-sm text-amber-200/80 leading-snug">{recomendacion}</p>
          </div>
        )}

        <button
          onClick={toggle}
          className="mt-2.5 lg:mt-3 w-full flex items-center justify-center gap-1.5 text-sm lg:text-base text-gray-400 hover:text-blue-400 transition-colors py-1 lg:py-1.5 rounded-lg hover:bg-white/5"
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
                <div className="space-y-2.5 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Causa probable</p>
                    <p className="text-gray-300 leading-relaxed">{analisis.causa_probable}</p>
                  </div>
                  {analisis.factores_contribuyentes?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Factores</p>
                      <ul className="space-y-0.5">
                        {analisis.factores_contribuyentes.map((f, i) => (
                          <li key={i} className="text-gray-400 flex gap-1.5"><span className="text-amber-500/60">·</span>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analisis.acciones_sugeridas?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">Acciones</p>
                      <ul className="space-y-0.5">
                        {analisis.acciones_sugeridas.map((a, i) => (
                          <li key={i} className="text-gray-300 flex gap-1.5"><span className="text-green-500">→</span>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analisis.cached && (
                    <p className="text-[10px] text-gray-600 text-right">Análisis en caché · actualiza en 5 min</p>
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

// Agrupar alertas por triage.grupo ?? area, ordenadas por severidad dominante del grupo
function buildGroups(alerts: ActiveAlert[]): { key: string; titular?: string; alerts: ActiveAlert[] }[] {
  const map = new Map<string, { titular?: string; alerts: ActiveAlert[] }>();

  for (const a of alerts) {
    const key = a.metadata?.triage?.grupo ?? a.area;
    if (!map.has(key)) map.set(key, { alerts: [] });
    const entry = map.get(key)!;
    if (!entry.titular && a.metadata?.triage?.titular) entry.titular = a.metadata.triage.titular;
    entry.alerts.push(a);
  }

  // Ordenar alertas dentro de cada grupo por prioridad asc
  // (Array.from: el target ES5 del proyecto no itera Map iterators con for...of)
  Array.from(map.values()).forEach((entry) => {
    entry.alerts.sort(
      (a, b) => (a.metadata?.triage?.prioridad ?? 99) - (b.metadata?.triage?.prioridad ?? 99),
    );
  });

  // Ordenar grupos por severidad dominante del grupo (menor SEV_ORDER = más crítico)
  return Array.from(map.entries())
    .map(([key, val]) => ({ key, ...val }))
    .sort((ga, gb) => {
      const sevA = Math.min(...ga.alerts.map((a) => SEV_ORDER[effectiveSeverity(a)]));
      const sevB = Math.min(...gb.alerts.map((a) => SEV_ORDER[effectiveSeverity(a)]));
      return sevA - sevB;
    });
}

export function AlertasModalAuto({ alerts }: Props) {
  const [beepOn, setBeepOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);

  // Hook de audio — lista COMPLETA (incl. normalizándose) para que el beep/voz de
  // normalización dispare cuando la alerta se resuelve a los 30s.
  const { audioBlocked, enableAudio } = useAlertAudio(alerts);

  // El modal solo muestra alertas alarmando: las que volvieron a rango (normal_since)
  // salen del modal al instante (modal se va si era la única crítica).
  const displayAlerts = alerts.filter((a) => !a.metadata?.normal_since);

  // Hook de comportamiento del modal
  const { isOpen, close, dominant } = useAlertModalBehavior(displayAlerts);

  const sev = severityStyles[dominant] ?? severityStyles.info;

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

  const groups = buildGroups(displayAlerts);

  // Mantener montado mientras haya alertas (incl. normalizándose) para no cortar el
  // audio de normalización; el modal se oculta vía isOpen cuando no quedan alarmando.
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
            onClick={close}
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
                    <h2 className="text-base lg:text-2xl font-bold text-white leading-tight">
                      {displayAlerts.length} {displayAlerts.length === 1 ? 'alerta activa' : 'alertas activas'}
                    </h2>
                    <p className="text-xs lg:text-base text-gray-500">
                      {displayAlerts.filter(a => effectiveSeverity(a) === 'critical').length > 0
                        ? `${displayAlerts.filter(a => effectiveSeverity(a) === 'critical').length} críticas · acción requerida`
                        : 'Revisión recomendada'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={close}
                  className="p-1.5 lg:p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors"
                >
                  <IconX size={16} className="lg:w-5 lg:h-5" />
                </button>
              </div>

              {/* Alert list grouped */}
              <div className="flex-1 overflow-y-auto p-3 lg:p-5 space-y-4 lg:space-y-6 scrollbar-thin scrollbar-thumb-white/10">
                {groups.map((g) => (
                  <AlertGroup
                    key={g.key}
                    titular={g.titular}
                    alerts={g.alerts}
                    renderItem={(a) => <AlertItem key={a.id} alert={a} />}
                  />
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 lg:px-6 py-2.5 lg:py-3.5 border-t border-white/8 flex-shrink-0 bg-white/[0.02]">
                {/* Indicadores de audio */}
                <div className="flex items-center gap-2">
                  {audioBlocked && (beepOn || voiceOn) && (
                    <button
                      onClick={() => { void enableAudio(); }}
                      className="flex items-center gap-1.5 text-[11px] lg:text-sm font-semibold px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors animate-pulse"
                      title="El navegador bloqueó el audio. Tocá una vez para habilitarlo toda la sesión."
                    >
                      <IconVolume size={13} />
                      Activar sonido
                    </button>
                  )}
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
                    onClick={close}
                    title="Configurar audio"
                  >
                    Configurar
                  </Link>
                </div>
                <Link
                  href="/alertas"
                  className="flex items-center gap-1 text-[11px] lg:text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  onClick={close}
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
