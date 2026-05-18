'use client';

import { useQuery } from '@tanstack/react-query';
import {
  IconScale,
  IconChartBar,
  IconFlame,
  IconAlertTriangle,
  IconTruck,
  IconWaveSine,
} from '@tabler/icons-react';
import { useDashboardData, type DashboardItem } from '@/lib/hooks/useDashboardData';
import { PremiumTile, type TileAccent } from './PremiumTile';

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

async function fetchColorCintaLarga() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/metrics/color-cinta-larga`);
  if (!res.ok) return { color_icumsa: null, humedad: null, hora_lectura: null };
  return res.json() as Promise<{
    color_icumsa: number | null;
    humedad: number | null;
    hora_lectura: string | null;
  }>;
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
    refetchInterval: 60_000,
  });
  const colorCinta = useQuery({
    queryKey: ['color', 'cinta-larga'],
    queryFn: fetchColorCintaLarga,
    refetchInterval: 600_000, // 10 min
  });

  // Molienda Kilos del trapiche
  const moliendaItem = pickIncludes(trapiche, ['molienda_kilos', 'molienda_actual', 'molienda']);

  // Bolsas azúcar
  const bolsasItem = pickIncludes(produccion, [
    'produccion_bolsas',
    'bolsas_dia',
    'bolsas_azucar',
    'azucar_diaria',
    'bolsas',
  ]);

  // Consumo gas total
  const gasTotal = sumKeysIncluding(energia, ['caudal_gas']);

  // Camiones canchón
  const totalCamiones = canchon.data?.total_camiones ?? null;

  // Color azúcar (cinta larga) — actualiza c/ 10 min
  const colorIcumsa = colorCinta.data?.color_icumsa ?? null;
  const humedadCinta = colorCinta.data?.humedad ?? null;
  const horaLectura = colorCinta.data?.hora_lectura ?? null;
  const horaLecturaFmt = horaLectura
    ? new Date(horaLectura).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires',
      })
    : null;

  // Alertas activas
  const alertsList = (alerts.data as { alerts?: { severity: string }[] } | undefined)?.alerts ?? [];
  const activeCount = alertsList.length;
  const criticalCount = alertsList.filter((a) => a.severity === 'critical').length;
  const alertAccent: TileAccent = criticalCount > 0 ? 'danger' : activeCount > 0 ? 'warn' : 'accent';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 px-3 sm:px-4 py-3">
      <PremiumTile
        icon={<IconScale size={14} />}
        label="Molienda actual"
        value={moliendaItem?.value}
        unit={moliendaItem?.unit ?? 'kg'}
        precision={0}
        accent="primary"
        size="hero"
        updatedAt={moliendaItem?.updated_at}
        hint={
          moliendaItem
            ? `${(moliendaItem.value / 1000).toFixed(2)} t equivalente`
            : 'Sin señal'
        }
      />
      <PremiumTile
        icon={<IconChartBar size={14} />}
        label="Bolsas azúcar"
        value={bolsasItem?.value}
        unit={bolsasItem?.unit ?? 'bolsas'}
        precision={0}
        accent="accent"
        size="hero"
        updatedAt={bolsasItem?.updated_at}
        hint={bolsasItem ? 'Producidas hoy' : 'Esperando Node-RED'}
      />
      <PremiumTile
        icon={<IconFlame size={14} />}
        label="Consumo gas total"
        value={gasTotal ?? undefined}
        unit="m³/h"
        precision={1}
        accent="warn"
        size="hero"
        hint={gasTotal != null ? 'Suma calderas 2+3+6' : 'Sin caudales'}
      />
      <PremiumTile
        icon={<IconWaveSine size={14} />}
        label="Color azúcar"
        value={colorIcumsa ?? undefined}
        unit="UI"
        precision={0}
        accent="accent"
        size="hero"
        hint={
          humedadCinta != null
            ? `Humedad ${humedadCinta.toFixed(2)}%${horaLecturaFmt ? ` · ${horaLecturaFmt}` : ''}`
            : 'Sin lectura hoy'
        }
      />
      <PremiumTile
        icon={<IconTruck size={14} />}
        label="Camiones en canchón"
        value={totalCamiones ?? undefined}
        unit="camiones"
        precision={0}
        accent={totalCamiones != null && totalCamiones > 0 ? 'primary' : 'warn'}
        size="hero"
        hint={
          canchon.isLoading
            ? 'Consultando…'
            : totalCamiones != null
            ? 'Actualiza c/ 1 min'
            : 'Sin señal'
        }
      />
      <PremiumTile
        icon={<IconAlertTriangle size={14} />}
        label="Alertas activas"
        value={activeCount}
        precision={0}
        accent={alertAccent}
        size="hero"
        hint={
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
