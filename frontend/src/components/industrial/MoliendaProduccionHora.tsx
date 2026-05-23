'use client';

import { useQuery } from '@tanstack/react-query';
import { IconTable, IconFlame, IconDroplet, IconWaveSine } from '@tabler/icons-react';
import { PremiumPanel } from './PremiumPanel';
import { formatNumber } from '@/lib/utils/format';

interface Fila {
  periodo: string;
  molienda_t: number | null;
  gas_m3: number | null;
  gas_estimado: boolean;
  bagazo_humedad: number | null;
  color_azucar: number | null;
  cenizas: number | null;
}

interface ProduccionHoraPayload {
  filas?: Fila[];
  stats?: {
    molienda_acum_t: number | null;
    gas_acum_m3: number | null;
    bagazo_humedad_prom: number | null;
    color_azucar_prom: number | null;
    cenizas_prom: number | null;
  } | null;
  stale?: boolean;
}

async function fetchProduccionHora(): Promise<ProduccionHoraPayload> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL!}/guardia/produccion-hora`);
  if (!res.ok) return { stale: true };
  return res.json();
}

function Cell({ value, unit, decimals = 1, muted = false }: {
  value: number | null;
  unit?: string;
  decimals?: number;
  muted?: boolean;
}) {
  if (value == null) return (
    <td className="px-2 py-2 text-center text-text-disabled text-xs mono">—</td>
  );
  return (
    <td className={`px-2 py-2 text-center mono tabular-nums text-xs ${muted ? 'text-text-muted' : 'text-text-primary'}`}>
      {formatNumber(value, decimals)}
      {unit && <span className="text-text-disabled ml-0.5">{unit}</span>}
    </td>
  );
}

export function MoliendaProduccionHora() {
  const q = useQuery({
    queryKey: ['guardia', 'produccion-hora'],
    queryFn: fetchProduccionHora,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  const filas = q.data?.filas ?? [];
  const stats = q.data?.stats;
  const hayDatos = filas.some(
    (f) => f.molienda_t != null || f.gas_m3 != null || f.bagazo_humedad != null,
  );

  return (
    <PremiumPanel
      title="MOLIENDA Y PRODUCCIÓN HORA POR HORA"
      subtitle="Día industrial corriente · 08:00 hasta ahora"
      icon={<IconTable size={18} className="text-primary-light" />}
      accent="primary"
    >
      {q.isLoading ? (
        <div className="flex-1 flex items-center justify-center py-10 text-xs text-text-muted">
          Cargando…
        </div>
      ) : !hayDatos ? (
        <div className="flex-1 flex items-center justify-center py-10 text-xs text-text-muted">
          Sin datos del turno corriente aún
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-left text-2xs uppercase tracking-wider text-text-muted font-semibold whitespace-nowrap">
                  Hora
                </th>
                <th className="px-2 py-2 text-center text-2xs uppercase tracking-wider text-primary-light font-semibold whitespace-nowrap">
                  Molienda (t)
                </th>
                <th className="px-2 py-2 text-center text-2xs uppercase tracking-wider font-semibold whitespace-nowrap" style={{ color: 'var(--warn)' }}>
                  <span className="inline-flex items-center gap-1"><IconFlame size={10} />Gas (m³)</span>
                </th>
                <th className="px-2 py-2 text-center text-2xs uppercase tracking-wider font-semibold whitespace-nowrap" style={{ color: 'var(--accent)' }}>
                  <span className="inline-flex items-center gap-1"><IconDroplet size={10} />Hum. Baz. (%)</span>
                </th>
                <th className="px-2 py-2 text-center text-2xs uppercase tracking-wider font-semibold whitespace-nowrap" style={{ color: 'var(--accent)' }}>
                  <span className="inline-flex items-center gap-1"><IconWaveSine size={10} />Color (UI)</span>
                </th>
                <th className="px-2 py-2 text-center text-2xs uppercase tracking-wider text-text-muted font-semibold whitespace-nowrap">
                  Cenizas (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr
                  key={f.periodo}
                  className={`border-b border-border/50 transition-colors hover:bg-bg-hover ${
                    i % 2 === 0 ? '' : 'bg-bg-card/40'
                  }`}
                >
                  <td className="px-2 py-2 text-left mono text-xs text-text-secondary font-medium whitespace-nowrap">
                    {f.periodo}
                  </td>
                  <Cell value={f.molienda_t} decimals={2} />
                  <td className="px-2 py-2 text-center mono tabular-nums text-xs">
                    {f.gas_m3 != null ? (
                      <span className="inline-flex items-center gap-1">
                        <span className={f.gas_estimado ? 'text-text-muted' : 'text-text-primary'}>
                          {formatNumber(f.gas_m3, 0)}
                        </span>
                        {f.gas_estimado && (
                          <span
                            className="text-[9px] px-1 rounded"
                            style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
                          >
                            est.
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-text-disabled">—</span>
                    )}
                  </td>
                  <Cell value={f.bagazo_humedad} decimals={1} />
                  <Cell value={f.color_azucar} decimals={0} />
                  <Cell value={f.cenizas} decimals={2} muted />
                </tr>
              ))}
            </tbody>

            {/* Fila de totales/promedios */}
            {stats && (
              <tfoot>
                <tr className="border-t-2 border-border bg-bg-card">
                  <td className="px-2 py-2 text-left text-2xs uppercase tracking-wider text-text-muted font-bold">
                    Acum/Prom
                  </td>
                  <td className="px-2 py-2 text-center mono tabular-nums text-xs font-bold text-primary-light">
                    {stats.molienda_acum_t != null ? formatNumber(stats.molienda_acum_t, 2) : '—'}
                  </td>
                  <td className="px-2 py-2 text-center mono tabular-nums text-xs font-bold" style={{ color: 'var(--warn)' }}>
                    {stats.gas_acum_m3 != null ? formatNumber(stats.gas_acum_m3, 0) : '—'}
                  </td>
                  <td className="px-2 py-2 text-center mono tabular-nums text-xs font-bold" style={{ color: 'var(--accent)' }}>
                    {stats.bagazo_humedad_prom != null ? formatNumber(stats.bagazo_humedad_prom, 1) : '—'}
                  </td>
                  <td className="px-2 py-2 text-center mono tabular-nums text-xs font-bold" style={{ color: 'var(--accent)' }}>
                    {stats.color_azucar_prom != null ? formatNumber(stats.color_azucar_prom, 0) : '—'}
                  </td>
                  <td className="px-2 py-2 text-center mono tabular-nums text-xs font-bold text-text-muted">
                    {stats.cenizas_prom != null ? formatNumber(stats.cenizas_prom, 2) : '—'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </PremiumPanel>
  );
}
