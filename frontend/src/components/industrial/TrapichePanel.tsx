'use client';

import { useMemo } from 'react';
import {
  IconBolt,
  IconCircleFilled,
  IconDroplet,
  IconGauge,
  IconRotateClockwise,
  IconRipple,
  IconTemperature,
  IconScale,
} from '@tabler/icons-react';
import { useDashboardData, type DashboardItem } from '@/lib/hooks/useDashboardData';
import { formatNumber, formatRelative } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

type EstadoTrapiche = 'funcionando' | 'parado' | 'desconocido';

const ESTADO_KEYS = ['estado', 'estado_trapiche', 'trapiche_estado', 'status'];
const KEY_MAP: Record<string, string[]> = {
  pol: ['pol', 'pol_jugo', 'pol_caña', 'pol_cana'],
  humedad: ['humedad', 'humedad_jugo', 'humedad_caña', 'humedad_cana'],
  presion_sexto_molino: ['presion_sexto_molino', 'presion_6to_molino', 'presion_6_molino', 'p_sexto_molino'],
  rpm_primer_molino: ['rpm_primer_molino', 'rpm_1er_molino', 'rpm_1_molino', 'velocidad_primer_molino'],
  caudal_imbibicion: ['caudal_imbibicion', 'caudal_imb', 'flujo_imbibicion'],
  temperatura_imbibicion: ['temperatura_imbibicion', 'temp_imbibicion', 't_imbibicion'],
  molienda_actual: ['molienda_actual', 'molienda', 'molienda_actual_t_h', 'molienda_t_h'],
};

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
  // numeric 1/0
  if (typeof item.value === 'number') {
    if (item.value === 1) return 'funcionando';
    if (item.value === 0) return 'parado';
  }
  // string display
  const s = (item.display ?? '').toString().toLowerCase();
  if (s.includes('func') || s.includes('on') || s === 'true' || s === '1') return 'funcionando';
  if (s.includes('par') || s.includes('off') || s === 'false' || s === '0') return 'parado';
  return 'desconocido';
}

export function TrapichePanel() {
  const data = useDashboardData('trapiche');

  const estado = useMemo<EstadoTrapiche>(() => {
    const item = pickItem(data, ESTADO_KEYS);
    return parseEstado(item);
  }, [data]);

  const m = (k: keyof typeof KEY_MAP) => pickItem(data, KEY_MAP[k]);

  const pol = m('pol');
  const humedad = m('humedad');
  const presion = m('presion_sexto_molino');
  const rpm = m('rpm_primer_molino');
  const caudal = m('caudal_imbibicion');
  const temp = m('temperatura_imbibicion');
  const molienda = m('molienda_actual');

  const empty = data.size === 0;

  return (
    <section
      className="relative flex flex-col rounded-2xl border border-primary-light/15 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 30% 0%, rgba(74,156,216,0.10), transparent 60%), radial-gradient(ellipse 70% 50% at 90% 100%, rgba(0,229,160,0.05), transparent 60%), linear-gradient(135deg, rgba(15,24,37,0.95), rgba(10,16,26,0.98))',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 0 1px rgba(74,156,216,0.06), 0 12px 48px rgba(0,0,0,0.4)',
      }}
    >
      {/* Top accent line */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(74,156,216,0.6) 30%, rgba(0,229,160,0.6) 70%, transparent)',
        }}
      />

      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-5 pt-4 pb-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div
            className="relative w-10 h-10 rounded-xl flex items-center justify-center border border-primary-light/20"
            style={{
              background:
                'linear-gradient(135deg, rgba(74,156,216,0.12), rgba(0,229,160,0.08))',
              boxShadow: '0 0 20px rgba(74,156,216,0.15)',
            }}
          >
            <IconBolt size={20} className="text-primary-light" />
          </div>
          <div className="leading-tight">
            <h2
              className="text-xl font-bold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #4FBFE5 0%, #FFFFFF 60%, #00E5A0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontFamily: 'var(--font-display)',
              }}
            >
              TRAPICHE
            </h2>
            <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted font-medium mt-0.5">
              Línea de molienda · Tiempo real
            </p>
          </div>
        </div>

        <EstadoHero estado={estado} />
      </header>

      {/* Body */}
      <div className="flex-1 p-4">
        {empty ? (
          <EmptyState />
        ) : (
          <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            <TrapicheTile
              icon={<IconScale size={14} />}
              label="Molienda actual"
              item={molienda}
              unit={molienda?.unit ?? 't/h'}
              precision={1}
              accent="primary"
              big
            />
            <TrapicheTile
              icon={<IconDroplet size={14} />}
              label="Pol"
              item={pol}
              unit={pol?.unit ?? '%'}
              precision={2}
            />
            <TrapicheTile
              icon={<IconDroplet size={14} />}
              label="Humedad"
              item={humedad}
              unit={humedad?.unit ?? '%'}
              precision={2}
            />
            <TrapicheTile
              icon={<IconGauge size={14} />}
              label="Presión 6° molino"
              item={presion}
              unit={presion?.unit ?? 'kg/cm²'}
              precision={2}
            />
            <TrapicheTile
              icon={<IconRotateClockwise size={14} />}
              label="RPM primer molino"
              item={rpm}
              unit={rpm?.unit ?? 'rpm'}
              precision={1}
            />
            <TrapicheTile
              icon={<IconRipple size={14} />}
              label="Caudal imbibición"
              item={caudal}
              unit={caudal?.unit ?? 'm³/h'}
              precision={2}
            />
            <TrapicheTile
              icon={<IconTemperature size={14} />}
              label="Temp. imbibición"
              item={temp}
              unit={temp?.unit ?? '°C'}
              precision={1}
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
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
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-full border"
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

// ─────────────────────────────────────────────────────────────────────
function TrapicheTile({
  icon,
  label,
  item,
  unit,
  precision = 1,
  accent = 'neutral',
  big = false,
}: {
  icon: React.ReactNode;
  label: string;
  item: DashboardItem | null;
  unit?: string;
  precision?: number;
  accent?: 'primary' | 'neutral';
  big?: boolean;
}) {
  const hasValue = item != null && Number.isFinite(item.value);

  return (
    <div
      className={cn(
        'relative rounded-xl border overflow-hidden group transition-all duration-300',
        accent === 'primary'
          ? 'border-primary-light/25'
          : 'border-border hover:border-primary-light/30',
      )}
      style={{
        background:
          accent === 'primary'
            ? 'linear-gradient(135deg, rgba(74,156,216,0.10), rgba(15,24,37,0.7))'
            : 'linear-gradient(135deg, rgba(26,34,54,0.6), rgba(15,24,37,0.85))',
        backdropFilter: 'blur(8px)',
        boxShadow: accent === 'primary' ? '0 4px 20px rgba(74,156,216,0.10)' : undefined,
      }}
    >
      {/* Hover glow */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 100%, rgba(74,156,216,0.10), transparent 60%)',
        }}
      />

      <div className={cn('relative', big ? 'p-3.5' : 'p-3')}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                'flex items-center justify-center w-5 h-5 rounded-md shrink-0',
                accent === 'primary' ? 'text-primary-light' : 'text-text-muted',
              )}
              style={
                accent === 'primary'
                  ? { background: 'rgba(74,156,216,0.12)' }
                  : { background: 'rgba(255,255,255,0.03)' }
              }
            >
              {icon}
            </span>
            <span className="text-[10px] uppercase tracking-[0.10em] text-text-muted font-medium truncate">
              {label}
            </span>
          </div>
          {hasValue && (
            <IconCircleFilled
              size={5}
              className={accent === 'primary' ? 'text-primary-light' : 'text-ok'}
            />
          )}
        </div>

        <div className="flex items-baseline gap-1 mono">
          <span
            className={cn(
              'font-semibold tabular-nums leading-none',
              big ? 'text-2xl' : 'text-lg',
              accent === 'primary' ? 'text-primary-light' : 'text-text-primary',
            )}
          >
            {hasValue ? formatNumber(item!.value, precision) : '—'}
          </span>
          {unit && <span className="text-2xs text-text-muted font-medium">{unit}</span>}
        </div>

        {item?.updated_at && (
          <div className="text-[9px] text-text-disabled mono mt-1">
            {formatRelative(item.updated_at)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
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
      <p className="text-xs text-text-muted">
        Esperando datos del trapiche desde Node-RED…
      </p>
    </div>
  );
}
