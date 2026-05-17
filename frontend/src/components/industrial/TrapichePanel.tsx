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

type EstadoTrapiche = 'funcionando' | 'parado' | 'desconocido';

const ESTADO_KEYS = ['estado', 'estado_trapiche', 'trapiche_estado', 'status'];
const MOLIENDA_KEYS = ['molienda_actual', 'molienda', 'molienda_actual_t_h', 'molienda_t_h'];

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

function parseEstado(item: DashboardItem | null): EstadoTrapiche {
  if (!item) return 'desconocido';
  if (typeof item.value === 'number') {
    if (item.value === 1) return 'funcionando';
    if (item.value === 0) return 'parado';
  }
  const s = (item.display ?? '').toString().toLowerCase();
  if (s.includes('func') || s === 'on' || s === 'true' || s === '1') return 'funcionando';
  if (s.includes('par') || s === 'off' || s === 'false' || s === '0') return 'parado';
  return 'desconocido';
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

export function TrapichePanel() {
  const data = useDashboardData('trapiche');

  const estado = useMemo<EstadoTrapiche>(() => {
    const item = pickItem(data, ESTADO_KEYS);
    return parseEstado(item);
  }, [data]);

  const molienda = pickItem(data, MOLIENDA_KEYS);

  // Resto de keys (excluye estado + molienda principal)
  const otherEntries = useMemo(() => {
    const excludeSet = new Set([...ESTADO_KEYS, ...MOLIENDA_KEYS].map((k) => k.toLowerCase()));
    return Array.from(data.entries())
      .filter(([k]) => !excludeSet.has(k.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const empty = data.size === 0;
  const count = data.size;

  return (
    <PremiumPanel
      title="TRAPICHE"
      subtitle={`Línea de molienda · Tiempo real · ${count} señal${count === 1 ? '' : 'es'}`}
      icon={<IconBolt size={18} className="text-primary-light" />}
      accent="primary"
      headerRight={<EstadoHero estado={estado} />}
    >
      {empty ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {molienda && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="md:col-span-1">
                <PremiumTile
                  icon={<IconScale size={14} />}
                  label="Molienda actual"
                  value={molienda.value}
                  unit={molienda.unit ?? 't/h'}
                  precision={1}
                  accent="primary"
                  big
                  updatedAt={molienda.updated_at}
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-2 gap-2">
                {otherEntries.slice(0, 2).map(([key, item]) => (
                  <PremiumTile
                    key={key}
                    icon={iconFor(key)}
                    label={key.replaceAll('_', ' ')}
                    value={item.value}
                    unit={item.unit ?? ''}
                    precision={2}
                    accent="accent"
                    updatedAt={item.updated_at}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            {(molienda ? otherEntries.slice(2) : otherEntries).map(([key, item]) => (
              <PremiumTile
                key={key}
                icon={iconFor(key)}
                label={key.replaceAll('_', ' ')}
                value={item.value}
                unit={item.unit ?? ''}
                precision={2}
                accent={accentForKey(key)}
                updatedAt={item.updated_at}
              />
            ))}
          </div>
        </div>
      )}
    </PremiumPanel>
  );
}

function accentForKey(key: string): TileAccent {
  const k = key.toLowerCase();
  if (k.includes('temp')) return 'warn';
  if (k.includes('press') || k.includes('pres')) return 'accent';
  return 'neutral';
}

function EstadoHero({ estado }: { estado: EstadoTrapiche }) {
  const config = {
    funcionando: {
      label: 'Funcionando',
      color: '#00E5A0',
      bg: 'rgba(0,229,160,0.10)',
      border: 'rgba(0,229,160,0.35)',
      glow: '0 0 24px rgba(0,229,160,0.35)',
      pulse: true,
    },
    parado: {
      label: 'Parado',
      color: '#FF4757',
      bg: 'rgba(255,71,87,0.10)',
      border: 'rgba(255,71,87,0.35)',
      glow: '0 0 20px rgba(255,71,87,0.25)',
      pulse: false,
    },
    desconocido: {
      label: 'Sin señal',
      color: '#6B7A9E',
      bg: 'rgba(107,122,158,0.08)',
      border: 'rgba(107,122,158,0.25)',
      glow: 'none',
      pulse: false,
    },
  }[estado];

  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-full border shrink-0"
      style={{
        background: config.bg,
        borderColor: config.border,
        boxShadow: config.glow,
      }}
    >
      <span
        className={cn('relative flex items-center justify-center w-2.5 h-2.5 rounded-full', config.pulse && 'animate-pulse')}
        style={{ background: config.color, boxShadow: `0 0 12px ${config.color}` }}
      >
        {config.pulse && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: config.color, opacity: 0.6 }}
          />
        )}
      </span>
      <span
        className="text-xs font-semibold uppercase tracking-[0.14em] mono"
        style={{ color: config.color }}
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
