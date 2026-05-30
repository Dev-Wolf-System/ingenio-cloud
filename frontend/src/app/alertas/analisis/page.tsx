'use client';

import Link from 'next/link';
import { IconArrowLeft, IconLoader2 } from '@tabler/icons-react';
import { TopBar } from '@/components/layout/TopBar';
import { useAnalisis } from './_hooks/useAnalisis';
import { useHistorial } from './_hooks/useHistorial';
import { PeriodSelector } from './_components/PeriodSelector';
import { KpiRow } from './_components/KpiRow';
import { InsightCard } from './_components/InsightCard';
import { ComparativaTurnos } from './_components/ComparativaTurnos';
import { TendenciaDiaria } from './_components/TendenciaDiaria';
import { TopSensores } from './_components/TopSensores';
import { Heatmap } from './_components/Heatmap';
import { Correlaciones } from './_components/Correlaciones';
import { AlertasParadas } from './_components/AlertasParadas';
import { HistorialTabla } from './_components/HistorialTabla';

export default function AnalisisPage() {
  const {
    periodo,
    setPeriodo,
    offset,
    stepBack,
    stepForward,
    data,
    loading,
    regenerar,
  } = useAnalisis();

  const {
    history,
    historyTotal,
    historyLoading,
    historyPage,
    setHistoryPage,
    historyPageCount,
    reloadHistory,
  } = useHistorial();

  return (
    <div className="min-h-screen relative">
      {/* Background gradient — industrial dark */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,212,255,0.06), transparent 70%)',
        }}
      />

      <div className="relative z-10">
        <TopBar plant="Sala de Monitoreo · Análisis de Alertas" />

        <main className="px-3 sm:px-4 py-3 sm:py-4 max-w-[1600px] mx-auto space-y-3 sm:space-y-4">
          {/* Header row: breadcrumbs + period selector */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-primary-light transition-colors px-3 py-1.5 rounded-md hover:bg-bg-hover border border-transparent hover:border-border"
              >
                <IconArrowLeft size={13} />
                Dashboard
              </Link>
              <span className="text-text-muted opacity-40 text-xs">/</span>
              <Link
                href="/alertas"
                className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-primary-light transition-colors px-3 py-1.5 rounded-md hover:bg-bg-hover border border-transparent hover:border-border"
              >
                <IconArrowLeft size={13} />
                Configuración de alertas
              </Link>
            </div>

            <PeriodSelector
              periodo={periodo}
              offset={offset}
              onPeriodo={setPeriodo}
              onStepBack={stepBack}
              onStepForward={stepForward}
              etiqueta={data?.rango.etiqueta ?? ''}
            />
          </header>

          {/* Loading state */}
          {loading && !data && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(0,212,255,0.10)',
                  border: '1px solid rgba(0,212,255,0.28)',
                  boxShadow: '0 0 24px rgba(0,212,255,0.18)',
                }}
              >
                <IconLoader2
                  size={24}
                  className="animate-spin"
                  style={{ color: '#00D4FF' }}
                />
              </div>
              <p className="text-sm font-medium" style={{ color: '#6B7A9E' }}>
                Cargando análisis…
              </p>
            </div>
          )}

          {/* Content sections — only render when data is present */}
          {data && (
            <>
              <KpiRow
                kpis={data.kpis}
                reliabilidad={data.reliabilidad}
                comparativa={data.comparativa}
              />

              <InsightCard
                insight={data.insight}
                loading={loading}
                onRegenerar={regenerar}
              />

              <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
                <ComparativaTurnos
                  porTurno={data.series.por_turno}
                  comparativa={data.comparativa}
                />
                <TendenciaDiaria porDia={data.series.por_dia} />
              </div>

              <TopSensores sensores={data.sensores} />

              <Heatmap heatmap={data.series.heatmap} />

              <Correlaciones correlaciones={data.correlaciones} />

              <AlertasParadas paradas={data.paradas} />
            </>
          )}

          {/* Historial always visible (loads independently) */}
          <HistorialTabla
            history={history}
            historyTotal={historyTotal}
            historyLoading={historyLoading}
            reloadHistory={reloadHistory}
            historyPage={historyPage}
            setHistoryPage={setHistoryPage}
            historyPageCount={historyPageCount}
          />
        </main>
      </div>
    </div>
  );
}
