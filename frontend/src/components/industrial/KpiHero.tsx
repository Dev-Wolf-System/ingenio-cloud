'use client';

import { useQuery } from '@tanstack/react-query';
import {
  IconScale,
  IconChartBar,
  IconFlame,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useDashboardData, type DashboardItem } from '@/lib/hooks/useDashboardData';
import { KpiCard } from './KpiCard';

async function fetchAlerts() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/alerts/active`);
  if (!res.ok) return { alerts: [] };
  return res.json();
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

  // Molienda actual: Molienda_Kilos (kg/h o kg total) → /1000 = t/h
  const moliendaItem = pickIncludes(trapiche, ['molienda_kilos', 'molienda_actual', 'molienda']);
  const moliendaTH = moliendaItem ? moliendaItem.value / 1000 : null;

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

  // Vapor Vg1 (referencia y estado tamiz K2)
  const vaporVg1 = pickIncludes(energia, ['presion_vapor_vg1', 'vapor_vg1']);
  const tamizK2Func = vaporVg1 != null && vaporVg1.value > 1.9;

  const activeCount = (alerts.data as { alerts?: unknown[] } | undefined)?.alerts?.length ?? 0;
  const criticalCount =
    ((alerts.data as { alerts?: { severity: string }[] } | undefined)?.alerts ?? []).filter(
      (a) => a.severity === 'critical',
    ).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3 px-3 sm:px-4 py-3">
      <KpiCard
        label="Molienda actual"
        value={moliendaTH ?? '—'}
        unit="t/h"
        precision={1}
        icon={IconScale}
        status="accent"
        footer={moliendaItem ? `${(moliendaItem.value).toFixed(0)} kg/h` : 'Sin señal'}
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
        label="Vapor Vg1 · Tamiz K2"
        value={vaporVg1?.value ?? '—'}
        unit={vaporVg1?.unit ?? 'Kg/cm²'}
        precision={2}
        icon={IconFlame}
        status={tamizK2Func ? 'ok' : 'warn'}
        pulse={tamizK2Func}
        footer={tamizK2Func ? 'K2: Funcionamiento' : vaporVg1 ? 'K2: Parado · Vg1 < 1.9' : 'Sin señal'}
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
