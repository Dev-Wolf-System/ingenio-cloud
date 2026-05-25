'use client';

import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react';
import { formatNumber } from '@/lib/utils/format';

interface Punto {
  label: string;
  molienda_t: number | null;
  acumulado_t: number;
}

interface SerieLike {
  puntos: Punto[];
  stats: {
    acumulado_t: number;
    max_t: number;
    min_t: number;
    promedio_t: number;
    tendencia_pct: number;
  };
}

export interface BloquesKpiStatsProps {
  zafra?: SerieLike;
  turnoActual?: SerieLike;
  /** 't' para molienda, 'm³' para gas */
  unidad: string;
  /** 'best'=verde el max (molienda); 'worst'=rojo el max (gas) */
  modo: 'best' | 'worst';
  /** Color principal accent (var CSS) */
  accentVar: string;
}

export function BloquesKpiStats({
  zafra,
  turnoActual,
  unidad,
  modo,
  accentVar,
}: BloquesKpiStatsProps) {
  // Acumulado zafra + cantidad días
  const acumZafra = zafra?.stats.acumulado_t ?? 0;
  const diasZafra = zafra?.puntos.filter((p) => p.molienda_t != null && p.molienda_t > 0).length ?? 0;

  // Promedio diario
  const promDiario = diasZafra > 0 ? acumZafra / diasZafra : 0;

  // Promedio últimos 7 vs 7 anteriores → delta % sem
  const puntos = zafra?.puntos.filter((p) => p.molienda_t != null && p.molienda_t > 0) ?? [];
  const last7 = puntos.slice(-7);
  const prev7 = puntos.slice(-14, -7);
  const avgLast = last7.length ? last7.reduce((a, b) => a + (b.molienda_t ?? 0), 0) / last7.length : 0;
  const avgPrev = prev7.length ? prev7.reduce((a, b) => a + (b.molienda_t ?? 0), 0) / prev7.length : 0;
  const deltaSem = avgPrev > 0 ? ((avgLast - avgPrev) / avgPrev) * 100 : 0;

  // Mejor/Peor día de la zafra — siempre tomar MAX
  // (mejor molienda = más producción · peor gas = más consumo)
  const ordenados = [...puntos].sort((a, b) => (b.molienda_t ?? 0) - (a.molienda_t ?? 0));
  const extremo = ordenados[0];
  const extremoValor = extremo?.molienda_t ?? 0;
  const extremoFecha = extremo?.label ?? '—';
  const extremoTitulo = modo === 'best' ? 'Mejor día' : 'Peor día';
  const extremoColor = modo === 'best' ? 'var(--ok)' : 'var(--danger)';

  // Turno actual + ritmo /h
  const acumTurno = turnoActual?.stats.acumulado_t ?? 0;
  const horasTurno = turnoActual?.puntos.filter((p) => p.molienda_t != null && p.molienda_t > 0).length ?? 0;
  const ritmoTurno = horasTurno > 0 ? acumTurno / horasTurno : 0;

  // delta sem para mostrar
  const trendOk = modo === 'best' ? deltaSem > 2 : deltaSem < -2;
  const trendBad = modo === 'best' ? deltaSem < -2 : deltaSem > 2;
  const trendColor = trendOk ? 'var(--ok)' : trendBad ? 'var(--danger)' : 'var(--text-muted)';
  const trendIcon =
    deltaSem > 2 ? <IconTrendingUp size={11} /> : deltaSem < -2 ? <IconTrendingDown size={11} /> : <IconMinus size={11} />;
  const trendLabel = Math.abs(deltaSem) > 2 ? `${deltaSem > 0 ? '+' : ''}${deltaSem.toFixed(1)}% sem` : 'estable';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-5">
      <KpiBox label="Acum. zafra" valor={formatNumber(acumZafra, 0)} unit={unidad} sub={`${diasZafra} días`} accentVar={accentVar} />
      <KpiBox
        label="Prom. diario"
        valor={formatNumber(promDiario, 0)}
        unit={`${unidad}/d`}
        sub={
          <span className="inline-flex items-center gap-1" style={{ color: trendColor }}>
            {trendIcon} {trendLabel}
          </span>
        }
        accentVar={accentVar}
      />
      <KpiBox
        label={extremoTitulo}
        valor={formatNumber(extremoValor, 0)}
        unit={unidad}
        sub={extremoFecha}
        accentVar={extremoColor}
      />
      <KpiBox
        label="Turno actual"
        valor={formatNumber(acumTurno, 0)}
        unit={unidad}
        sub={`${formatNumber(ritmoTurno, 0)} ${unidad}/h`}
        accentVar={accentVar}
      />
    </div>
  );
}

function KpiBox({
  label,
  valor,
  unit,
  sub,
  accentVar,
}: {
  label: string;
  valor: string;
  unit: string;
  sub: React.ReactNode;
  accentVar: string;
}) {
  return (
    <div
      className="rounded-xl border bg-bg-card px-3 py-2.5 lg:px-4 lg:py-3.5 flex flex-col gap-0.5 lg:gap-1"
      style={{ borderColor: 'var(--border-strong)' }}
    >
      <div className="text-[10px] sm:text-xs lg:text-sm uppercase tracking-wider text-text-muted font-semibold">
        {label}
      </div>
      <div
        className="mono tabular-nums font-bold text-base sm:text-xl lg:text-3xl leading-tight"
        style={{ color: accentVar }}
      >
        {valor}
        <span className="text-xs sm:text-sm lg:text-base font-normal text-text-secondary ml-1">{unit}</span>
      </div>
      <div className="text-[10px] sm:text-xs lg:text-sm text-text-muted">{sub}</div>
    </div>
  );
}
