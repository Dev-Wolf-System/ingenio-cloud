'use client';

import {
  IconBrain,
  IconRefresh,
  IconStar,
  IconBulb,
  IconAlertCircle,
} from '@tabler/icons-react';
import type { Insight } from '../_types';
import { C } from './chart-kit';

// ── skeleton ──────────────────────────────────────────────────────────────────

function SkeletonLine({ w = '100%' }: { w?: string }) {
  return (
    <div
      className="h-3 rounded animate-pulse"
      style={{ width: w, background: 'rgba(255,255,255,0.07)' }}
    />
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export function InsightCard({
  insight,
  loading,
  onRegenerar,
}: {
  insight: Insight | null;
  loading?: boolean;
  onRegenerar: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: 'rgba(0,212,255,0.04)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(0,212,255,0.22)',
        boxShadow: '0 0 32px rgba(0,212,255,0.08), 0 8px 32px rgba(0,0,0,0.30)',
      }}
    >
      {/* ── header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(0,212,255,0.14)',
              border: '1px solid rgba(0,212,255,0.35)',
              boxShadow: '0 0 14px rgba(0,212,255,0.20)',
            }}
          >
            <IconBrain size={17} style={{ color: C.cyan }} />
          </div>
          <div>
            <h3
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: C.cyan }}
            >
              Insight del período
            </h3>
            {insight?.generado_at && !loading && (
              <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                {new Date(insight.generado_at).toLocaleString('es-AR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {insight?.cached && !loading && (
            <span
              className="text-xs uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: 'rgba(255,184,0,0.12)',
                border: '1px solid rgba(255,184,0,0.30)',
                color: C.amber,
              }}
            >
              En caché
            </span>
          )}
          <button
            onClick={onRegenerar}
            disabled={!!loading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200"
            style={{
              background: loading ? 'rgba(0,212,255,0.06)' : 'rgba(0,212,255,0.12)',
              borderColor: 'rgba(0,212,255,0.35)',
              color: C.cyan,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <IconRefresh size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Analizando…' : 'Regenerar'}
          </button>
        </div>
      </div>

      {/* ── body: loading skeleton ── */}
      {loading && (
        <div className="flex flex-col gap-3">
          <SkeletonLine />
          <SkeletonLine w="85%" />
          <SkeletonLine w="70%" />
          <div className="flex gap-2 flex-wrap mt-1">
            {[80, 120, 100, 90].map((w, i) => (
              <div
                key={i}
                className="h-5 rounded-full animate-pulse"
                style={{ width: w, background: 'rgba(255,255,255,0.07)' }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── body: null / no insight ── */}
      {!loading && !insight && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: 'rgba(107,122,158,0.08)',
            border: `1px solid ${C.border}`,
          }}
        >
          <IconAlertCircle size={18} style={{ color: C.muted }} />
          <p className="text-sm" style={{ color: C.muted }}>
            Análisis IA no disponible para este período.
          </p>
        </div>
      )}

      {/* ── body: insight data ── */}
      {!loading && insight && (
        <div className="flex flex-col gap-4">
          {/* Resumen */}
          {insight.resumen && (
            <p className="text-sm lg:text-base leading-relaxed" style={{ color: '#D0D8F0' }}>
              {insight.resumen}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Patrones */}
            {insight.patrones.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <IconStar size={13} style={{ color: C.amber }} />
                  <span
                    className="text-xs uppercase tracking-[0.18em] font-semibold"
                    style={{ color: C.amber }}
                  >
                    Patrones detectados
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {insight.patrones.map((p, i) => (
                    <span
                      key={i}
                      className="text-sm px-2.5 py-1 rounded-full"
                      style={{
                        background: 'rgba(255,184,0,0.10)',
                        border: '1px solid rgba(255,184,0,0.25)',
                        color: '#E8D08A',
                      }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendaciones */}
            {insight.recomendaciones.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <IconBulb size={13} style={{ color: C.green }} />
                  <span
                    className="text-xs uppercase tracking-[0.18em] font-semibold"
                    style={{ color: C.green }}
                  >
                    Recomendaciones
                  </span>
                </div>
                <ol className="space-y-2">
                  {insight.recomendaciones.map((r, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: 'rgba(0,229,160,0.12)',
                          border: '1px solid rgba(0,229,160,0.28)',
                          color: C.green,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm leading-relaxed" style={{ color: '#B0BACE' }}>
                        {r}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
