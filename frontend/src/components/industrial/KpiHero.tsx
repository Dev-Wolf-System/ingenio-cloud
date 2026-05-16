'use client';

import { useQuery } from '@tanstack/react-query';
import {
  IconActivity,
  IconChartBar,
  IconBolt,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { KpiCard } from './KpiCard';

async function fetchAlerts() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/alerts/active`);
  if (!res.ok) return { alerts: [] };
  return res.json();
}

export function KpiHero() {
  const energia = useDashboardData('energia');
  const produccion = useDashboardData('produccion');
  const alerts = useQuery({
    queryKey: ['alerts', 'active'],
    queryFn: fetchAlerts,
    refetchInterval: 30_000,
  });

  const findItem = (map: Map<string, { value: number; unit: string | null }>, candidates: string[]) => {
    for (const c of candidates) {
      if (map.has(c)) return map.get(c)!;
    }
    return null;
  };

  const molienda = findItem(produccion, [
    'Promedio_Molienda',
    'Molienda_Promedio',
    'Caudal_Molienda',
    'Produccion_Bolsas_Dia',
  ]);
  const azucar = findItem(produccion, [
    'Produccion_Bolsas_Dia',
    'Produccion_Azucar_Dia',
    'Azucar_Diaria',
  ]);
  const potenciaSiemens = findItem(energia, ['Potencia_Activa_Siemens']);
  const potenciaWeg = findItem(energia, ['Potencia_Activa_Weg']);
  const generacionTotal =
    (potenciaSiemens?.value ?? 0) + (potenciaWeg?.value ?? 0) || null;

  const activeCount = (alerts.data as { alerts?: unknown[] } | undefined)?.alerts?.length ?? 0;
  const criticalCount =
    ((alerts.data as { alerts?: { severity: string }[] } | undefined)?.alerts ?? []).filter(
      (a) => a.severity === 'critical',
    ).length;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 px-4 py-3">
      <KpiCard
        label="Molienda actual"
        value={molienda?.value ?? '—'}
        unit={molienda?.unit ?? 't/h'}
        precision={0}
        icon={IconActivity}
        status="accent"
      />
      <KpiCard
        label="Producción azúcar"
        value={azucar?.value ?? '—'}
        unit={azucar?.unit ?? 'bolsas'}
        precision={0}
        icon={IconChartBar}
        status="accent"
      />
      <KpiCard
        label="Generación eléctrica"
        value={generacionTotal ?? '—'}
        unit={potenciaSiemens?.unit ?? 'kW'}
        precision={0}
        icon={IconBolt}
        status="accent"
        footer={
          potenciaSiemens || potenciaWeg
            ? `S: ${potenciaSiemens?.value ?? 0} · W: ${potenciaWeg?.value ?? 0}`
            : undefined
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
