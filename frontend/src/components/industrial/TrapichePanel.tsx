'use client';

import { useMemo, useEffect, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import {
  IconBolt,
  IconDroplet,
  IconGauge,
  IconRotateClockwise,
  IconRipple,
  IconTemperature,
  IconScale,
  IconActivity,
  IconChartBar,
  IconWaveSine,
  IconFlask,
} from '@tabler/icons-react';
import { useDashboardData, type DashboardItem } from '@/lib/hooks/useDashboardData';
import { useTrapicheEstado, type EstadoTrapiche } from '@/lib/hooks/useTrapicheEstado';
import { useThresholds, evaluateValue } from '@/lib/hooks/useThresholds';
import { useTileOrder } from '@/lib/hooks/useTileOrder';
import { useKanbanLock } from '@/lib/hooks/useKanbanLock';
import { PremiumPanel } from './PremiumPanel';
import { PremiumTile, type TileAccent } from './PremiumTile';
import { SortableGroup } from './SortableGroup';
import { SortableTile } from './SortableTile';
import { cn } from '@/lib/utils/cn';

/**
 * Whitelist KPIs del trapiche real. Solo keys del whitelist se renderizan.
 * Molienda actual se quitó (vive en KpiHero superior).
 */
interface TrapicheSlot {
  id: string;
  label: string;
  match: string[];      // substring match case-insensitive
  unit: string;
  precision: number;
}

const TRAPICHE_SLOTS: TrapicheSlot[] = [
  { id: 'caudal_imbibicion',       label: 'Caudal imbibición',     match: ['agua_imbibicion_caudal', 'bb_imbibicion_caudal', 'caudal_imbibicion', 'caudal_imb'], unit: 'm³/h', precision: 2 },
  { id: 'nivel_imbibicion',        label: 'Nivel imbibición',      match: ['agua_imbibicion_nivel', 'bb_imbibicion_nivel', 'nivel_imbibicion'],                unit: '%',     precision: 1 },
  { id: 'temperatura_imbibicion',  label: 'Temp. imbibición',      match: ['agua_imbibicion_temp', 'bb_imbibicion_temp', 'temperatura_imbibicion', 'temp_imbibicion'], unit: '°C', precision: 1 },
];

// Slot especial combinado — Presión 6° molino Este + Oeste en un solo tile
const PRESION_ESTE_KEYS = ['6to_molino_presion_este', 'presion_6to_este'];
const PRESION_OESTE_KEYS = ['6to_molino_presion_oeste', 'presion_6to_oeste'];

function pickItem(map: Map<string, DashboardItem>, candidates: string[]): DashboardItem | null {
  const entries = Array.from(map.entries());
  for (const cand of candidates) {
    const lower = cand.toLowerCase();
    for (const [key, item] of entries) {
      if (key.toLowerCase() === lower) return item;
    }
  }
  return null;
}

function iconFor(key: string): React.ReactNode {
  const k = key.toLowerCase();
  if (k.includes('temp')) return <IconTemperature size={14} />;
  if (k.includes('press') || k.includes('pres')) return <IconGauge size={14} />;
  if (k.includes('rpm') || k.includes('velocidad')) return <IconRotateClockwise size={14} />;
  if (k.includes('caudal') || k.includes('flujo')) return <IconRipple size={14} />;
  if (k.includes('nivel')) return <IconChartBar size={14} />;
  if (k.includes('humed') || k.includes('agua')) return <IconDroplet size={14} />;
  if (k.includes('ph') || k.includes('encal')) return <IconFlask size={14} />;
  if (k.includes('color')) return <IconWaveSine size={14} />;
  if (k.includes('molienda') || k.includes('cana') || k.includes('caña')) return <IconScale size={14} />;
  return <IconActivity size={14} />;
}

function pickBySlot(map: Map<string, DashboardItem>, slot: TrapicheSlot): DashboardItem | null {
  const entries = Array.from(map.entries());
  for (const m of slot.match) {
    const lower = m.toLowerCase();
    for (const [key, item] of entries) {
      if (key.toLowerCase().includes(lower)) return item;
    }
  }
  return null;
}

async function fetchVelMolino() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/guardia/vel-molino`);
  if (!res.ok) return null;
  return res.json() as Promise<{
    stats?: { promedio_rpm?: number; maximo_rpm?: number; minimo_rpm?: number };
    promedio?: number;
    maximo?: number;
    minimo?: number;
    turno?: string;
    mensaje?: string;
  } | null>;
}

async function fetchParadaAbierta(): Promise<{ inicio_ts: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  try {
    const res = await fetch(
      `${url}/rest/v1/v_parada_activa?select=inicio_ts,motivo,maquina&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': 'production' } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { inicio_ts: string }[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function formatDuracion(inicio: string): string {
  const diffMs = Date.now() - new Date(inicio).getTime();
  const totalMin = Math.floor(diffMs / 60_000);
  const dias = Math.floor(totalMin / 1440);
  const horas = Math.floor((totalMin % 1440) / 60);
  const min = totalMin % 60;
  if (dias > 0) return `${dias}d ${horas}h ${min}min`;
  if (horas > 0) return `${horas}h ${min}min`;
  return `${min}min`;
}

async function fetchBagazo() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/metrics/trapiche-bagazo`);
  if (!res.ok) return null;
  return res.json() as Promise<{
    pol_bagazo: number | null;
    pol_bagazo_hora: string | null;
    humedad_bagazo: number | null;
    humedad_bagazo_hora: string | null;
    fibra_bagazo: number | null;
    fibra_bagazo_hora: string | null;
    pol_cachaza: number | null;
    pol_cachaza_hora: string | null;
    humedad_cachaza: number | null;
    humedad_cachaza_hora: string | null;
  } | null>;
}

export function TrapichePanel() {
  const data = useDashboardData('trapiche');
  const energia = useDashboardData('energia');
  const { data: thresholds } = useThresholds();
  const velMolinoQ = useQuery({
    queryKey: ['guardia', 'vel-molino'],
    queryFn: fetchVelMolino,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });
  const bagazoQ = useQuery({
    queryKey: ['metrics', 'trapiche-bagazo'],
    queryFn: fetchBagazo,
    refetchInterval: 10 * 60_000,
    staleTime: 10 * 60_000,
  });
  const paradaQ = useQuery({
    queryKey: ['parada-activa'],
    queryFn: fetchParadaAbierta,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });
  // Ticker en vivo: recalcula duración cada 60s sin re-fetch
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  const paradaDuracion = paradaQ.data?.inicio_ts
    ? formatDuracion(paradaQ.data.inicio_ts)
    : null;
  const polBagazo = bagazoQ.data?.pol_bagazo ?? null;
  const humedadBagazo = bagazoQ.data?.humedad_bagazo ?? null;
  const fibraBagazo = bagazoQ.data?.fibra_bagazo ?? null;
  const polCachaza = bagazoQ.data?.pol_cachaza ?? null;
  const humedadCachaza = bagazoQ.data?.humedad_cachaza ?? null;
  const velRealtime = pickItem(data, [
    'Molino1_Velocidad',
    'molino1_velocidad',
    'rpm_primer_molino',
    'rpm_1er_molino',
    'vel_primer_molino',
  ]);
  const velCachedPromedio =
    velMolinoQ.data?.stats?.promedio_rpm ?? velMolinoQ.data?.promedio ?? null;
  const velPromedio = velRealtime?.value ?? velCachedPromedio;
  const velIsRealtime = !!velRealtime;

  const estado = useTrapicheEstado(data, energia);

  const resolvedSlots = useMemo(
    () => TRAPICHE_SLOTS.map((slot) => ({ slot, item: pickBySlot(data, slot) })),
    [data],
  );

  // Slot combinado Presión 6° molino — promedio Este+Oeste + delta en hint
  const presionCombinada = useMemo(() => {
    const este = pickItem(data, PRESION_ESTE_KEYS);
    const oeste = pickItem(data, PRESION_OESTE_KEYS);
    if (!este && !oeste) return null;
    return {
      este: este?.value ?? null,
      oeste: oeste?.value ?? null,
      unit: este?.unit ?? oeste?.unit ?? 'kg/cm²',
      updatedAt: este?.updated_at ?? oeste?.updated_at,
    };
  }, [data]);

  const presionPromedio =
    presionCombinada && presionCombinada.este != null && presionCombinada.oeste != null
      ? (presionCombinada.este + presionCombinada.oeste) / 2
      : presionCombinada?.este ?? presionCombinada?.oeste ?? null;

  const present = resolvedSlots.filter((r) => r.item != null).length + (presionCombinada ? 1 : 0);
  const expected = TRAPICHE_SLOTS.length + 1; // +1 por el slot combinado
  const hasAny = data.size > 0;

  // IDs orden tiles para drag-drop (RPM + presión + bagazo + slots resueltos)
  const tileIds = useMemo(() => {
    const ids: string[] = [];
    if (velPromedio != null) ids.push('rpm_primer_molino');
    if (presionCombinada) ids.push('presion_6to_combinada');
    if (polBagazo != null) ids.push('bagazo_pol');
    if (humedadBagazo != null) ids.push('bagazo_humedad');
    if (fibraBagazo != null) ids.push('bagazo_fibra');
    if (polCachaza != null) ids.push('cachaza_pol');
    if (humedadCachaza != null) ids.push('cachaza_humedad');
    resolvedSlots.filter((r) => r.item != null).forEach((r) => ids.push(r.slot.id));
    return ids;
  }, [velPromedio, presionCombinada, polBagazo, humedadBagazo, fibraBagazo, polCachaza, humedadCachaza, resolvedSlots]);
  const { ordered: orderedIds, saveOrder } = useTileOrder('trapiche', tileIds);
  const { locked } = useKanbanLock();

  const renderTileById = (id: string) => {
    if (id === 'bagazo_pol' && polBagazo != null) {
      return (
        <PremiumTile
          icon={<IconDroplet size={14} />}
          label="Pol bagazo"
          value={polBagazo}
          unit="%"
          precision={2}
          accent="primary"
        />
      );
    }
    if (id === 'bagazo_humedad' && humedadBagazo != null) {
      return (
        <PremiumTile
          icon={<IconDroplet size={14} />}
          label="Humedad bagazo"
          value={humedadBagazo}
          unit="%"
          precision={2}
          accent="primary"
        />
      );
    }
    if (id === 'bagazo_fibra' && fibraBagazo != null) {
      return (
        <PremiumTile
          icon={<IconChartBar size={14} />}
          label="Fibra bagazo"
          value={fibraBagazo}
          unit="%"
          precision={2}
          accent="accent"
        />
      );
    }
    if (id === 'cachaza_pol' && polCachaza != null) {
      return (
        <PremiumTile
          icon={<IconFlask size={14} />}
          label="Pol cachaza"
          value={polCachaza}
          unit="%"
          precision={2}
          accent="accent"
        />
      );
    }
    if (id === 'cachaza_humedad' && humedadCachaza != null) {
      return (
        <PremiumTile
          icon={<IconDroplet size={14} />}
          label="Humedad cachaza"
          value={humedadCachaza}
          unit="%"
          precision={2}
          accent="accent"
        />
      );
    }
    if (id === 'rpm_primer_molino' && velPromedio != null) {
      return (
        <PremiumTile
          icon={<IconRotateClockwise size={14} />}
          label="RPM primer molino"
          value={velPromedio}
          unit="rpm"
          precision={1}
          accent="warn"
          hint={velIsRealtime ? 'Tiempo real' : 'Promedio turno previo'}
        />
      );
    }
    if (id === 'presion_6to_combinada' && presionCombinada) {
      return (
        <PremiumTile
          icon={<IconGauge size={14} />}
          label="Presión 6° molino"
          value={presionPromedio ?? undefined}
          unit={presionCombinada.unit}
          precision={2}
          accent="accent"
          updatedAt={presionCombinada.updatedAt}
          hint={
            presionCombinada.este != null && presionCombinada.oeste != null
              ? `E ${presionCombinada.este.toFixed(2)} · O ${presionCombinada.oeste.toFixed(2)}`
              : presionCombinada.este != null
              ? `E ${presionCombinada.este.toFixed(2)} · O —`
              : `E — · O ${presionCombinada.oeste?.toFixed(2) ?? '—'}`
          }
        />
      );
    }
    const resolved = resolvedSlots.find((r) => r.slot.id === id);
    if (!resolved || !resolved.item) return null;
    const { slot, item } = resolved;
    const realKey = Array.from(data.keys()).find((k) =>
      slot.match.some((m) => k.toLowerCase().includes(m.toLowerCase())),
    );
    const evalResult = realKey
      ? evaluateValue(thresholds, 'trapiche', realKey, item.value)
      : { status: 'ok' as const, severity: null, reason: null, threshold: null };
    return (
      <PremiumTile
        icon={iconFor(slot.id)}
        label={slot.label}
        value={item.value}
        unit={item.unit ?? slot.unit}
        precision={slot.precision}
        accent={accentForKey(slot.id)}
        updatedAt={item.updated_at}
        alert={
          evalResult.status === 'out' && evalResult.severity && evalResult.reason
            ? {
                severity: evalResult.severity,
                reason: evalResult.reason,
                min: evalResult.threshold?.min_value,
                max: evalResult.threshold?.max_value,
              }
            : null
        }
      />
    );
  };

  return (
    <PremiumPanel
      title="TRAPICHE"
      subtitle={hasAny
        ? `Molinos · Extracción de jugo · ${present}/${expected} sensores en línea`
        : 'Molinos · Extracción de jugo · esperando señal de Node-RED'}
      icon={<IconBolt size={18} className="text-primary-light" />}
      accent="primary"
    >
      <div className="space-y-3">
        <EstadoBanner estado={estado} paradaDuracion={paradaDuracion} />

        {data.size === 0 ? (
          <EmptyState />
        ) : (
          <SortableGroup items={orderedIds} onReorder={saveOrder} disabled={locked}>
            <div className="grid grid-cols-3 gap-2">
              {orderedIds.map((id) => (
                <SortableTile key={id} id={id}>
                  {renderTileById(id)}
                </SortableTile>
              ))}
            </div>
          </SortableGroup>
        )}
      </div>
    </PremiumPanel>
  );
}

function accentForKey(key: string): TileAccent {
  const k = key.toLowerCase();
  if (k.includes('temp')) return 'warn';
  if (k.includes('press') || k.includes('pres')) return 'accent';
  if (k.includes('caudal') || k.includes('imbibicion')) return 'accent';
  if (k.includes('humed') || k.includes('nivel')) return 'primary';
  if (k.includes('rpm') || k.includes('velocidad')) return 'warn';
  if (k.includes('pol') || k.includes('bagazo')) return 'primary';
  return 'primary';
}

const ESTADO_CONFIG = {
  funcionando: {
    label: 'Funcionando',
    color: 'var(--ok)',
    bg: 'var(--ok-soft)',
    border: 'var(--ok)',
    glow: '0 0 28px var(--ok-soft), inset 0 0 16px var(--ok-soft)',
    pulse: true,
  },
  parado: {
    label: 'Parado',
    color: 'var(--danger)',
    bg: 'var(--danger-soft)',
    border: 'var(--danger)',
    glow: '0 0 24px var(--danger-soft), inset 0 0 14px var(--danger-soft)',
    pulse: false,
  },
} as const;

function EstadoBanner({ estado, paradaDuracion }: { estado: EstadoTrapiche; paradaDuracion?: string | null }) {
  const config = ESTADO_CONFIG[estado];
  return (
    <AnimatePresence mode="wait">
      <m.div
        key={estado}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="relative flex items-center justify-center gap-4 px-6 py-3 rounded-xl border-2 overflow-hidden"
        style={{
          background: `linear-gradient(90deg, ${config.bg} 0%, var(--bg-inset) 50%, ${config.bg} 100%)`,
          borderColor: config.border,
          boxShadow: config.glow,
        }}
      >
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse at center, ${config.bg}, transparent 70%)`,
          animation: config.pulse ? 'pulse 2.5s ease-in-out infinite' : undefined,
        }}
      />

      <span className="text-2xs uppercase tracking-[0.22em] text-text-muted font-medium relative">
        Estado actual
      </span>

      <span
        className={cn(
          'relative flex items-center justify-center w-4 h-4 rounded-full',
          config.pulse && 'animate-pulse',
        )}
        style={{ background: config.color, boxShadow: `0 0 20px ${config.color}` }}
      >
        {config.pulse && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: config.color, opacity: 0.65 }}
          />
        )}
      </span>

      <span
        className="relative flex flex-col items-center gap-0.5"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <span
          className="text-2xl font-extrabold uppercase tracking-[0.18em]"
          style={{ color: config.color, textShadow: `0 0 10px ${config.bg}` }}
        >
          {config.label}
        </span>
        {estado === 'parado' && paradaDuracion && (
          <span
            className="text-2xs font-medium tracking-wide normal-case"
            style={{ color: config.color, opacity: 0.7 }}
          >
            ⏱ {paradaDuracion}
          </span>
        )}
      </span>
      </m.div>
    </AnimatePresence>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
      <div
        className="relative w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(74,156,216,0.15), transparent)',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      >
        <IconBolt size={24} className="text-primary-light/60" />
      </div>
      <p className="text-xs text-text-muted">Esperando datos del trapiche desde Node-RED…</p>
    </div>
  );
}
