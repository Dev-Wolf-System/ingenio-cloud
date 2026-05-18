'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconRobot, IconSparkles, IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import { cn } from '@/lib/utils/cn';

interface AnalisisPayload {
  resumen?: string;
  estado?: 'normal' | 'atencion' | 'critico';
  puntos_clave?: string[];
  mensaje?: string;
  ia_available?: boolean;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

async function fetchAnalisis(): Promise<AnalisisPayload> {
  const res = await fetch(`${apiUrl}/guardia/analisis-ia`);
  if (!res.ok) throw new Error('analisis-ia ' + res.status);
  return res.json();
}

async function forceAnalisis(): Promise<{ ok: boolean; error?: string } & AnalisisPayload> {
  const res = await fetch(`${apiUrl}/guardia/analisis-ia/refresh`, { method: 'POST' });
  return res.json();
}

const ESTADO_STYLE: Record<string, { dot: string; label: string; text: string }> = {
  normal: { dot: 'bg-ok', label: 'NORMAL', text: 'text-ok' },
  atencion: { dot: 'bg-warn', label: 'ATENCIÓN', text: 'text-warn' },
  critico: { dot: 'bg-danger animate-pulse', label: 'CRÍTICO', text: 'text-danger' },
};

export function AnalisisIA() {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['guardia', 'analisis-ia'],
    queryFn: fetchAnalisis,
    staleTime: 60 * 60_000,
  });

  const data = q.data;
  const hasAnalisis = data && !data.mensaje && data.resumen;
  const estado = hasAnalisis ? ESTADO_STYLE[data!.estado!] ?? ESTADO_STYLE.normal : null;
  const iaAvailable = data?.ia_available !== false;

  const onGenerate = async () => {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const result = await forceAnalisis();
      if (result.ok) {
        qc.invalidateQueries({ queryKey: ['guardia', 'analisis-ia'] });
      } else {
        setErrorMsg(result.error ?? 'Error desconocido');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="relative rounded-lg border border-primary-dark/40 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-50"
        style={{
          background:
            'linear-gradient(135deg, var(--primary-soft), var(--accent-soft) 60%, transparent)',
        }}
      />
      <div className="relative px-3 py-2 flex items-center justify-between border-b border-primary-dark/30 bg-bg-card/80">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-primary-soft text-primary-light flex items-center justify-center">
            <IconRobot size={14} />
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] font-display font-semibold text-text-primary">
            Análisis IA · Turno previo
          </span>
        </div>
        <div className="flex items-center gap-2">
          {estado && (
            <span className={cn('inline-flex items-center gap-1 text-2xs font-medium mono', estado.text)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', estado.dot)} />
              {estado.label}
            </span>
          )}
          {iaAvailable && (
            <button
              onClick={onGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1 text-2xs text-text-muted hover:text-primary-light transition-colors px-1.5 py-0.5 rounded hover:bg-bg-hover disabled:opacity-50"
              title="Generar análisis IA ahora"
            >
              <IconRefresh size={11} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Generando…' : 'Generar'}
            </button>
          )}
        </div>
      </div>

      <div className="relative p-3 text-xs">
        {q.isLoading && (
          <div className="text-text-muted italic flex items-center gap-2">
            <IconSparkles size={12} className="animate-pulse" />
            Cargando…
          </div>
        )}

        {generating && (
          <div className="text-primary-light flex items-center gap-2 mb-2">
            <IconSparkles size={12} className="animate-pulse" />
            Pidiendo análisis a OpenAI…
          </div>
        )}

        {errorMsg && (
          <div
            className="flex items-start gap-2 text-danger text-2xs mt-1 p-2 rounded border border-danger/40"
            style={{ background: 'var(--danger-soft)' }}
          >
            <IconAlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!q.isLoading && !hasAnalisis && !generating && !errorMsg && (
          <div className="text-text-muted text-xs space-y-1">
            <div>{data?.mensaje ?? 'Aún sin análisis del turno previo.'}</div>
            {!iaAvailable && (
              <div className="flex items-start gap-2 text-warn text-2xs mt-2 p-2 rounded border border-warn/40">
                <IconAlertCircle size={12} className="mt-0.5 shrink-0" />
                <span>IA deshabilitada: OPENAI_API_KEY no configurada en backend</span>
              </div>
            )}
          </div>
        )}

        {hasAnalisis && (
          <>
            <p className="text-text-secondary leading-relaxed">{data!.resumen}</p>
            {data!.puntos_clave && data!.puntos_clave.length > 0 && (
              <ul className="mt-2 space-y-1">
                {data!.puntos_clave.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-text-muted text-[11px]">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-primary-light shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
