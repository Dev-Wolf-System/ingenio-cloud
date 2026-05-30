'use client';

import { useMemo, useState } from 'react';
import { IconTruck, IconClock, IconActivityHeartbeat, IconScale } from '@tabler/icons-react';
import { m } from 'motion/react';
import { cn } from '@/lib/utils/cn';
import { PremiumTile } from '@/components/industrial/PremiumTile';
import { useCanchon } from '../_hooks/useMoliendaCloud';
import { useMovimientosTipo } from '../_hooks/useMoliendaCloud';
import type { MovimientoRow } from '../_types';

// ── tipos ─────────────────────────────────────────────────────────────────────
type Categoria = 'Caña' | 'Alcohol' | 'Cachaza' | 'Varios';

interface CategoriaStats {
  camiones: number;
  toneladas: number;
  pendiente: boolean; // mapeo no confirmado
}

// ── helpers ────────────────────────────────────────────────────────────────────

function formatMinutes(m: number): string {
  if (m >= 120) return `${(m / 60).toFixed(1)} h`;
  return `${Math.round(m)} min`;
}

function relativaDesdeAhora(iso: string): string {
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `hace ${hrs} h ${rem} min` : `hace ${hrs} h`;
}

/**
 * Clasifica un MovimientoRow por categoría.
 * Solo Caña ('C') está confirmado. El resto se agrupa en "Varios" con nota pendiente.
 */
function clasificar(row: MovimientoRow): Categoria {
  if (row.tipo_pesada === 'C') return 'Caña';
  // Alcohol/Cachaza: mapeo de tipo_pesada NO confirmado — agrupamos bajo Varios hasta validación
  return 'Varios';
}

function buildStats(rows: MovimientoRow[]): Record<Categoria, CategoriaStats> {
  const base: Record<Categoria, CategoriaStats> = {
    Caña:    { camiones: 0, toneladas: 0, pendiente: false },
    Alcohol: { camiones: 0, toneladas: 0, pendiente: true },
    Cachaza: { camiones: 0, toneladas: 0, pendiente: true },
    Varios:  { camiones: 0, toneladas: 0, pendiente: true },
  };

  for (const row of rows) {
    const cat = clasificar(row);
    base[cat].camiones += 1;
    base[cat].toneladas += (row.peso_neto ?? 0) / 1000;
  }

  return base;
}

// ── pill selector ──────────────────────────────────────────────────────────────

const CATEGORIAS: Categoria[] = ['Caña', 'Alcohol', 'Cachaza', 'Varios'];

interface PillSelectorProps {
  selected: Categoria;
  onChange: (c: Categoria) => void;
}

function PillSelector({ selected, onChange }: PillSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {CATEGORIAS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={cn(
            'px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide border transition-all duration-200',
            selected === c
              ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-light)]'
              : 'border-[var(--border)] bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:border-[var(--primary-light)]/40',
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

// ── tile de movimientos por categoría ─────────────────────────────────────────

interface MovTileProps {
  stats: CategoriaStats;
  categoria: Categoria;
  loading: boolean;
}

function MovTile({ stats, categoria, loading }: MovTileProps) {
  const isPendiente = stats.pendiente;

  const hint = isPendiente
    ? 'categorías a confirmar'
    : stats.camiones > 0
    ? `${stats.toneladas.toFixed(1)} t · últ. 24 h`
    : 'sin movimientos (24 h)';

  return (
    <div className="flex flex-col h-full">
      <PillSelector
        selected={categoria}
        onChange={() => {/* controlado desde fuera */}}
      />
      <PremiumTile
        icon={<IconTruck size={14} />}
        label={`Movimientos · ${categoria}`}
        value={loading ? undefined : stats.camiones}
        unit="camiones"
        precision={0}
        accent={isPendiente ? 'neutral' : 'primary'}
        size="hero"
        hint={loading ? 'Cargando…' : hint}
      />
    </div>
  );
}

// ── tile wrapper con selector ─────────────────────────────────────────────────

interface MovimientosSelectorTileProps {
  rows: MovimientoRow[] | null;
  loading: boolean;
  categoria: Categoria;
  onCategoria: (c: Categoria) => void;
}

function MovimientosSelectorTile({ rows, loading, categoria, onCategoria }: MovimientosSelectorTileProps) {
  const stats = useMemo(() => buildStats(rows ?? []), [rows]);
  const sel = stats[categoria];
  const isPendiente = sel.pendiente;

  const hint = loading
    ? 'Cargando…'
    : isPendiente
    ? `categorías a confirmar · ${sel.toneladas.toFixed(1)} t`
    : sel.camiones > 0
    ? `${sel.toneladas.toFixed(1)} t · últ. 24 h`
    : 'sin movimientos (24 h)';

  return (
    <div className="flex flex-col h-full">
      <PillSelector selected={categoria} onChange={onCategoria} />
      <div className="flex-1">
        <PremiumTile
          icon={<IconScale size={14} />}
          label={`Movimientos · ${categoria}`}
          value={loading ? undefined : sel.camiones}
          unit="camiones"
          precision={0}
          accent={isPendiente ? 'neutral' : 'primary'}
          size="hero"
          hint={hint}
        />
      </div>
    </div>
  );
}

// ── skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="h-28 rounded-xl border-2 border-[var(--border)] animate-pulse"
      style={{ background: 'linear-gradient(135deg, var(--surface-tile-from), var(--surface-tile-to))' }}
    />
  );
}

// ── component principal ────────────────────────────────────────────────────────

export function MovimientosHero() {
  const [categoria, setCategoria] = useState<Categoria>('Caña');

  const canchonQ = useCanchon();
  const movQ = useMovimientosTipo();

  const canchon = canchonQ.data?.data ?? null;
  const rows: MovimientoRow[] = movQ.data?.data ?? [];

  const totalCamiones   = typeof canchon?.total_camiones === 'number' ? canchon.total_camiones : null;
  const esperando       = typeof canchon?.esperando_balanza === 'number' ? canchon.esperando_balanza : null;
  const pesadosSinSalir = typeof canchon?.pesados_sin_salir === 'number' ? canchon.pesados_sin_salir : null;
  const minProm         = typeof canchon?.minutos_espera_promedio === 'number' ? canchon.minutos_espera_promedio : null;
  const minMax          = typeof canchon?.minutos_espera_max === 'number' ? canchon.minutos_espera_max : null;

  // Última salida registrada
  const ultimaPasada = useMemo(() => {
    if (!rows.length) return null;
    let latest = '';
    for (const r of rows) {
      if (r.salida_at && r.salida_at > latest) latest = r.salida_at;
    }
    return latest || null;
  }, [rows]);

  const canchonLoading = canchonQ.isLoading;
  const movLoading     = movQ.isLoading;

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 px-3 sm:px-4 py-3"
    >
      {/* Tile 1 — Movimientos por categoría con pill selector */}
      <div className="col-span-2 xl:col-span-2">
        {movLoading ? (
          <Skeleton />
        ) : (
          <MovimientosSelectorTile
            rows={rows}
            loading={movLoading}
            categoria={categoria}
            onCategoria={setCategoria}
          />
        )}
      </div>

      {/* Tile 2 — Camiones en canchón */}
      {canchonLoading ? (
        <Skeleton />
      ) : (
        <PremiumTile
          icon={<IconTruck size={14} />}
          label="Camiones en canchón"
          value={totalCamiones ?? undefined}
          unit="camiones"
          precision={0}
          accent={totalCamiones != null && totalCamiones > 0 ? 'primary' : 'neutral'}
          size="hero"
          hint={
            totalCamiones != null
              ? [
                  esperando != null ? `${esperando} esperando` : null,
                  pesadosSinSalir != null ? `${pesadosSinSalir} pesados` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'en canchón'
              : canchonLoading
              ? 'Cargando…'
              : 'Sin datos'
          }
        />
      )}

      {/* Tile 3 — Tiempo de espera */}
      {canchonLoading ? (
        <Skeleton />
      ) : (
        <PremiumTile
          icon={<IconClock size={14} />}
          label="Tiempo de espera"
          value={minProm != null ? formatMinutes(minProm) : undefined}
          accent={
            minProm == null
              ? 'neutral'
              : minProm > 120
              ? 'danger'
              : minProm > 60
              ? 'warn'
              : 'accent'
          }
          size="hero"
          hint={
            minMax != null
              ? `máx ${formatMinutes(minMax)}`
              : minProm == null
              ? 'Sin datos'
              : undefined
          }
        />
      )}

      {/* Tile 4 — Última pasada */}
      {movLoading ? (
        <Skeleton />
      ) : (
        <PremiumTile
          icon={<IconActivityHeartbeat size={14} />}
          label="Última pasada"
          value={ultimaPasada ? relativaDesdeAhora(ultimaPasada) : undefined}
          accent={ultimaPasada ? 'accent' : 'neutral'}
          size="hero"
          hint={
            ultimaPasada
              ? new Date(ultimaPasada.endsWith('Z') ? ultimaPasada : ultimaPasada + 'Z')
                  .toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
              : 'Sin movimientos (24 h)'
          }
        />
      )}
    </m.div>
  );
}
