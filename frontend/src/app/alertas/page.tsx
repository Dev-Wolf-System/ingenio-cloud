'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconAlertTriangle,
  IconCheck,
  IconFilter,
  IconRefresh,
} from '@tabler/icons-react';
import { TopBar } from '@/components/layout/TopBar';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';

type Area = 'energia' | 'produccion' | 'trapiche';
type Severity = 'info' | 'warn' | 'critical';

interface Threshold {
  id?: string;
  area: Area;
  key: string;
  min_value: number | null;
  max_value: number | null;
  enabled: boolean;
  severity: Severity;
  notes?: string | null;
}

interface SensorKey {
  area: Area;
  key: string;
  unit: string | null;
  value: number;
}

const AREAS: { id: Area; label: string; color: string }[] = [
  { id: 'energia', label: 'Energía', color: '#FFB800' },
  { id: 'produccion', label: 'Producción', color: '#00E5A0' },
  { id: 'trapiche', label: 'Trapiche', color: '#4FBFE5' },
];

const SEVERITY_STYLE: Record<Severity, { color: string; bg: string; label: string }> = {
  info:     { color: '#4FBFE5', bg: 'rgba(79,191,229,0.12)',  label: 'Info' },
  warn:     { color: '#FFB800', bg: 'rgba(255,184,0,0.12)',   label: 'Advertencia' },
  critical: { color: '#FF4757', bg: 'rgba(255,71,87,0.14)',   label: 'Crítica' },
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api';

async function fetchSensors(): Promise<SensorKey[]> {
  // Snapshot SIN filtro de area = devuelve TODAS las áreas en una sola request
  // (evita problemas si algún área tira 500, las otras igual cargan)
  try {
    const res = await fetch(`${apiUrl}/metrics/dashboard-snapshot`);
    if (res.ok) {
      const json = (await res.json()) as { data: Array<{ area: Area; key: string; value: number; unit: string | null }> };
      return (json.data ?? []).map((d) => ({ area: d.area, key: d.key, unit: d.unit, value: d.value }));
    }
  } catch {
    // fallback siguiente
  }
  // Fallback: pedir cada área por separado
  const out: SensorKey[] = [];
  for (const a of AREAS) {
    try {
      const res = await fetch(`${apiUrl}/metrics/dashboard-snapshot?area=${a.id}`);
      if (!res.ok) continue;
      const json = (await res.json()) as { data: Array<{ area: Area; key: string; value: number; unit: string | null }> };
      json.data?.forEach((d) => out.push({ area: d.area, key: d.key, unit: d.unit, value: d.value }));
    } catch {
      // ignore
    }
  }
  return out;
}

async function fetchThresholds(): Promise<Threshold[]> {
  const res = await fetch(`${apiUrl}/alerts/thresholds`);
  if (!res.ok) return [];
  const json = (await res.json()) as { thresholds: Threshold[] };
  return json.thresholds ?? [];
}

async function saveThresholds(thresholds: Threshold[]) {
  const res = await fetch(`${apiUrl}/alerts/thresholds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ thresholds }),
  });
  if (!res.ok) throw new Error(`save ${res.status}`);
  return res.json();
}

export default function AlertasConfigPage() {
  const [sensors, setSensors] = useState<SensorKey[]>([]);
  const [thresholds, setThresholds] = useState<Map<string, Threshold>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [areaFilter, setAreaFilter] = useState<Area | 'all'>('all');
  const [search, setSearch] = useState('');

  const reload = async () => {
    setLoading(true);
    const [s, t] = await Promise.all([fetchSensors(), fetchThresholds()]);
    setSensors(s);
    const m = new Map<string, Threshold>();
    t.forEach((row) => m.set(`${row.area}::${row.key}`, row));
    setThresholds(m);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const getThreshold = (area: Area, key: string): Threshold => {
    const k = `${area}::${key}`;
    return (
      thresholds.get(k) ?? {
        area,
        key,
        min_value: null,
        max_value: null,
        enabled: false,
        severity: 'warn',
      }
    );
  };

  const update = (area: Area, key: string, patch: Partial<Threshold>) => {
    const k = `${area}::${key}`;
    const current = getThreshold(area, key);
    const next = new Map(thresholds);
    next.set(k, { ...current, ...patch });
    setThresholds(next);
    setSaveOk(false);
  };

  const filteredSensors = useMemo(() => {
    const q = search.toLowerCase();
    return sensors
      .filter((s) => areaFilter === 'all' || s.area === areaFilter)
      .filter((s) => !q || s.key.toLowerCase().includes(q))
      .sort((a, b) => a.area.localeCompare(b.area) || a.key.localeCompare(b.key));
  }, [sensors, areaFilter, search]);

  const onSave = async () => {
    setSaving(true);
    setSaveOk(false);
    try {
      const rows = Array.from(thresholds.values()).filter((t) => t.enabled || t.min_value != null || t.max_value != null);
      await saveThresholds(rows);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (err) {
      console.error('save failed', err);
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const enabled = Array.from(thresholds.values()).filter((t) => t.enabled).length;
    const total = sensors.length;
    return { enabled, total };
  }, [thresholds, sensors]);

  return (
    <div className="min-h-screen relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,184,0,0.06), transparent 70%)',
        }}
      />

      <div className="relative z-10">
        <TopBar plant="Sala de Monitoreo · Configuración Alertas" />

        <main className="px-3 sm:px-4 py-3 sm:py-4 max-w-[1600px] mx-auto space-y-3 sm:space-y-4">
          {/* Breadcrumb + actions */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs lg:text-sm text-text-muted hover:text-primary-light transition-colors px-3 lg:px-4 py-1.5 lg:py-2.5 rounded-md hover:bg-bg-hover border border-transparent hover:border-border"
            >
              <IconArrowLeft size={14} className="lg:w-5 lg:h-5" />
              Volver al dashboard
            </Link>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xs mono text-text-muted px-2.5 py-1 rounded-md bg-bg-card/60 border border-border whitespace-nowrap">
                <span className="text-ok font-semibold tabular-nums">{stats.enabled}</span>
                <span className="text-text-muted"> / {stats.total} activos</span>
              </span>
              <button
                onClick={reload}
                className="inline-flex items-center gap-1.5 text-2xs text-text-muted hover:text-primary-light transition-colors px-3 py-1.5 rounded-md hover:bg-bg-hover border border-border"
                title="Recargar"
              >
                <IconRefresh size={13} />
                Recargar
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-md border-2 transition-all"
                style={{
                  background: saveOk
                    ? 'rgba(74,184,150,0.14)'
                    : 'rgba(91,155,201,0.12)',
                  borderColor: saveOk ? 'rgba(74,184,150,0.45)' : 'rgba(91,155,201,0.35)',
                  color: saveOk ? '#4ab896' : '#5b9bc9',
                  boxShadow: saveOk
                    ? '0 0 18px rgba(74,184,150,0.28)'
                    : '0 0 14px rgba(91,155,201,0.14)',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saveOk ? <IconCheck size={14} /> : <IconDeviceFloppy size={14} />}
                {saving ? 'Guardando…' : saveOk ? 'Guardado' : 'Guardar cambios'}
              </button>
            </div>
          </header>

          <PremiumPanel
            title="UMBRALES DE ALERTAS"
            subtitle="Configurá rangos mín/máx por sensor · disparo automático cuando se exceda"
            icon={<IconAlertTriangle size={18} className="text-warn" />}
            accent="warn"
            headerRight={
              <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">
                <div className="flex items-center gap-1 bg-bg-card/60 border border-border rounded-md p-0.5 overflow-x-auto">
                  <FilterPill active={areaFilter === 'all'} onClick={() => setAreaFilter('all')} label="Todas" />
                  {AREAS.map((a) => (
                    <FilterPill
                      key={a.id}
                      active={areaFilter === a.id}
                      onClick={() => setAreaFilter(a.id)}
                      label={a.label}
                      color={a.color}
                    />
                  ))}
                </div>
                <div className="relative">
                  <IconFilter size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-disabled" />
                  <input
                    type="text"
                    placeholder="Buscar sensor…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="text-xs bg-bg-card/60 border border-border rounded-md pl-7 pr-2 py-1.5 text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary-light/50 w-36 sm:w-44"
                  />
                </div>
              </div>
            }
          >
            {loading ? (
              <LoadingState />
            ) : filteredSensors.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] lg:text-xs uppercase tracking-wider text-text-muted border-b border-border">
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Área</th>
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Sensor</th>
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium text-center">Valor actual</th>
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Mínimo</th>
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Máximo</th>
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Severidad</th>
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium text-center">Activa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSensors.map((s) => {
                      const t = getThreshold(s.area, s.key);
                      const areaConf = AREAS.find((a) => a.id === s.area)!;
                      const outOfRange =
                        (t.min_value != null && s.value < t.min_value) ||
                        (t.max_value != null && s.value > t.max_value);
                      return (
                        <tr
                          key={`${s.area}::${s.key}`}
                          className="border-b border-border/30 hover:bg-bg-hover/40 transition-colors"
                        >
                          <td className="px-3 lg:px-4 py-2 lg:py-3">
                            <span
                              className="text-[10px] lg:text-xs font-semibold uppercase tracking-wider mono px-2 lg:px-2.5 py-0.5 lg:py-1 rounded"
                              style={{
                                color: areaConf.color,
                                background: `${areaConf.color}1A`,
                                border: `1px solid ${areaConf.color}33`,
                              }}
                            >
                              {areaConf.label}
                            </span>
                          </td>
                          <td className="px-3 lg:px-4 py-2 lg:py-3">
                            <div className="font-medium text-text-primary text-xs lg:text-sm">
                              {s.key.replaceAll('_', ' ')}
                            </div>
                            <div className="text-2xs lg:text-xs text-text-disabled mono">{s.unit ?? '—'}</div>
                          </td>
                          <td className="px-3 lg:px-4 py-2 lg:py-3 text-center">
                            <span
                              className={`mono tabular-nums text-sm lg:text-base font-semibold ${outOfRange && t.enabled ? 'text-danger' : 'text-text-primary'}`}
                            >
                              {Number.isFinite(s.value) ? s.value.toFixed(2) : '—'}
                            </span>
                          </td>
                          <td className="px-3 lg:px-4 py-2 lg:py-3">
                            <NumberInput
                              value={t.min_value}
                              onChange={(v) => update(s.area, s.key, { min_value: v })}
                            />
                          </td>
                          <td className="px-3 lg:px-4 py-2 lg:py-3">
                            <NumberInput
                              value={t.max_value}
                              onChange={(v) => update(s.area, s.key, { max_value: v })}
                            />
                          </td>
                          <td className="px-3 lg:px-4 py-2 lg:py-3">
                            <SeveritySelect
                              value={t.severity}
                              onChange={(v) => update(s.area, s.key, { severity: v })}
                            />
                          </td>
                          <td className="px-3 lg:px-4 py-2 lg:py-3 text-center">
                            <Toggle
                              enabled={t.enabled}
                              onChange={(v) => update(s.area, s.key, { enabled: v })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PremiumPanel>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
function NumberInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      step="any"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? null : Number(v));
      }}
      placeholder="—"
      className="w-24 mono tabular-nums text-sm bg-bg-card/60 border border-border rounded px-2 py-1 text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary-light/50"
    />
  );
}

function SeveritySelect({
  value,
  onChange,
}: {
  value: Severity;
  onChange: (v: Severity) => void;
}) {
  const conf = SEVERITY_STYLE[value];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Severity)}
      className="text-xs mono uppercase tracking-wider rounded px-2 py-1 border focus:outline-none focus:ring-1 focus:ring-primary-light"
      style={{
        background: conf.bg,
        borderColor: conf.color + '55',
        color: conf.color,
      }}
    >
      <option value="info">INFO</option>
      <option value="warn">ADVERTENCIA</option>
      <option value="critical">CRÍTICA</option>
    </select>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
      style={{
        background: enabled ? 'rgba(0,229,160,0.35)' : 'rgba(107,122,158,0.25)',
        boxShadow: enabled ? '0 0 12px rgba(0,229,160,0.35)' : 'none',
      }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
        style={{ transform: enabled ? 'translateX(20px)' : 'translateX(3px)' }}
      />
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="text-2xs uppercase tracking-wider px-2.5 py-1 rounded transition-all"
      style={{
        background: active
          ? color
            ? `${color}26`
            : 'rgba(74,156,216,0.20)'
          : 'transparent',
        color: active ? (color ?? '#4FBFE5') : 'var(--text-muted, #6B7A9E)',
        fontWeight: active ? 600 : 500,
      }}
    >
      {label}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div
        className="w-10 h-10 rounded-full animate-spin border-2 border-primary-light/20"
        style={{ borderTopColor: '#4FBFE5' }}
      />
      <p className="text-xs text-text-muted">Cargando sensores y umbrales…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <IconAlertTriangle size={28} className="text-text-muted/40" />
      <p className="text-xs text-text-muted">No hay sensores con el filtro actual.</p>
    </div>
  );
}
