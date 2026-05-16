'use client';

import { useQuery } from '@tanstack/react-query';
import { IconRobot, IconSparkles } from '@tabler/icons-react';
import { cn } from '@/lib/utils/cn';

interface AnalisisPayload {
  resumen: string;
  estado: 'normal' | 'atencion' | 'critico';
  puntos_clave: string[];
  mensaje?: string;
}

async function fetchAnalisis(): Promise<AnalisisPayload> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/guardia/analisis-ia`);
  if (!res.ok) throw new Error('analisis-ia ' + res.status);
  return res.json();
}

const ESTADO_STYLE: Record<string, { dot: string; label: string; text: string }> = {
  normal: { dot: 'bg-ok', label: 'NORMAL', text: 'text-ok' },
  atencion: { dot: 'bg-warn', label: 'ATENCIÓN', text: 'text-warn' },
  critico: { dot: 'bg-danger animate-pulse', label: 'CRÍTICO', text: 'text-danger' },
};

export function AnalisisIA() {
  const q = useQuery({
    queryKey: ['guardia', 'analisis-ia'],
    queryFn: fetchAnalisis,
    staleTime: 60 * 60_000,
  });

  const data = q.data;
  const hasAnalisis = data && !data.mensaje && data.resumen;
  const estado = hasAnalisis ? ESTADO_STYLE[data.estado] ?? ESTADO_STYLE.normal : null;

  return (
    <div className="relative rounded-lg border border-primary-dark/40 overflow-hidden">
      {/* Gradient ambient */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-50"
        style={{
          background:
            'linear-gradient(135deg, rgba(46,122,181,0.12), rgba(79,191,229,0.06) 60%, transparent)',
        }}
      />
      {/* Header */}
      <div className="relative px-3 py-2 flex items-center justify-between border-b border-primary-dark/30 bg-bg-card/80">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-primary-soft text-primary-light flex items-center justify-center">
            <IconRobot size={14} />
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] font-display font-semibold text-text-primary">
            Análisis IA · Turno previo
          </span>
        </div>
        {estado && (
          <span className={cn('inline-flex items-center gap-1 text-2xs font-medium mono', estado.text)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', estado.dot)} />
            {estado.label}
          </span>
        )}
      </div>

      <div className="relative p-3 text-xs">
        {q.isLoading && (
          <div className="text-text-muted italic flex items-center gap-2">
            <IconSparkles size={12} className="animate-pulse" />
            Generando análisis...
          </div>
        )}
        {!q.isLoading && !hasAnalisis && (
          <div className="text-text-muted">
            {data?.mensaje ?? 'Aún sin análisis del turno previo.'}
          </div>
        )}
        {hasAnalisis && (
          <>
            <p className="text-text-secondary leading-relaxed">{data.resumen}</p>
            {data.puntos_clave && data.puntos_clave.length > 0 && (
              <ul className="mt-2 space-y-1">
                {data.puntos_clave.map((p, i) => (
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
