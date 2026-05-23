'use client';

import { useQuery } from '@tanstack/react-query';
import { IconScale, IconFlame, IconDroplet, IconWaveSine, IconTable } from '@tabler/icons-react';
import { PremiumPanel } from './PremiumPanel';
import { formatNumber } from '@/lib/utils/format';

interface Fila {
  periodo: string;
  molienda_t: number | null;
  molienda_estimada: boolean;
  gas_m3: number | null;
  gas_estimado: boolean;
  bagazo_humedad: number | null;
  color_azucar: number | null;
  calidad: number | null;
}

interface Stats {
  molienda_acum_t: number | null;
  gas_acum_m3: number | null;
  bagazo_humedad_prom: number | null;
  color_azucar_prom: number | null;
  calidad_prom: number | null;
}

interface ProduccionHoraPayload {
  filas?: Fila[];
  stats?: Stats | null;
  stale?: boolean;
}

async function fetchProduccionHora(): Promise<ProduccionHoraPayload> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL!}/guardia/produccion-hora`);
  if (!res.ok) return { stale: true };
  return res.json();
}

function StatCard({
  label,
  value,
  unit,
  decimals,
  sublabel,
  icon,
  color,
}: {
  label: string;
  value: number | null;
  unit: string;
  decimals: number;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className="flex-1 min-w-0 rounded-xl border border-border bg-bg-card px-3 py-2.5 flex flex-col gap-0.5"
      style={{ borderColor: value != null ? `color-mix(in srgb, ${color} 30%, transparent)` : undefined }}
    >
      <div className="flex items-center gap-1.5 text-sm uppercase tracking-wider font-semibold text-text-muted">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="mono tabular-nums font-bold text-xl sm:text-3xl leading-tight" style={{ color: value != null ? color : 'var(--text-disabled)' }}>
        {value != null ? formatNumber(value, decimals) : '—'}
        {value != null && <span className="text-base font-normal text-text-secondary ml-1">{unit}</span>}
      </div>
      <div className="text-sm text-text-muted">{sublabel}</div>
    </div>
  );
}

function TableCell({ value, unit, decimals = 1, muted = false }: {
  value: number | null;
  unit?: string;
  decimals?: number;
  muted?: boolean;
}) {
  if (value == null) return (
    <td className="px-3 py-2 text-center text-text-disabled text-base sm:text-lg mono">—</td>
  );
  return (
    <td className={`px-3 py-2 text-center mono tabular-nums text-base sm:text-lg ${muted ? 'text-text-muted' : 'text-text-primary'}`}>
      {formatNumber(value, decimals)}
      {unit && <span className="text-text-disabled ml-0.5">{unit}</span>}
    </td>
  );
}

export function MoliendaProduccionHora() {
  const q = useQuery({
    queryKey: ['guardia', 'produccion-hora'],
    queryFn: fetchProduccionHora,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const filas = q.data?.filas ?? [];
  const stats = q.data?.stats ?? null;
  const hayDatos = filas.some(
    (f) => f.molienda_t != null || f.gas_m3 != null || f.bagazo_humedad != null,
  );

  return (
    <PremiumPanel
      title="MOLIENDA Y PRODUCCIÓN HORA POR HORA"
      subtitle="Día industrial corriente · 08:00 hasta ahora"
      icon={<IconTable size={18} className="text-primary-light" />}
      accent="primary"
      className="h-full"
    >
      {q.isLoading ? (
        <div className="flex-1 flex items-center justify-center py-10 text-sm text-text-muted">
          Cargando…
        </div>
      ) : (
        <div className="flex flex-col gap-4 h-full">
          {/* Tarjetas de stats */}
          <div className="flex gap-2 flex-wrap shrink-0">
            <StatCard
              label="Molienda"
              value={stats?.molienda_acum_t ?? null}
              unit="t"
              decimals={1}
              sublabel="acumulado del día"
              icon={<IconScale size={11} />}
              color="var(--primary-light)"
            />
            <StatCard
              label="Gas"
              value={stats?.gas_acum_m3 ?? null}
              unit="m³"
              decimals={0}
              sublabel="acumulado del día"
              icon={<IconFlame size={11} />}
              color="var(--warn)"
            />
            <StatCard
              label="Hum. Bagazo"
              value={stats?.bagazo_humedad_prom ?? null}
              unit="%"
              decimals={1}
              sublabel="promedio del día"
              icon={<IconDroplet size={11} />}
              color="var(--accent)"
            />
            <StatCard
              label="Color"
              value={stats?.color_azucar_prom ?? null}
              unit="UI"
              decimals={0}
              sublabel="promedio del día"
              icon={<IconWaveSine size={11} />}
              color="var(--accent)"
            />
            <StatCard
              label="Calidad"
              value={stats?.calidad_prom ?? null}
              unit=""
              decimals={1}
              sublabel="promedio del día"
              icon={<span className="text-[10px]">★</span>}
              color="var(--ok)"
            />
          </div>

          {/* Tabla hora×hora */}
          {!hayDatos ? (
            <div className="flex-1 flex items-center justify-center py-8 text-sm text-text-muted">
              Sin datos del día corriente aún
            </div>
          ) : (
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-base sm:text-lg uppercase tracking-wider text-text-muted font-semibold whitespace-nowrap sticky top-0 bg-bg-card z-10">Hora</th>
                    <th className="px-3 py-2 text-center text-base sm:text-lg uppercase tracking-wider font-semibold whitespace-nowrap sticky top-0 bg-bg-card z-10 text-primary-light">Molienda (t)</th>
                    <th className="px-3 py-2 text-center text-base sm:text-lg uppercase tracking-wider font-semibold whitespace-nowrap sticky top-0 bg-bg-card z-10" style={{ color: 'var(--warn)' }}>
                      <span className="inline-flex items-center gap-0.5"><IconFlame size={12} />Gas (m³)</span>
                    </th>
                    <th className="px-3 py-2 text-center text-base sm:text-lg uppercase tracking-wider font-semibold whitespace-nowrap sticky top-0 bg-bg-card z-10" style={{ color: 'var(--accent)' }}>
                      <span className="inline-flex items-center gap-0.5"><IconDroplet size={12} />Hum. Baz. (%)</span>
                    </th>
                    <th className="px-3 py-2 text-center text-base sm:text-lg uppercase tracking-wider font-semibold whitespace-nowrap sticky top-0 bg-bg-card z-10" style={{ color: 'var(--accent)' }}>
                      <span className="inline-flex items-center gap-0.5"><IconWaveSine size={12} />Color (UI)</span>
                    </th>
                    <th className="px-3 py-2 text-center text-base sm:text-lg uppercase tracking-wider font-semibold whitespace-nowrap sticky top-0 bg-bg-card z-10" style={{ color: 'var(--ok)' }}>Calidad</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr
                      key={f.periodo}
                      className={`border-b border-border/50 transition-colors hover:bg-bg-hover ${i % 2 !== 0 ? 'bg-bg-card/40' : ''}`}
                    >
                      <td className="px-3 py-2 text-left mono text-base sm:text-lg text-text-secondary font-medium whitespace-nowrap">
                        {f.periodo}
                      </td>
                      <td className="px-3 py-2 text-center mono tabular-nums text-base sm:text-lg">
                        {f.molienda_t != null ? (
                          <span className="inline-flex items-center gap-1">
                            <span className={f.molienda_estimada ? 'text-text-muted' : 'text-text-primary'}>
                              {formatNumber(f.molienda_t, 2)}
                            </span>
                            {f.molienda_estimada && (
                              <span className="text-[10px] sm:text-xs px-1 rounded" style={{ background: 'var(--primary-soft)', color: 'var(--primary-light)' }}>
                                bal.
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-text-disabled">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center mono tabular-nums text-base sm:text-lg">
                        {f.gas_m3 != null ? (
                          <span className="inline-flex items-center gap-1">
                            <span className={f.gas_estimado ? 'text-text-muted' : 'text-text-primary'}>
                              {formatNumber(f.gas_m3, 0)}
                            </span>
                            {f.gas_estimado && (
                              <span className="text-[10px] sm:text-xs px-1 rounded" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
                                est.
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-text-disabled">—</span>
                        )}
                      </td>
                      <TableCell value={f.bagazo_humedad} decimals={1} />
                      <TableCell value={f.color_azucar} decimals={0} />
                      <TableCell value={f.calidad} decimals={1} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </PremiumPanel>
  );
}
