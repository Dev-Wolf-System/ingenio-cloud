'use client';

import { useQuery } from '@tanstack/react-query';
import {
  IconScale,
  IconChartBar,
  IconFlame,
  IconAlertTriangle,
  IconTruck,
} from '@tabler/icons-react';
import { useDashboardData, type DashboardItem } from '@/lib/hooks/useDashboardData';
import { KpiCard } from './KpiCard';

async function fetchAlerts() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/alerts/active`);
  if (!res.ok) return { alerts: [] };
  return res.json();
}

async function fetchCanchon() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/metrics/canchon`);
  if (!res.ok) return { total_camiones: null as number | null };
  return res.json() as Promise<{ total_camiones: number | null }>;
}

function pickIncludes(map: Map<string, DashboardItem>, patterns: string[]): DashboardItem | null {
  const entries = Array.from(map.entries());
  for (const p of patterns) {
    const lower = p.toLowerCase();
    for (const [k, item] of entries) {
      if (k.toLowerCase().includes(lower)) return item;
    }
  }
  return null;
}

function sumKeysIncluding(map: Map<string, DashboardItem>, patterns: string[]): number | null {
  const entries = Array.from(map.entries());
  let total = 0;
  let found = false;
  for (const [k, item] of entries) {
    const kl = k.toLowerCase();
    if (patterns.some((p) => kl.includes(p.toLowerCase()))) {
      if (Number.isFinite(item.value)) {
        total += item.value;
        found = true;
      }
    }
  }
  return found ? total : null;
}

export function KpiHero() {
  const energia = useDashboardData('energia');
  const produccion = useDashboardData('produccion');
  const trapiche = useDashboardData('trapiche');
  const alerts = useQuery({
    queryKey: ['alerts', 'active'],
    queryFn: fetchAlerts,
    refetchInterval: 30_000,
  });
  const canchon = useQuery({
    queryKey: ['canchon', 'resumen'],
    queryFn: fetchCanchon,
    refetchInterval: 60_000, // 1 min
  });

  // Molienda actual: Molienda_Kilos en kg
  const moliendaItem = pickIncludes(trapiche, ['molienda_kilos', 'molienda_actual', 'molienda']);

  // Bolsas de azúcar producidas: busca varios aliases
  const bolsasItem = pickIncludes(produccion, [
    'produccion_bolsas',
    'bolsas_dia',
    'bolsas_azucar',
    'azucar_diaria',
    'bolsas',
  ]);

  // Consumo gas total: suma de Caudal_Gas_Cald2/3/6
  const gasTotal = sumKeysIncluding(energia, ['caudal_gas']);

  // Total camiones en canchón (production.v_canchon_resumen) — refresca cada 60s
  const totalCamiones = canchon.data?.total_camiones ?? null;

  const activeCount = (alerts.data as { alerts?: unknown[] } | undefined)?.alerts?.length ?? 0;
  const criticalCount =
    ((alerts.data as { alerts?: { severity: string }[] } | undefined)?.alerts ?? []).filter(
      (a) => a.severity === 'critical',
    ).length;

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3 px-3 sm:px-4 py-3"
      style={{
        // Stagger natural via animation-delay (los KpiCard ya animan entrada)
      }}
    >
      <KpiCard
        label="Molienda actual"
        value={moliendaItem?.value ?? '—'}
        unit={moliendaItem?.unit ?? 'kg'}
        precision={0}
        icon={IconScale}
        status="accent"
        footer={moliendaItem ? `${(moliendaItem.value / 1000).toFixed(2)} t equivalente` : 'Sin señal'}
      />
      <KpiCard
        label="Bolsas azúcar"
        value={bolsasItem?.value ?? '—'}
        unit={bolsasItem?.unit ?? 'bolsas'}
        precision={0}
        icon={IconChartBar}
        status="accent"
        footer={bolsasItem ? 'Producidas hoy' : 'Esperando Node-RED'}
      />
      <KpiCard
        label="Consumo gas total"
        value={gasTotal ?? '—'}
        unit="m³/h"
        precision={1}
        icon={IconFlame}
        status="warn"
        footer={gasTotal != null ? 'Suma calderas 2+3+6' : 'Sin caudales'}
      />
      <KpiCard
        label="Camiones en canchón"
        value={totalCamiones ?? '—'}
        unit="camiones"
        precision={0}
        icon={IconTruck}
        status={totalCamiones != null && totalCamiones > 0 ? 'accent' : 'warn'}
        footer={
          canchon.isLoading
            ? 'Consultando…'
            : totalCamiones != null
            ? 'Actualiza c/ 1 min'
            : 'Sin señal'
        }
      />
      <KpiCard
        label="Alertas activas"
        value={activeCount}
        precision={0}
        icon={IconAlertTriangle}
        status={criticalCount > 0 ? 'alarm' : activeCount > 0 ? 'warn' : 'ok'}
        pulse={criticalCount > 0}
        footer={
          criticalCount > 0
            ? `${criticalCount} críticas`
            : activeCount > 0
            ? `${activeCount} pendientes`
            : 'Operación normal'
        }
      />
    </div>
  );
}
