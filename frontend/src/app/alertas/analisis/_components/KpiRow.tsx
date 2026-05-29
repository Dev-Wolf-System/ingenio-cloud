'use client';

import {
  IconAlertTriangle,
  IconAlertOctagon,
  IconClockHour4,
  IconBell,
  IconRefresh,
  IconTool,
  IconClockBolt,
  IconActivity,
} from '@tabler/icons-react';
import type { AnalisisResponse, Reliabilidad } from '../_types';
import { C, fmtMin } from './chart-kit';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function DeltaChip({ pct }: { pct: number }) {
  const up   = pct > 0;
  const zero = pct === 0;
  const color = zero ? C.muted : up ? C.red : C.green;
  const bg    = zero
    ? 'rgba(107,122,158,0.15)'
    : up
    ? 'rgba(255,71,87,0.15)'
    : 'rgba(0,229,160,0.15)';
  const arrow = zero ? '→' : up ? '↑' : '↓';
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums tracking-wide"
      style={{ color, background: bg, border: `1px solid ${color}33` }}
    >
      {arrow} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ── single KPI card ───────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentColor: string;
  chip?: React.ReactNode;
  sub?: string;
}

function KpiCard({ label, value, icon, accentColor, chip, sub }: KpiCardProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-4"
      style={{
        background: C.surface,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${C.border}`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[9px] uppercase tracking-[0.18em] font-semibold"
          style={{ color: C.muted }}
        >
          {label}
        </span>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}33`,
          }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <span
          className="text-2xl font-bold tabular-nums leading-none"
          style={{ color: '#F0F4FF', fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </span>
        {chip}
      </div>

      {sub && (
        <span className="text-[10px]" style={{ color: C.muted }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ── reliability card (slim variant) ──────────────────────────────────────────

interface RelCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentColor: string;
  subtitle: string;
  isNull: boolean;
}

function RelCard({ label, value, icon, accentColor, subtitle, isNull }: RelCardProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-4"
      style={{
        background: isNull ? 'rgba(255,255,255,0.02)' : C.surface,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${isNull ? 'rgba(255,255,255,0.05)' : C.border}`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)`,
        opacity: isNull ? 0.6 : 1,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[9px] uppercase tracking-[0.18em] font-semibold"
          style={{ color: C.muted }}
        >
          {label}
        </span>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}33`,
          }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
      </div>

      <span
        className="text-2xl font-bold tabular-nums leading-none"
        style={{ color: isNull ? C.muted : '#F0F4FF', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </span>

      <span className="text-[10px]" style={{ color: C.muted }}>
        {isNull ? 'Sin paradas registradas' : subtitle}
      </span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function KpiRow({
  kpis,
  reliabilidad,
  comparativa,
}: {
  kpis: AnalisisResponse['kpis'];
  reliabilidad: Reliabilidad;
  comparativa: AnalisisResponse['comparativa'];
}) {
  const delta = comparativa?.delta_pct ?? null;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Row 1: alertas ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total alertas"
          value={fmtNum(kpis.total)}
          icon={<IconBell size={15} />}
          accentColor={C.cyan}
          chip={delta !== null ? <DeltaChip pct={delta} /> : undefined}
          sub={
            comparativa?.total_prev !== null && comparativa?.total_prev !== undefined
              ? `Período ant: ${fmtNum(comparativa.total_prev)}`
              : undefined
          }
        />

        <KpiCard
          label="Críticas"
          value={fmtNum(kpis.por_severidad.critical)}
          icon={<IconAlertOctagon size={15} />}
          accentColor={C.red}
          sub={
            comparativa?.por_severidad_prev
              ? `Ant: ${comparativa.por_severidad_prev.critical}`
              : undefined
          }
        />

        <KpiCard
          label="Advertencias"
          value={fmtNum(kpis.por_severidad.warn)}
          icon={<IconAlertTriangle size={15} />}
          accentColor={C.amber}
          sub={
            comparativa?.por_severidad_prev
              ? `Ant: ${comparativa.por_severidad_prev.warn}`
              : undefined
          }
        />

        <KpiCard
          label="Duración media"
          value={fmtMin(kpis.duracion_media_min)}
          icon={<IconClockHour4 size={15} />}
          accentColor={C.green}
          sub={`máx ${fmtMin(kpis.duracion_max_min)}`}
        />
      </div>

      {/* ── Row 2: confiabilidad ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RelCard
          label="MTBF"
          value={fmtMin(reliabilidad.mtbf_min)}
          icon={<IconRefresh size={15} />}
          accentColor={C.cyan}
          subtitle="entre fallas"
          isNull={reliabilidad.mtbf_min === null}
        />

        <RelCard
          label="MTTR"
          value={fmtMin(reliabilidad.mttr_min)}
          icon={<IconTool size={15} />}
          accentColor={C.amber}
          subtitle="reparación"
          isNull={reliabilidad.mttr_min === null}
        />

        <RelCard
          label="MTTF"
          value={fmtMin(reliabilidad.mttf_min)}
          icon={<IconActivity size={15} />}
          accentColor={C.green}
          subtitle="uptime"
          isNull={reliabilidad.mttf_min === null}
        />

        <RelCard
          label="MTTA"
          value={fmtMin(reliabilidad.mtta_min)}
          icon={<IconClockBolt size={15} />}
          accentColor="#A89BFF"
          subtitle="reconocimiento"
          isNull={reliabilidad.mtta_min === null}
        />
      </div>
    </div>
  );
}
