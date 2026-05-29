'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  IconRefresh,
  IconBrain,
  IconChartBar,
  IconChartLine,
  IconStar,
  IconBulb,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import { type HistoryAlert, apiUrl } from '../_types';

// ── palette ───────────────────────────────────────────────────────────────────

const C = {
  cyan:    '#00D4FF',
  amber:   '#FFB800',
  green:   '#00E5A0',
  red:     '#FF4757',
  muted:   '#6B7A9E',
  surface: 'rgba(255,255,255,0.04)',
  border:  'rgba(255,255,255,0.08)',
};

// ── glass tooltip ─────────────────────────────────────────────────────────────

function GlassTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{
        background: 'rgba(17,24,39,0.92)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${C.border}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {label && <p className="font-semibold text-[#F0F4FF] mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function getTurnoLabel(iso: string): string {
  const h = new Date(iso).getHours();
  if (h >= 5 && h <= 12)  return 'Mañana';
  if (h >= 13 && h <= 20) return 'Tarde';
  return 'Noche';
}

function dateFmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

// ── datasets derivation ───────────────────────────────────────────────────────

function buildDatasets(rows: HistoryAlert[]) {
  // 1. Por turno
  const turnoMap: Record<string, number> = { Mañana: 0, Tarde: 0, Noche: 0 };
  rows.forEach((r) => { turnoMap[getTurnoLabel(r.detected_at)]++; });
  const byTurno = [
    { name: 'Mañana', count: turnoMap.Mañana,  fill: C.amber },
    { name: 'Tarde',  count: turnoMap.Tarde,   fill: C.cyan  },
    { name: 'Noche',  count: turnoMap.Noche,   fill: C.green },
  ];

  // 2. Duración media por día (solo resueltas)
  const resolved = rows.filter((r) => r.resolved_at);
  const dayDur: Record<string, { sum: number; count: number }> = {};
  resolved.forEach((r) => {
    const key = dateFmt(r.detected_at);
    const dur = (new Date(r.resolved_at!).getTime() - new Date(r.detected_at).getTime()) / 60_000;
    if (!dayDur[key]) dayDur[key] = { sum: 0, count: 0 };
    dayDur[key].sum   += dur;
    dayDur[key].count += 1;
  });
  const durPorDia = Object.entries(dayDur)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, { sum, count }]) => ({ date, avg: Math.round(sum / count) }));

  // 3. Top 5 sensores
  const titleCount: Record<string, number> = {};
  rows.forEach((r) => { titleCount[r.title] = (titleCount[r.title] ?? 0) + 1; });
  const top5 = Object.entries(titleCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name: name.length > 30 ? name.slice(0, 28) + '…' : name, count }));

  // 4. Heatmap hora × día-de-semana
  const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const heat: Record<string, number> = {};
  rows.forEach((r) => {
    const d = new Date(r.detected_at);
    const key = `${d.getDay()}-${d.getHours()}`;
    heat[key] = (heat[key] ?? 0) + 1;
  });
  const maxHeat = Math.max(1, ...Object.values(heat));
  const heatCells: { day: number; hour: number; count: number; label: string; intensity: number }[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = heat[`${day}-${hour}`] ?? 0;
      heatCells.push({ day, hour, count, label: DAYS[day], intensity: count / maxHeat });
    }
  }

  return { byTurno, durPorDia, top5, heatCells, DAYS };
}

// ── AI summary ────────────────────────────────────────────────────────────────

interface AiResumen {
  resumen: string;
  patrones: string[];
  recomendaciones: string[];
  stats?: {
    total?: number;
    avgDurationMin?: number;
    maxDurationMin?: number;
    top5Sensors?: { title: string; count: number }[];
  };
}

// ── chart card wrapper ────────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: C.surface,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${C.border}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      }}
    >
      <h3 className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.muted }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function HistorialCharts() {
  const [rows, setRows]         = useState<HistoryAlert[]>([]);
  const [loading, setLoading]   = useState(true);
  const [aiLoading, setAiLoad]  = useState(false);
  const [aiData, setAiData]     = useState<AiResumen | null>(null);
  const [aiError, setAiError]   = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/alerts/history?limit=500&offset=0`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      // backend returns { data: [...], total: N } or directly an array
      setRows(Array.isArray(body) ? body : (body.data ?? []));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const fetchAi = async () => {
    setAiLoad(true);
    setAiError(null);
    try {
      const res = await fetch(`${apiUrl}/alerts/history/resumen?limit=500`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAiData(await res.json());
    } catch (e) {
      setAiError((e as Error).message ?? 'Error desconocido');
    } finally {
      setAiLoad(false);
    }
  };

  const { byTurno, durPorDia, top5, heatCells, DAYS } = buildDatasets(rows);
  const hasRows = rows.length > 0;

  // heatmap color
  const heatColor = (intensity: number) => {
    if (intensity === 0) return 'rgba(255,255,255,0.03)';
    const alpha = 0.12 + intensity * 0.75;
    const r = Math.round(255 * Math.min(1, intensity * 2));
    const g = Math.round(212 - 200 * intensity);
    const b = Math.round(255 * Math.max(0, 1 - intensity * 2));
    return `rgba(${r},${g},${b},${alpha})`;
  };

  return (
    <PremiumPanel
      title="ANÁLISIS DE HISTORIAL"
      subtitle="Distribución temporal · duración · sensores frecuentes · densidad horaria"
      icon={<IconChartBar size={18} className="text-primary-light" />}
      accent="neutral"
      headerRight={
        <button
          onClick={fetchRows}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-2xs lg:text-xs text-text-muted hover:text-primary-light transition-colors px-3 py-1.5 rounded-md hover:bg-bg-hover border border-border"
        >
          <IconRefresh size={12} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <div
            className="w-8 h-8 rounded-full animate-spin border-2 border-primary-light/20"
            style={{ borderTopColor: C.cyan }}
          />
          <p className="text-xs" style={{ color: C.muted }}>Cargando datos…</p>
        </div>
      ) : !hasRows ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: C.muted }}>
          <IconChartBar size={32} className="opacity-30" />
          <p className="text-sm">Sin datos de historial para graficar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Row 1: Turnos + Duración ───────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Alertas por turno */}
            <ChartCard title="Alertas por Turno">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byTurno} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: C.muted }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: C.muted }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="count" name="Alertas" radius={[4, 4, 0, 0]}>
                    {byTurno.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Duración media por día */}
            <ChartCard title="Duración Media por Día (min)">
              {durPorDia.length === 0 ? (
                <div className="h-[180px] flex items-center justify-center text-xs" style={{ color: C.muted }}>
                  Sin alertas resueltas con duración registrada
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={durPorDia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="durGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.cyan} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={C.cyan} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<GlassTooltip />} cursor={{ stroke: C.cyan, strokeWidth: 1, strokeDasharray: '4 2' }} />
                    <Area
                      type="monotone"
                      dataKey="avg"
                      name="Duración avg (min)"
                      stroke={C.cyan}
                      strokeWidth={2}
                      fill="url(#durGrad)"
                      dot={{ r: 3, fill: C.cyan, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ── Row 2: Top 5 sensores + Heatmap ───────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top 5 sensores */}
            <ChartCard title="Top 5 Sensores / Alertas más Frecuentes">
              {top5.length === 0 ? (
                <div className="h-[180px] flex items-center justify-center text-xs" style={{ color: C.muted }}>
                  Sin datos
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    layout="vertical"
                    data={top5}
                    margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 9, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="count" name="Ocurrencias" radius={[0, 4, 4, 0]}>
                      {top5.map((_, i) => (
                        <Cell
                          key={i}
                          fill={[C.red, C.amber, C.cyan, C.green, C.muted][i % 5]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Heatmap hora × día */}
            <ChartCard title="Densidad por Hora × Día de Semana">
              <div className="overflow-x-auto">
                {/* Hour axis labels */}
                <div className="flex gap-[1px] mb-0.5 ml-8">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className="flex-1 text-center"
                      style={{ fontSize: 7, color: C.muted, minWidth: 12 }}
                    >
                      {h % 4 === 0 ? h : ''}
                    </div>
                  ))}
                </div>
                {/* Grid rows */}
                {DAYS.map((day, dayIdx) => (
                  <div key={dayIdx} className="flex items-center gap-[1px] mb-[2px]">
                    <span
                      className="w-7 text-right pr-1 shrink-0"
                      style={{ fontSize: 8, color: C.muted }}
                    >
                      {day}
                    </span>
                    {heatCells
                      .filter((c) => c.day === dayIdx)
                      .sort((a, b) => a.hour - b.hour)
                      .map((cell) => (
                        <div
                          key={cell.hour}
                          title={`${day} ${cell.hour}:00 — ${cell.count} alerta${cell.count !== 1 ? 's' : ''}`}
                          className="rounded-[2px] flex-1 cursor-default"
                          style={{
                            height: 14,
                            minWidth: 12,
                            background: heatColor(cell.intensity),
                            border: `1px solid ${cell.count > 0 ? 'rgba(255,255,255,0.06)' : 'transparent'}`,
                            transition: 'opacity 0.15s',
                          }}
                        />
                      ))}
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-2">
                  <span style={{ fontSize: 8, color: C.muted }}>Baja</span>
                  <div className="flex gap-[2px]">
                    {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v, i) => (
                      <div
                        key={i}
                        className="rounded-[2px]"
                        style={{ width: 12, height: 8, background: heatColor(v) }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 8, color: C.muted }}>Alta</span>
                </div>
              </div>
            </ChartCard>
          </div>

          {/* ── AI summary ─────────────────────────────────────────────────── */}
          <div
            className="rounded-xl p-4"
            style={{
              background: C.surface,
              backdropFilter: 'blur(20px)',
              border: `1px solid ${C.border}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <IconBrain size={16} style={{ color: C.cyan }} />
                <h3 className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.muted }}>
                  Análisis IA del Período
                </h3>
              </div>
              {!aiData && (
                <button
                  onClick={fetchAi}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-md border transition-all"
                  style={{
                    background: 'rgba(0,212,255,0.10)',
                    borderColor: 'rgba(0,212,255,0.35)',
                    color: C.cyan,
                    opacity: aiLoading ? 0.6 : 1,
                  }}
                >
                  {aiLoading ? (
                    <>
                      <div
                        className="w-3 h-3 rounded-full animate-spin border border-current/30"
                        style={{ borderTopColor: C.cyan }}
                      />
                      Analizando…
                    </>
                  ) : (
                    <>
                      <IconBrain size={13} />
                      Analizar período con IA
                    </>
                  )}
                </button>
              )}
              {aiData && (
                <button
                  onClick={() => { setAiData(null); setAiError(null); }}
                  className="text-2xs px-2 py-1 rounded border border-border text-text-muted hover:text-primary-light transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>

            {aiError && (
              <div
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,71,87,0.10)', color: C.red, border: '1px solid rgba(255,71,87,0.25)' }}
              >
                <IconAlertTriangle size={13} />
                Error al obtener análisis IA: {aiError}
              </div>
            )}

            {!aiData && !aiError && (
              <p className="text-xs" style={{ color: C.muted }}>
                Presioná el botón para obtener un resumen generado por IA del período analizado
                (patrones, anomalías y recomendaciones basadas en los últimos 500 eventos).
              </p>
            )}

            {aiData && (
              <div className="space-y-4">
                {/* Resumen */}
                {aiData.resumen && (
                  <p className="text-sm leading-relaxed" style={{ color: '#D0D8F0' }}>
                    {aiData.resumen}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Patrones */}
                  {aiData.patrones?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <IconChartLine size={13} style={{ color: C.amber }} />
                        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.amber }}>
                          Patrones detectados
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {aiData.patrones.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#B0BACE' }}>
                            <IconStar size={10} className="mt-0.5 shrink-0" style={{ color: C.amber }} />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recomendaciones */}
                  {aiData.recomendaciones?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <IconBulb size={13} style={{ color: C.green }} />
                        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.green }}>
                          Recomendaciones
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {aiData.recomendaciones.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#B0BACE' }}>
                            <IconBulb size={10} className="mt-0.5 shrink-0" style={{ color: C.green }} />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PremiumPanel>
  );
}
