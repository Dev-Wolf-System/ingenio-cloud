'use client';

import { useMemo } from 'react';
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
import { useThresholds, evaluateValue } from '@/lib/hooks/useThresholds';
import { PremiumPanel } from './PremiumPanel';
import { PremiumTile, type TileAccent } from './PremiumTile';
import { cn } from '@/lib/utils/cn';

type EstadoTrapiche = 'funcionando' | 'parado';

const ESTADO_KEYS = ['trapiche_estado', 'estado', 'estado_trapiche', 'status'];
const VAPOR_VG1_KEY_PATTERNS = ['presion_vapor_vg1', 'vapor_vg1', 'p_vapor_vg1'];
const VAPOR_VG1_THRESHOLD = 1.9; // Vg1 > 1.9 (Kg/cm² ≈ Bar) ⇒ Funcionamiento

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
  { id: 'bagazo_pol',              label: 'Pol bagazo',            match: ['bagazo_pol', 'pol_bagazo', 'pol'],                       unit: '%',        precision: 2 },
  { id: 'bagazo_humedad',          label: 'Humedad bagazo',        match: ['bagazo_humedad', 'humedad_bagazo'],                      unit: '%',        precision: 2 },
  { id: 'caudal_imbibicion',       label: 'Caudal imbibición',     match: ['bb_imbibicion_caudal', 'caudal_imbibicion', 'caudal_imb'], unit: 'm³/h', precision: 2 },
  { id: 'nivel_imbibicion',        label: 'Nivel imbibición',      match: ['bb_imbibicion_nivel', 'nivel_imbibicion'],                unit: '%',     precision: 1 },
  { id: 'temperatura_imbibicion',  label: 'Temp. imbibición',      match: ['bb_imbibicion_temp', 'temperatura_imbibicion', 'temp_imbibicion'], unit: '°C', precision: 1 },
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

function parseEstadoExplicit(item: DashboardItem | null): EstadoTrapiche | null {
  if (!item) return null;
  if (typeof item.value === 'number') {
    if (item.value === 1) return 'funcionando';
    if (item.value === 0) return 'parado';
  }
  const s = (item.display ?? '').toString().toLowerCase();
  if (s.includes('func') || s === 'on' || s === 'true' || s === '1') return 'funcionando';
  if (s.includes('par') || s === 'off' || s === 'false' || s === '0') return 'parado';
  return null;
}

function deriveEstadoFromVaporVg1(energia: Map<string, DashboardItem>): EstadoTrapiche | null {
  const entries = Array.from(energia.entries());
  for (const pattern of VAPOR_VG1_KEY_PATTERNS) {
    for (const [k, item] of entries) {
      if (k.toLowerCase().includes(pattern)) {
        return item.value > VAPOR_VG1_THRESHOLD ? 'funcionando' : 'parado';
      }
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
    // Nuevo
    stats?: { promedio_rpm?: number; maximo_rpm?: number; minimo_rpm?: number };
    // Legacy
    promedio?: number;
    maximo?: number;
    minimo?: number;
    turno?: string;
    mensaje?: string;
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
  const velRealtime = pickItem(data, ['rpm_primer_molino', 'rpm_1er_molino', 'vel_primer_molino']);
  const velCachedPromedio =
    velMolinoQ.data?.stats?.promedio_rpm ?? velMolinoQ.data?.promedio ?? null;
  const velPromedio = velRealtime?.value ?? velCachedPromedio;
  const velIsRealtime = !!velRealtime;

  const estado = useMemo<EstadoTrapiche>(() => {
    // Prioridad: 1) Trapiche_Estado explícito  2) Presion_Vapor_Vg1 > 1.9  3) Parado
    const explicit = parseEstadoExplicit(pickItem(data, ESTADO_KEYS));
    if (explicit) return explicit;
    const derived = deriveEstadoFromVaporVg1(energia);
    if (derived) return derived;
    return 'parado';
  }, [data, energia]);

  const resolvedSlots = useMemo(
    () => TRAPICHE_SLOTS.map((slot) => ({ slot, item: pickBySlot(data, slot) })),
    [data],
  );

  // Slot combinado Presión 6° molino — promedio Este+Oeste + delta en hint
  const presionEste = pickItem(data, PRESION_ESTE_KEYS);
  const presionOeste = pickItem(data, PRESION_OESTE_KEYS);
  const presionCombinada =
    presionEste || presionOeste
      ? {
          este: presionEste?.value ?? null,
          oeste: presionOeste?.value ?? null,
          unit: presionEste?.unit ?? presionOeste?.unit ?? 'kg/cm²',
          updatedAt: presionEste?.updated_at ?? presionOeste?.updated_at,
        }
      : null;
  const presionPromedio =
    presionCombinada && presionCombinada.este != null && presionCombinada.oeste != null
      ? (presionCombinada.este + presionCombinada.oeste) / 2
      : presionCombinada?.este ?? presionCombinada?.oeste ?? null;

  const present = resolvedSlots.filter((r) => r.item != null).length + (presionCombinada ? 1 : 0);
  const expected = TRAPICHE_SLOTS.length + 1; // +1 por el slot combinado
  const hasAny = data.size > 0;

  return (
    <PremiumPanel
      title="TRAPICHE"
      subtitle={hasAny
        ? `Línea de molienda · ${present}/${expected} KPIs activos`
        : 'Línea de molienda · esperando datos'}
      icon={<IconBolt size={18} className="text-primary-light" />}
      accent="primary"
    >
      <div className="space-y-3">
        <EstadoBanner estado={estado} />

        {data.size === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {velPromedio != null && (
              <PremiumTile
                key="rpm_primer_molino"
                icon={<IconRotateClockwise size={14} />}
                label="RPM primer molino"
                value={velPromedio}
                unit="rpm"
                precision={1}
                accent="warn"
                hint={velIsRealtime ? 'Tiempo real' : 'Promedio turno previo'}
              />
            )}
            {presionCombinada && (
              <PremiumTile
                key="presion_6to_combinada"
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
            )}
            {resolvedSlots
              .filter(({ item }) => item != null)
              .map(({ slot, item }) => {
                // Buscar la key real en data para matchear con threshold (no slot.id)
                const realKey = Array.from(data.keys()).find((k) =>
                  slot.match.some((m) => k.toLowerCase().includes(m.toLowerCase())),
                );
                const evalResult = realKey
                  ? evaluateValue(thresholds, 'trapiche', realKey, item!.value)
                  : { status: 'ok' as const, severity: null, reason: null, threshold: null };
                return (
                  <PremiumTile
                    key={slot.id}
                    icon={iconFor(slot.id)}
                    label={slot.label}
                    value={item!.value}
                    unit={item!.unit ?? slot.unit}
                    precision={slot.precision}
                    accent={accentForKey(slot.id)}
                    updatedAt={item!.updated_at}
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
              })}
          </div>
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

function EstadoBanner({ estado }: { estado: EstadoTrapiche }) {
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
        className="text-2xl font-extrabold uppercase tracking-[0.18em] relative"
        style={{
          color: config.color,
          textShadow: `0 0 10px ${config.bg}`,
          fontFamily: 'var(--font-body)',
        }}
      >
        {config.label}
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
