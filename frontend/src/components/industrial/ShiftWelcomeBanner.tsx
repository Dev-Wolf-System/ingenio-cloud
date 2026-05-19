'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  IconSun,
  IconSunset2,
  IconMoon,
  IconSparkles,
  IconX,
  IconChevronRight,
} from '@tabler/icons-react';
import { AnimatePresence, m } from 'motion/react';
import { useShift } from '@/lib/hooks/useShift';
import { formatNumber } from '@/lib/utils/format';

const STORAGE_KEY = 'ingcloud:shift-greeted';
const WINDOW_MIN = 30; // mostrar solo dentro de primeros 30 min del turno

async function fetchGuardia(path: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/guardia/${path}`);
  if (!res.ok) return null;
  return res.json();
}

function greetingFor(name: 'morning' | 'afternoon' | 'night'): { saludo: string; icon: React.ReactNode } {
  switch (name) {
    case 'morning':
      return { saludo: 'Buenos días', icon: <IconSun size={26} /> };
    case 'afternoon':
      return { saludo: 'Buenas tardes', icon: <IconSunset2 size={26} /> };
    case 'night':
      return { saludo: 'Buenas noches', icon: <IconMoon size={26} /> };
  }
}

export function ShiftWelcomeBanner() {
  const shift = useShift();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [shiftKey, setShiftKey] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determinar si mostrar (dentro ventana 30 min + no greeted antes)
  useEffect(() => {
    if (!mounted) return;
    const minutesElapsed = shift.elapsedMinutes;
    if (minutesElapsed > WINDOW_MIN) {
      setVisible(false);
      return;
    }
    const todayISO = new Date().toISOString().slice(0, 10);
    const key = `${todayISO}:${shift.name}`;
    setShiftKey(key);
    try {
      const greeted = window.localStorage.getItem(`${STORAGE_KEY}:${key}`);
      if (!greeted) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [mounted, shift.elapsedMinutes, shift.name]);

  const resumen = useQuery({
    queryKey: ['guardia', 'turno-previo'],
    queryFn: () => fetchGuardia('turno-previo'),
    enabled: visible,
    staleTime: 5 * 60_000,
  });

  const ia = useQuery({
    queryKey: ['guardia', 'analisis-ia'],
    queryFn: () => fetchGuardia('analisis-ia'),
    enabled: visible,
    staleTime: 5 * 60_000,
  });

  const dismiss = () => {
    try {
      window.localStorage.setItem(`${STORAGE_KEY}:${shiftKey}`, String(Date.now()));
    } catch {}
    setVisible(false);
  };

  if (!mounted) return null;

  const greeting = greetingFor(shift.name);
  const resumenData = resumen.data as
    | {
        turno?: string | null;
        molienda_avg_t_h?: number | null;
        gas_total_m3?: number | null;
        gas_avg_m3_h?: number | null;
        paradas_count?: number | null;
        paradas_minutos?: number | null;
      }
    | null
    | undefined;

  const iaData = ia.data as
    | {
        resumen?: string;
        estado?: 'normal' | 'atencion' | 'critico';
        puntos_clave?: string[];
        mensaje?: string;
        ia_available?: boolean;
      }
    | null
    | undefined;
  const hasIA = !!iaData?.resumen;
  const iaUnavailable = iaData?.ia_available === false;

  const estadoColor = {
    normal: 'var(--ok)',
    atencion: 'var(--warn)',
    critico: 'var(--danger)',
  }[iaData?.estado ?? 'normal'];

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={dismiss}
        >
          <m.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative w-full max-w-2xl rounded-2xl overflow-hidden border-2"
            style={{
              background:
                'var(--panel-mesh-1), var(--panel-mesh-2), linear-gradient(135deg, var(--surface-panel-from), var(--surface-panel-to))',
              borderColor: 'var(--border-strong)',
              boxShadow: 'var(--panel-shadow), 0 40px 120px rgba(0,0,0,0.45)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top accent line */}
            <div
              aria-hidden
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: 'var(--panel-accent-line)' }}
            />

            {/* Cerrar */}
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary z-10"
              aria-label="Cerrar"
            >
              <IconX size={16} />
            </button>

            <div className="p-6 sm:p-8">
              {/* Header saludo */}
              <div className="flex items-start gap-4 mb-5">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border border-primary-light/20"
                  style={{
                    background: 'var(--icon-box-bg)',
                    color: 'var(--primary-light)',
                    boxShadow: '0 0 24px var(--primary-glow)',
                  }}
                >
                  {greeting.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2
                    className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--primary-light) 0%, var(--text-primary) 60%, var(--accent) 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {greeting.saludo}, equipo
                  </h2>
                  <p className="text-sm text-text-secondary mt-1">
                    Comienza el <span className="font-semibold text-text-primary">{shift.displayName}</span>.
                    Resumen del turno anterior:
                  </p>
                </div>
              </div>

              {/* Mini grid KPIs turno previo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                <MiniKpi
                  label="Molienda prom"
                  value={
                    resumenData?.molienda_avg_t_h != null
                      ? `${formatNumber(resumenData.molienda_avg_t_h, 1)} t/h`
                      : '—'
                  }
                />
                <MiniKpi
                  label="Gas total"
                  value={
                    resumenData?.gas_total_m3 != null
                      ? `${formatNumber(resumenData.gas_total_m3, 0)} m³`
                      : '—'
                  }
                />
                <MiniKpi
                  label="Paradas"
                  value={
                    resumenData?.paradas_count != null
                      ? `${resumenData.paradas_count} evt`
                      : '—'
                  }
                />
                <MiniKpi
                  label="Tiempo paro"
                  value={
                    resumenData?.paradas_minutos != null
                      ? `${formatNumber(resumenData.paradas_minutos, 0)} min`
                      : '—'
                  }
                />
              </div>

              {/* Análisis IA — consume mismo endpoint que panel ShiftSummary */}
              {hasIA && (
                <div
                  className="rounded-xl p-4 border"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: estadoColor,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <IconSparkles size={14} style={{ color: estadoColor }} />
                    <span
                      className="text-2xs uppercase tracking-wider font-semibold"
                      style={{ color: estadoColor }}
                    >
                      Análisis IA · Estado {iaData!.estado ?? '—'}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary leading-relaxed">{iaData!.resumen}</p>
                  {iaData!.puntos_clave && iaData!.puntos_clave.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {iaData!.puntos_clave.slice(0, 4).map((p, i) => (
                        <li
                          key={i}
                          className="text-xs text-text-secondary flex gap-2 items-start"
                        >
                          <span style={{ color: estadoColor }} className="mt-0.5">▸</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {!hasIA && !ia.isLoading && (
                <div
                  className="rounded-xl p-3 border"
                  style={{
                    background: iaUnavailable ? 'var(--warn-soft)' : 'var(--bg-card)',
                    borderColor: iaUnavailable ? 'var(--warn)' : 'var(--border-subtle)',
                  }}
                >
                  <div className="text-xs text-text-secondary text-center">
                    {iaUnavailable
                      ? '⚠️ IA deshabilitada — OPENAI_API_KEY no configurada en backend'
                      : iaData?.mensaje ?? 'Sin análisis IA disponible para el turno anterior'}
                  </div>
                </div>
              )}

              {/* Footer acción */}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={dismiss}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg border-2 transition-all hover:scale-[1.02]"
                  style={{
                    background: 'var(--primary-soft)',
                    borderColor: 'var(--primary)',
                    color: 'var(--primary-light)',
                    boxShadow: '0 0 18px var(--primary-glow)',
                  }}
                >
                  Comenzar {shift.displayName}
                  <IconChevronRight size={16} />
                </button>
              </div>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg p-2.5 border"
      style={{
        background: 'var(--surface-tile-from)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
        {label}
      </div>
      <div className="text-lg font-semibold mono text-text-primary tabular-nums mt-0.5 leading-none">
        {value}
      </div>
    </div>
  );
}
