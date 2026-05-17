'use client';

import { useMemo } from 'react';
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
import { PremiumPanel } from './PremiumPanel';
import { PremiumTile, type TileAccent } from './PremiumTile';
import { cn } from '@/lib/utils/cn';

type EstadoTrapiche = 'funcionando' | 'parado';

const ESTADO_KEYS = ['estado', 'estado_trapiche', 'trapiche_estado', 'status'];
const ACTIVIDAD_MAX_SEG = 300; // 5 min sin updates → parado

/**
 * Whitelist KPIs del trapiche real. Solo keys que matcheen alguna entrada
 * se renderizan. Evita contaminación si Node-RED mezcla areas.
 */
interface TrapicheSlot {
  id: string;             // slot identificador
  label: string;          // label UI
  match: string[];        // aliases tolerantes (lowercase substring match)
  unit: string;           // unidad default
  precision: number;
}

const TRAPICHE_SLOTS: TrapicheSlot[] = [
  { id: 'molienda_actual',         label: 'Molienda actual',       match: ['molienda_actual', 'molienda'], unit: 't/h',     precision: 1 },
  { id: 'pol',                     label: 'Pol',                   match: ['pol_jugo', 'pol_cana', 'pol_caña', 'pol'], unit: '%',       precision: 2 },
  { id: 'humedad_cana',            label: 'Humedad caña',          match: ['humedad_jugo', 'humedad_cana', 'humedad_caña', 'humedad'], unit: '%',  precision: 2 },
  { id: 'presion_sexto_molino',    label: 'Presión 6° molino',     match: ['presion_sexto_molino', 'presion_6to_molino', 'presion_6_molino', 'p_sexto_molino'], unit: 'kg/cm²', precision: 2 },
  { id: 'rpm_primer_molino',       label: 'RPM primer molino',     match: ['rpm_primer_molino', 'rpm_1er_molino', 'rpm_1_molino', 'velocidad_primer_molino', 'vel_primer_molino'], unit: 'rpm', precision: 1 },
  { id: 'caudal_imbibicion',       label: 'Caudal imbibición',     match: ['caudal_imbibicion', 'caudal_imb', 'flujo_imbibicion'], unit: 'm³/h', precision: 2 },
  { id: 'temperatura_imbibicion',  label: 'Temp. imbibición',      match: ['temperatura_imbibicion', 'temp_imbibicion', 't_imbibicion'], unit: '°C', precision: 1 },
];

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

function deriveEstadoFromActivity(map: Map<string, DashboardItem>): EstadoTrapiche {
  if (map.size === 0) return 'parado';
  let mostRecent = 0;
  Array.from(map.values()).forEach((i) => {
    const t = new Date(i.updated_at).getTime();
    if (t > mostRecent) mostRecent = t;
  });
  if (!mostRecent) return 'parado';
  const segDesdeUltimo = (Date.now() - mostRecent) / 1000;
  return segDesdeUltimo <= ACTIVIDAD_MAX_SEG ? 'funcionando' : 'parado';
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

export function TrapichePanel() {
  const data = useDashboardData('trapiche');

  const estado = useMemo<EstadoTrapiche>(() => {
    const explicit = parseEstadoExplicit(pickItem(data, ESTADO_KEYS));
    if (explicit) return explicit;
    return deriveEstadoFromActivity(data);
  }, [data]);

  // Resolver cada slot del whitelist a su item correspondiente (o null)
  const resolvedSlots = useMemo(
    () => TRAPICHE_SLOTS.map((slot) => ({ slot, item: pickBySlot(data, slot) })),
    [data],
  );

  const moliendaSlot = resolvedSlots.find((r) => r.slot.id === 'molienda_actual');
  const otherSlots = resolvedSlots.filter((r) => r.slot.id !== 'molienda_actual');

  const present = resolvedSlots.filter((r) => r.item != null).length;
  const expected = TRAPICHE_SLOTS.length;

  return (
    <PremiumPanel
      title="TRAPICHE"
      subtitle={`Línea de molienda · ${present}/${expected} KPIs activos${present < expected ? ' · faltan datos de Node-RED' : ''}`}
      icon={<IconBolt size={18} className="text-primary-light" />}
      accent="primary"
    >
      <div className="space-y-3">
        <EstadoBanner estado={estado} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="md:col-span-1">
            <PremiumTile
              icon={<IconScale size={14} />}
              label={moliendaSlot!.slot.label}
              value={moliendaSlot!.item?.value}
              unit={moliendaSlot!.item?.unit ?? moliendaSlot!.slot.unit}
              precision={moliendaSlot!.slot.precision}
              accent="primary"
              big
              updatedAt={moliendaSlot!.item?.updated_at}
            />
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-2">
            {otherSlots.slice(0, 2).map(({ slot, item }) => (
              <PremiumTile
                key={slot.id}
                icon={iconFor(slot.id)}
                label={slot.label}
                value={item?.value}
                unit={item?.unit ?? slot.unit}
                precision={slot.precision}
                accent="accent"
                updatedAt={item?.updated_at}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
          {otherSlots.slice(2).map(({ slot, item }) => (
            <PremiumTile
              key={slot.id}
              icon={iconFor(slot.id)}
              label={slot.label}
              value={item?.value}
              unit={item?.unit ?? slot.unit}
              precision={slot.precision}
              accent={accentForKey(slot.id)}
              updatedAt={item?.updated_at}
            />
          ))}
        </div>

        {present === 0 && <EmptyState />}
      </div>
    </PremiumPanel>
  );
}

function accentForKey(key: string): TileAccent {
  const k = key.toLowerCase();
  if (k.includes('temp')) return 'warn';
  if (k.includes('press') || k.includes('pres')) return 'accent';
  return 'neutral';
}

const ESTADO_CONFIG = {
  funcionando: {
    label: 'Funcionando',
    color: '#00E5A0',
    bg: 'rgba(0,229,160,0.14)',
    border: 'rgba(0,229,160,0.55)',
    glow: '0 0 48px rgba(0,229,160,0.50), inset 0 0 24px rgba(0,229,160,0.14)',
    pulse: true,
  },
  parado: {
    label: 'Parado',
    color: '#FF4757',
    bg: 'rgba(255,71,87,0.14)',
    border: 'rgba(255,71,87,0.55)',
    glow: '0 0 40px rgba(255,71,87,0.40), inset 0 0 20px rgba(255,71,87,0.12)',
    pulse: false,
  },
} as const;

function EstadoBanner({ estado }: { estado: EstadoTrapiche }) {
  const config = ESTADO_CONFIG[estado];
  return (
    <div
      className="relative flex items-center justify-center gap-4 px-6 py-3 rounded-xl border-2 overflow-hidden"
      style={{
        background: `linear-gradient(90deg, ${config.bg} 0%, rgba(15,24,37,0.4) 50%, ${config.bg} 100%)`,
        borderColor: config.border,
        boxShadow: config.glow,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse at center, ${config.color}22, transparent 70%)`,
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
        className="text-2xl font-bold uppercase tracking-[0.22em] mono relative"
        style={{
          color: config.color,
          textShadow: `0 0 18px ${config.color}AA, 0 0 4px ${config.color}`,
          fontFamily: 'var(--font-display)',
        }}
      >
        {config.label}
      </span>
    </div>
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
