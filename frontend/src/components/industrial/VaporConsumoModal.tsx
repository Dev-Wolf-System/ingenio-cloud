'use client';

import { AnimatePresence, m } from 'motion/react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  IconX,
  IconWind,
  IconTrendingUp,
  IconAlertTriangle,
  IconCheck,
} from '@tabler/icons-react';
import { formatNumber } from '@/lib/utils/format';

export interface VaporSectorActual {
  variable: string;
  label: string;
  sector: string;
  presion: 'alta' | 'baja';
  crudo_tnh: number;
  factor: number | null;
  compensado_tnh: number;
}

export interface VaporActualResult {
  total_tnh: number;
  presion_alta: number | null;
  presion_baja: number | null;
  factor_alta: number | null;
  factor_baja: number | null;
  por_caudal: VaporSectorActual[];
  produccion_tnh: number | null;
  diferencial_tnh: number | null;
  diferencial_pct: number | null;
  timestamp: string;
}

export interface VaporHxHPunto {
  hora_utc: string;
  tnh: number;
}

export interface VaporHxHResult {
  consumo: VaporHxHPunto[];
  produccion: VaporHxHPunto[];
}

export interface VaporConsumoModalProps {
  open: boolean;
  onClose: () => void;
  actual?: VaporActualResult | null;
  hxh?: VaporHxHResult | null;
  loading?: boolean;
}

const SECTOR_COLORS: Record<string, string> = {
  Usina: '#6366F1',
  Auxilio: '#0EA5E9',
  Preparación: '#F59E0B',
  Trapiche: '#22C55E',
  Reductora: '#A78BFA',
  Destilería: '#EC4899',
};

// Convierte ISO UTC a etiqueta HH:00 en hora ART (UTC-3)
function fmtHoraArt(isoUtc: string): string {
  const d = new Date(isoUtc.endsWith('Z') ? isoUtc : isoUtc + 'Z');
  const artMs = d.getTime() - 3 * 60 * 60 * 1000;
  const art = new Date(artMs);
  return `${String(art.getUTCHours()).padStart(2, '0')}:00`;
}

export function VaporConsumoModal({
  open,
  onClose,
  actual,
  hxh,
  loading,
}: VaporConsumoModalProps) {
  const consumo = actual?.total_tnh ?? 0;
  const produccion = actual?.produccion_tnh ?? null;
  const dif = actual?.diferencial_tnh ?? null;
  const difPct = actual?.diferencial_pct ?? null;

  // Indicadores inteligentes
  const eficiencia =
    produccion != null && consumo > 0
      ? (Math.min(produccion, consumo) / Math.max(produccion, consumo)) * 100
      : null;
  const alertaPresion =
    (actual?.presion_alta != null && actual.presion_alta < 15) ||
    (actual?.presion_baja != null && actual.presion_baja < 15);
  const sectorTop = actual?.por_caudal
    .filter((c) => c.compensado_tnh > 0)
    .sort((a, b) => b.compensado_tnh - a.compensado_tnh)[0];

  // Agrupación por sector para donut
  const porSector = new Map<string, number>();
  actual?.por_caudal.forEach((c) => {
    if (c.compensado_tnh > 0) {
      porSector.set(c.sector, (porSector.get(c.sector) ?? 0) + c.compensado_tnh);
    }
  });
  const sectorData = Array.from(porSector.entries()).map(([name, value]) => ({
    name,
    value: Number(value.toFixed(2)),
    color: SECTOR_COLORS[name] ?? '#94A3B8',
  }));

  // Serie comparativa hxh
  const serieComparativa = (() => {
    if (!hxh) return [];
    const consumoMap = new Map(hxh.consumo.map((p) => [p.hora_utc, p.tnh]));
    const prodMap = new Map(hxh.produccion.map((p) => [p.hora_utc, p.tnh]));
    const allHoras = new Set<string>([
      ...Array.from(consumoMap.keys()),
      ...Array.from(prodMap.keys()),
    ]);
    return Array.from(allHoras)
      .sort()
      .map((hora) => {
        const c = consumoMap.get(hora) ?? 0;
        const p = prodMap.get(hora) ?? 0;
        return {
          hora: fmtHoraArt(hora),
          consumo: Number(c.toFixed(1)),
          produccion: Number(p.toFixed(1)),
          diferencial: Number((p - c).toFixed(1)),
        };
      });
  })();

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <m.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative w-full max-w-[92vw] rounded-2xl overflow-hidden border-2 flex flex-col max-h-[92vh]"
            style={{
              background:
                'var(--panel-mesh-1), var(--panel-mesh-2), linear-gradient(135deg, var(--surface-panel-from), var(--surface-panel-to))',
              borderColor: 'var(--border-strong)',
              boxShadow: 'var(--panel-shadow), 0 40px 120px rgba(0,0,0,0.45)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              aria-hidden
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: 'linear-gradient(90deg, var(--accent), var(--primary))' }}
            />

            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary z-10"
              aria-label="Cerrar"
            >
              <IconX size={16} />
            </button>

            <div className="p-6 pb-3 shrink-0 flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                style={{
                  background: 'var(--accent-soft, rgba(99,102,241,0.15))',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                <IconWind size={22} />
              </div>
              <div>
                <h2
                  className="text-xl sm:text-2xl font-bold tracking-tight leading-tight text-text-primary"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Consumo de Vapor · Compensado
                </h2>
                <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
                  7 caudales · compensación √((P−2)/16) · producción vs consumo
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-5">
              {loading ? (
                <div className="py-16 text-center text-sm text-text-muted">Cargando…</div>
              ) : !actual ? (
                <div className="py-16 text-center text-sm text-text-muted">Sin datos</div>
              ) : (
                <>
                  {/* Sección 1: KPI Cards Producido / Consumido / Diferencial */}
                  <section>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <KpiCard
                        label="Vapor producido"
                        value={produccion}
                        unit="Tn/H"
                        hint="Calderas C2+C3+C6"
                        accent="var(--warn)"
                      />
                      <KpiCard
                        label="Vapor consumido"
                        value={consumo}
                        unit="Tn/H"
                        hint={`${actual.por_caudal.filter((c) => c.compensado_tnh > 0).length} caudales · compensado`}
                        accent="var(--accent)"
                      />
                      <KpiCard
                        label="Diferencial"
                        value={dif}
                        unit="Tn/H"
                        hint={difPct != null ? `${difPct > 0 ? '+' : ''}${difPct}%` : '—'}
                        accent={
                          dif == null
                            ? 'var(--text-muted)'
                            : Math.abs(difPct ?? 0) > 15
                            ? 'var(--danger)'
                            : dif < 0
                            ? 'var(--warn)'
                            : 'var(--ok)'
                        }
                        valuePrefix={dif != null && dif > 0 ? '+' : ''}
                      />
                    </div>

                    {/* Chips inteligentes */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {eficiencia != null && (
                        <Chip
                          icon={<IconCheck size={12} />}
                          label={`Eficiencia ${eficiencia.toFixed(1)}%`}
                          color={eficiencia > 85 ? 'var(--ok)' : eficiencia > 70 ? 'var(--warn)' : 'var(--danger)'}
                        />
                      )}
                      {sectorTop && (
                        <Chip
                          icon={<IconTrendingUp size={12} />}
                          label={`${sectorTop.sector} concentra ${((sectorTop.compensado_tnh / consumo) * 100).toFixed(0)}%`}
                          color="var(--accent)"
                        />
                      )}
                      {alertaPresion && (
                        <Chip
                          icon={<IconAlertTriangle size={12} />}
                          label="Presión baja · compensación degradada"
                          color="var(--warn)"
                        />
                      )}
                      {dif != null && Math.abs(difPct ?? 0) > 15 && (
                        <Chip
                          icon={<IconAlertTriangle size={12} />}
                          label={`Diferencial ${Math.abs(difPct ?? 0).toFixed(0)}% · revisar`}
                          color="var(--danger)"
                        />
                      )}
                    </div>
                  </section>

                  {/* Sección 2: Desglose tabla */}
                  <Seccion titulo="Desglose por caudal">
                    <div className="rounded-xl border border-border bg-bg-card overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="text-text-muted uppercase tracking-wide text-[10px]">
                          <tr className="border-b border-border">
                            <th className="text-left p-2.5">Sector</th>
                            <th className="text-right p-2.5">Crudo Tn/H</th>
                            <th className="text-right p-2.5">Presión</th>
                            <th className="text-right p-2.5">Factor</th>
                            <th className="text-right p-2.5">Compensado</th>
                            <th className="text-right p-2.5">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {actual.por_caudal.map((c) => {
                            const pct = consumo > 0 ? (c.compensado_tnh / consumo) * 100 : 0;
                            const isZero = c.compensado_tnh === 0;
                            return (
                              <tr key={c.variable} className="border-b border-border/40 hover:bg-bg-hover/40">
                                <td className="p-2.5">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="inline-block w-2 h-2 rounded-full"
                                      style={{ background: SECTOR_COLORS[c.sector] ?? '#94A3B8' }}
                                    />
                                    <span className="font-medium text-text-primary">{c.label}</span>
                                    {isZero && (
                                      <span className="text-[10px] text-text-muted bg-bg-hover px-1.5 py-0.5 rounded">
                                        sin consumo
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-text-muted ml-4">{c.sector}</div>
                                </td>
                                <td className="text-right p-2.5 mono tabular-nums">{formatNumber(c.crudo_tnh, 2)}</td>
                                <td className="text-right p-2.5 mono text-text-muted">{c.presion}</td>
                                <td className="text-right p-2.5 mono tabular-nums text-text-muted">
                                  {c.factor != null ? c.factor.toFixed(4) : '—'}
                                </td>
                                <td className="text-right p-2.5 mono tabular-nums font-semibold text-text-primary">
                                  {formatNumber(c.compensado_tnh, 2)}
                                </td>
                                <td className="text-right p-2.5 mono tabular-nums text-text-muted">{pct.toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-bg-hover/30">
                            <td className="p-2.5 font-bold">TOTAL</td>
                            <td colSpan={3}></td>
                            <td className="text-right p-2.5 mono tabular-nums font-bold" style={{ color: 'var(--accent)' }}>
                              {formatNumber(consumo, 2)} Tn/H
                            </td>
                            <td className="text-right p-2.5 mono font-bold">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </Seccion>

                  {/* Sección 3: Donut distribución */}
                  {sectorData.length > 0 && (
                    <Seccion titulo="Distribución por sector">
                      <div className="rounded-xl border border-border bg-bg-card p-4">
                        <div style={{ height: 220 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={sectorData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={50}
                                outerRadius={85}
                                paddingAngle={2}
                                isAnimationActive={false}
                              >
                                {sectorData.map((s, i) => (
                                  <Cell key={i} fill={s.color} stroke="var(--bg-card)" strokeWidth={1.5} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  background: 'var(--bg-card)',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: 6,
                                  fontSize: 12,
                                }}
                                formatter={(v: number) => [`${formatNumber(v, 2)} Tn/H`, '']}
                              />
                              <Legend
                                verticalAlign="middle"
                                align="right"
                                layout="vertical"
                                iconSize={10}
                                wrapperStyle={{ fontSize: 12 }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </Seccion>
                  )}

                  {/* Sección 4: Serie temporal */}
                  <Seccion titulo="Producido vs Consumido · últimas 24h">
                    <div className="rounded-xl border border-border bg-bg-card p-3 lg:p-4">
                      {serieComparativa.length === 0 ? (
                        <div className="h-[180px] flex items-center justify-center text-xs text-text-muted">
                          Cargando serie horaria…
                        </div>
                      ) : (
                        <div style={{ height: 220 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={serieComparativa} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                              <XAxis
                                dataKey="hora"
                                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                                axisLine={false}
                                tickLine={false}
                                unit=" Tn/H"
                                width={56}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: 'var(--bg-card)',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: 6,
                                  fontSize: 12,
                                }}
                                formatter={(v: number, name: string) => {
                                  const lbl =
                                    name === 'consumo'
                                      ? 'Consumo'
                                      : name === 'produccion'
                                      ? 'Producción'
                                      : 'Diferencial';
                                  return [`${formatNumber(v, 1)} Tn/H`, lbl];
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="produccion"
                                stroke="var(--warn)"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="consumo"
                                stroke="var(--accent)"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                              />
                              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </Seccion>

                  {/* Sección 5: Diferencial barras */}
                  {serieComparativa.length > 0 && (
                    <Seccion titulo="Diferencial horario (positivo = pérdidas líneas)">
                      <div className="rounded-xl border border-border bg-bg-card p-3 lg:p-4">
                        <div style={{ height: 180 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={serieComparativa} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                              <XAxis
                                dataKey="hora"
                                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                                axisLine={false}
                                tickLine={false}
                                unit=" Tn/H"
                                width={56}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: 'var(--bg-card)',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: 6,
                                  fontSize: 12,
                                }}
                                formatter={(v: number) => [`${formatNumber(v, 1)} Tn/H`, 'Diferencial']}
                              />
                              <Bar dataKey="diferencial" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                                {serieComparativa.map((p, i) => (
                                  <Cell key={i} fill={p.diferencial >= 0 ? 'var(--ok)' : 'var(--danger)'} />
                                ))}
                              </Bar>
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </Seccion>
                  )}
                </>
              )}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function KpiCard({
  label,
  value,
  unit,
  hint,
  accent,
  valuePrefix = '',
}: {
  label: string;
  value: number | null;
  unit: string;
  hint?: string;
  accent: string;
  valuePrefix?: string;
}) {
  return (
    <div
      className="rounded-xl border-2 p-4"
      style={{
        background: 'var(--bg-card)',
        borderColor: accent,
        boxShadow: `0 0 24px ${accent}22`,
      }}
    >
      <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-1.5">
        <span className="text-2xl lg:text-3xl font-bold tabular-nums mono" style={{ color: accent }}>
          {value != null ? `${valuePrefix}${formatNumber(value, 1)}` : '—'}
        </span>
        <span className="text-xs text-text-muted">{unit}</span>
      </div>
      {hint && <div className="text-[11px] text-text-muted mt-1">{hint}</div>}
    </div>
  );
}

function Chip({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] mono font-medium"
      style={{ color, background: `${color}15`, border: `1px solid ${color}40` }}
    >
      {icon}
      {label}
    </span>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-sm sm:text-base font-bold uppercase tracking-wider"
          style={{ color: 'var(--accent)' }}
        >
          {titulo}
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
