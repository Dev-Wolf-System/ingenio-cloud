'use client';

import { useState } from 'react';
import {
  IconBolt,
  IconGauge,
  IconTemperature,
  IconRipple,
  IconChartBar,
  IconDroplet,
  IconActivity,
} from '@tabler/icons-react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { useThresholds, evaluateValue } from '@/lib/hooks/useThresholds';
import { useTileOrder } from '@/lib/hooks/useTileOrder';
import { useKanbanLock } from '@/lib/hooks/useKanbanLock';
import { PremiumPanel } from './PremiumPanel';
import { PremiumTile, type TileAccent } from './PremiumTile';
import { SortableGroup } from './SortableGroup';
import { SortableTile } from './SortableTile';
import { DesgloceModal } from './DesgloceModal';

// Vapor alta + baja → un tile combinado (promedio)
const VAPOR_ALTA_KEY = 'Presion_Vapor_Alta';
const VAPOR_BAJA_KEY = 'Presion_Vapor_Baja';
const VAPOR_COMBO_ID = 'vapor_alta_baja';

// Caudal de vapor caldera 2 + 3 + 6 → un tile combinado (suma total)
const CAUDAL_KEYS = ['Caudal_Vapor_Cald2', 'Caudal_Vapor_Cald3', 'Caudal_Vapor_Cald6'] as const;
const CAUDAL_COMBO_ID = 'caudal_vapor_calderas';

function iconFor(key: string): React.ReactNode {
  const k = key.toLowerCase();
  if (k.includes('temp')) return <IconTemperature size={14} />;
  if (k.includes('press') || k.includes('pres')) return <IconGauge size={14} />;
  if (k.includes('caudal') || k.includes('flujo') || k.includes('vapor')) return <IconRipple size={14} />;
  if (k.includes('nivel')) return <IconChartBar size={14} />;
  if (k.includes('humed') || k.includes('agua')) return <IconDroplet size={14} />;
  return <IconActivity size={14} />;
}

function accentForKey(key: string): TileAccent {
  const k = key.toLowerCase();
  if (k.includes('temp')) return 'warn';
  if (k.includes('press') || k.includes('pres') || k.includes('vapor')) return 'accent';
  if (k.includes('caudal') || k.includes('gas')) return 'warn';
  if (k.includes('potencia') || k.includes('weg') || k.includes('siemens')) return 'accent';
  return 'primary';
}

export function EnergyPanel() {
  const data = useDashboardData('energia');
  const { data: thresholds } = useThresholds();

  const alta = data.get(VAPOR_ALTA_KEY);
  const baja = data.get(VAPOR_BAJA_KEY);
  const hasVapor = alta != null || baja != null;

  const caud2 = data.get(CAUDAL_KEYS[0]);
  const caud3 = data.get(CAUDAL_KEYS[1]);
  const caud6 = data.get(CAUDAL_KEYS[2]);
  const hasCaudal = caud2 != null || caud3 != null || caud6 != null;

  const oculto = new Set<string>([VAPOR_ALTA_KEY, VAPOR_BAJA_KEY, ...CAUDAL_KEYS]);
  const baseKeys = Array.from(data.keys())
    .filter((k) => !oculto.has(k) && !/caudal_gas/i.test(k))
    .sort();
  const allKeys = [
    ...(hasCaudal ? [CAUDAL_COMBO_ID] : []),
    ...(hasVapor ? [VAPOR_COMBO_ID] : []),
    ...baseKeys,
  ];
  const { ordered, saveOrder } = useTileOrder('energia', allKeys);
  const { locked } = useKanbanLock();
  const count = baseKeys.length + (hasVapor ? 1 : 0) + (hasCaudal ? 1 : 0);

  const [caudalModalOpen, setCaudalModalOpen] = useState(false);
  const [vaporModalOpen, setVaporModalOpen] = useState(false);

  return (
    <>
      <PremiumPanel
        title="ENERGÍA"
        subtitle={`Caldera · Vapor · Termodinámica · ${count} señal${count === 1 ? '' : 'es'}`}
        icon={<IconBolt size={18} className="text-warn" />}
        accent="warn"
        headerRight={
          <span className="inline-flex items-center gap-1.5 text-2xs mono text-text-muted px-2 py-1 rounded-md bg-bg-card/60 border border-border shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
            <span className="tabular-nums">{count}</span>
          </span>
        }
      >
        {count === 0 ? (
          <EmptyState />
        ) : (
          <SortableGroup items={ordered} onReorder={saveOrder} disabled={locked}>
            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {ordered.map((key) => {
                if (key === VAPOR_COMBO_ID) {
                  const a = alta?.value ?? null;
                  const b = baja?.value ?? null;
                  const prom = a != null && b != null ? (a + b) / 2 : a ?? b ?? null;
                  return (
                    <SortableTile key={key} id={key}>
                      <PremiumTile
                        icon={<IconGauge size={14} />}
                        label="Presión Vapor A/B"
                        value={prom ?? undefined}
                        unit={alta?.unit ?? baja?.unit ?? 'Kg/cm²'}
                        precision={2}
                        accent="accent"
                        updatedAt={alta?.updated_at ?? baja?.updated_at}
                        hint={
                          `Alta ${a != null ? a.toFixed(2) : '—'} · ` +
                          `Baja ${b != null ? b.toFixed(2) : '—'} · ver detalle`
                        }
                        onClick={() => setVaporModalOpen(true)}
                      />
                    </SortableTile>
                  );
                }
                if (key === CAUDAL_COMBO_ID) {
                  const c2 = caud2?.value ?? null;
                  const c3 = caud3?.value ?? null;
                  const c6 = caud6?.value ?? null;
                  const total = [c2, c3, c6]
                    .filter((v): v is number => v != null)
                    .reduce((a, b) => a + b, 0);
                  return (
                    <SortableTile key={key} id={key}>
                      <PremiumTile
                        icon={<IconRipple size={14} />}
                        label="Caudal Vapor Calderas"
                        value={total}
                        unit={caud2?.unit ?? caud6?.unit ?? 'Tn/H'}
                        precision={1}
                        accent="warn"
                        updatedAt={caud2?.updated_at ?? caud3?.updated_at ?? caud6?.updated_at}
                        hint={
                          `C2 ${c2 != null ? c2.toFixed(1) : '—'} · ` +
                          `C3 ${c3 != null ? c3.toFixed(1) : '—'} · ` +
                          `C6 ${c6 != null ? c6.toFixed(1) : '—'} · ver detalle`
                        }
                        onClick={() => setCaudalModalOpen(true)}
                      />
                    </SortableTile>
                  );
                }
                const item = data.get(key);
                if (!item) return null;
                const evalResult = evaluateValue(thresholds, 'energia', key, item.value);
                return (
                  <SortableTile key={key} id={key}>
                    <PremiumTile
                      icon={iconFor(key)}
                      label={key.replaceAll('_', ' ')}
                      value={item.value}
                      unit={item.unit ?? ''}
                      precision={2}
                      accent={accentForKey(key)}
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
                  </SortableTile>
                );
              })}
            </div>
          </SortableGroup>
        )}
      </PremiumPanel>

      {/* Modal: Caudal Vapor por caldera */}
      <DesgloceModal
        open={caudalModalOpen}
        onClose={() => setCaudalModalOpen(false)}
        title="Caudal Vapor Calderas"
        subtitle="Producción de vapor en tiempo real"
        icon={<IconRipple size={20} />}
        accentVar="var(--warn)"
        precision={1}
        rows={[
          { label: 'Caldera 2', value: caud2?.value ?? null, unit: caud2?.unit ?? 'Tn/H' },
          { label: 'Caldera 3', value: caud3?.value ?? null, unit: caud3?.unit ?? 'Tn/H' },
          { label: 'Caldera 6', value: caud6?.value ?? null, unit: caud6?.unit ?? 'Tn/H' },
        ]}
        totalLabel="Total"
        total={hasCaudal ? [caud2?.value ?? null, caud3?.value ?? null, caud6?.value ?? null]
          .filter((v): v is number => v != null)
          .reduce((a, b) => a + b, 0) : null}
        totalUnit={caud2?.unit ?? caud6?.unit ?? 'Tn/H'}
      />

      {/* Modal: Presión Vapor Alta/Baja */}
      <DesgloceModal
        open={vaporModalOpen}
        onClose={() => setVaporModalOpen(false)}
        title="Presión Vapor"
        subtitle="Alta y baja presión en tiempo real"
        icon={<IconGauge size={20} />}
        accentVar="var(--ok)"
        precision={2}
        rows={[
          { label: 'Alta presión', value: alta?.value ?? null, unit: alta?.unit ?? 'Kg/cm²' },
          { label: 'Baja presión', value: baja?.value ?? null, unit: baja?.unit ?? 'Kg/cm²' },
        ]}
        totalLabel="Promedio"
        total={
          alta?.value != null && baja?.value != null
            ? (alta.value + baja.value) / 2
            : alta?.value ?? baja?.value ?? null
        }
        totalUnit={alta?.unit ?? baja?.unit ?? 'Kg/cm²'}
      />
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
      <div
        className="relative w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(255,184,0,0.15), transparent)',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      >
        <IconBolt size={24} className="text-warn/60" />
      </div>
      <p className="text-xs text-text-muted">Esperando datos de energía…</p>
    </div>
  );
}
