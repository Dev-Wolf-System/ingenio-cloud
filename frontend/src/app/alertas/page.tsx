'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconAlertTriangle,
  IconAlertCircle,
  IconInfoCircle,
  IconCheck,
  IconFilter,
  IconRefresh,
  IconHistory,
  IconClockFilled,
  IconBell,
  IconBellOff,
  IconVolume,
  IconVolumeOff,
  IconWindowMaximize,
  IconWindowMinimize,
  IconSettings,
} from '@tabler/icons-react';
import { TopBar } from '@/components/layout/TopBar';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import { PasswordGate } from '@/components/ui/PasswordGate';
import { usePasswordSession } from '@/lib/hooks/usePasswordSession';

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

interface HistoryAlert {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  area: string;
  title: string;
  message: string | null;
  metadata: { value?: number; min_value?: number; max_value?: number; unit?: string } | null;
  detected_at: string;
  resolved_at: string | null;
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

const LS_MODAL = 'alert_modal_enabled';
const LS_BEEP  = 'alert_beep_enabled';
const LS_VOICE = 'alert_voice_enabled';

function getLs(key: string, def: boolean): boolean {
  if (typeof window === 'undefined') return def;
  const v = localStorage.getItem(key);
  return v === null ? def : v === 'true';
}

function setLs(key: string, val: boolean): void {
  localStorage.setItem(key, String(val));
  // Notificar a otras pestañas/componentes
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: String(val) }));
}

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

async function fetchHistory(limit = 100): Promise<{ alerts: HistoryAlert[]; total: number }> {
  const res = await fetch(`${apiUrl}/alerts/history?limit=${limit}`);
  if (!res.ok) return { alerts: [], total: 0 };
  return res.json();
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
  const [history, setHistory] = useState<HistoryAlert[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Password session
  const { unlocked, unlock } = usePasswordSession();
  const [pwdGateOpen, setPwdGateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Audio & modal toggles (sincronizados con localStorage)
  const [modalEnabled, setModalEnabled] = useState(true);
  const [beepEnabled, setBeepEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  useEffect(() => {
    setModalEnabled(getLs(LS_MODAL, true));
    setBeepEnabled(getLs(LS_BEEP, true));
    setVoiceEnabled(getLs(LS_VOICE, false));
  }, []);

  const runProtected = useCallback((fn: () => void) => {
    if (unlocked) {
      fn();
    } else {
      setPendingAction(() => fn);
      setPwdGateOpen(true);
    }
  }, [unlocked]);

  const handlePwdSuccess = useCallback(() => {
    setPwdGateOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const reload = async () => {
    setLoading(true);
    const [s, t] = await Promise.all([fetchSensors(), fetchThresholds()]);
    setSensors(s);
    const m = new Map<string, Threshold>();
    t.forEach((row) => m.set(`${row.area}::${row.key}`, row));
    setThresholds(m);
    setLoading(false);
  };

  const reloadHistory = async () => {
    setHistoryLoading(true);
    const h = await fetchHistory(200);
    setHistory(h.alerts);
    setHistoryTotal(h.total);
    setHistoryLoading(false);
  };

  useEffect(() => {
    reload();
    reloadHistory();
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

  const doSave = async () => {
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

  const onSave = () => runProtected(doSave);

  const toggleModal = () => runProtected(() => {
    const next = !modalEnabled;
    setModalEnabled(next);
    setLs(LS_MODAL, next);
  });

  const toggleBeep = () => runProtected(() => {
    const next = !beepEnabled;
    setBeepEnabled(next);
    setLs(LS_BEEP, next);
  });

  const toggleVoice = () => runProtected(() => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    setLs(LS_VOICE, next);
  });

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

          {/* Panel de configuración de avisos */}
          <PremiumPanel
            title="CONFIGURACIÓN DE AVISOS"
            subtitle="Modal automático · Beep · Voz IA · requieren contraseña para modificar"
            icon={<IconSettings size={18} className="text-primary-light" />}
            accent="primary"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-1">
              {/* Toggle: Modal automático */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  {modalEnabled
                    ? <IconWindowMaximize size={17} className="text-primary-light flex-shrink-0" />
                    : <IconWindowMinimize size={17} className="text-gray-600 flex-shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-white">Modal automático</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                      {modalEnabled ? 'Activo — se abre al detectar alerta' : 'Desactivado'}
                    </p>
                  </div>
                </div>
                <Toggle enabled={modalEnabled} onChange={toggleModal} />
              </div>

              {/* Toggle: Beep */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  {beepEnabled
                    ? <IconBell size={17} className="text-warn flex-shrink-0" />
                    : <IconBellOff size={17} className="text-gray-600 flex-shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-white">Beep de alerta</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                      {beepEnabled ? 'Activo — suena al detectar' : 'Desactivado'}
                    </p>
                  </div>
                </div>
                <Toggle enabled={beepEnabled} onChange={toggleBeep} />
              </div>

              {/* Toggle: Voz */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  {voiceEnabled
                    ? <IconVolume size={17} className="text-ok flex-shrink-0" />
                    : <IconVolumeOff size={17} className="text-gray-600 flex-shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-white">Voz IA (OpenAI TTS)</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                      {voiceEnabled ? 'Activa — genera audio por alerta' : 'Desactivada · sin costo API'}
                    </p>
                  </div>
                </div>
                <Toggle enabled={voiceEnabled} onChange={toggleVoice} />
              </div>
            </div>
          </PremiumPanel>

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

          {/* ── Historial ── */}
          <PremiumPanel
            title="HISTORIAL DE ALERTAS"
            subtitle={`${historyTotal} eventos registrados · inicio → normalización`}
            icon={<IconHistory size={18} className="text-primary-light" />}
            accent="neutral"
            headerRight={
              <button
                onClick={reloadHistory}
                disabled={historyLoading}
                className="inline-flex items-center gap-1.5 text-2xs lg:text-xs text-text-muted hover:text-primary-light transition-colors px-3 py-1.5 rounded-md hover:bg-bg-hover border border-border"
              >
                <IconRefresh size={12} className={historyLoading ? 'animate-spin' : ''} />
                Recargar
              </button>
            }
          >
            {historyLoading && history.length === 0 ? (
              <LoadingState />
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-disabled gap-2">
                <IconHistory size={32} className="opacity-30" />
                <p className="text-sm">Sin alertas resueltas aún</p>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] lg:text-xs uppercase tracking-wider text-text-muted border-b border-border">
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Sev.</th>
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Área</th>
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Alerta</th>
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Valor</th>
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">
                        <span className="flex items-center gap-1"><IconClockFilled size={10} />Inicio</span>
                      </th>
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium">Normalización</th>
                      <th className="px-3 lg:px-4 py-2 lg:py-3 font-medium text-center">Duración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const sev = SEVERITY_STYLE[h.severity] ?? SEVERITY_STYLE.info;
                      const SevIcon = h.severity === 'critical' ? IconAlertCircle : h.severity === 'warn' ? IconAlertTriangle : IconInfoCircle;
                      const durMin = h.resolved_at
                        ? Math.round((new Date(h.resolved_at).getTime() - new Date(h.detected_at).getTime()) / 60_000)
                        : null;
                      const fmtDur = durMin == null ? '—' : durMin < 60 ? `${durMin} min` : `${Math.floor(durMin / 60)}h ${durMin % 60}m`;
                      const fmtDate = (iso: string) =>
                        new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={h.id} className="border-b border-border/30 hover:bg-bg-hover/40 transition-colors">
                          <td className="px-3 lg:px-4 py-2 lg:py-3">
                            <SevIcon size={14} style={{ color: sev.color }} />
                          </td>
                          <td className="px-3 lg:px-4 py-2 lg:py-3">
                            <span
                              className="text-[10px] lg:text-xs font-semibold uppercase tracking-wider mono px-1.5 py-0.5 rounded"
                              style={{ color: sev.color, background: sev.bg, border: `1px solid ${sev.color}44` }}
                            >
                              {h.area}
                            </span>
                          </td>
                          <td className="px-3 lg:px-4 py-2 lg:py-3 max-w-[220px]">
                            <p className="text-xs lg:text-sm font-medium text-text-primary truncate">{h.title}</p>
                            {h.message && <p className="text-2xs lg:text-xs text-text-disabled truncate">{h.message}</p>}
                          </td>
                          <td className="px-3 lg:px-4 py-2 lg:py-3">
                            {h.metadata?.value != null ? (
                              <span className="mono tabular-nums text-xs lg:text-sm font-semibold" style={{ color: sev.color }}>
                                {h.metadata.value}{h.metadata.unit ? ` ${h.metadata.unit}` : ''}
                              </span>
                            ) : <span className="text-text-disabled">—</span>}
                          </td>
                          <td className="px-3 lg:px-4 py-2 lg:py-3">
                            <span className="mono text-2xs lg:text-xs text-text-primary tabular-nums">{fmtDate(h.detected_at)}</span>
                          </td>
                          <td className="px-3 lg:px-4 py-2 lg:py-3">
                            {h.resolved_at ? (
                              <span className="mono text-2xs lg:text-xs text-ok tabular-nums">{fmtDate(h.resolved_at)}</span>
                            ) : (
                              <span className="text-2xs lg:text-xs text-warn font-semibold">activa</span>
                            )}
                          </td>
                          <td className="px-3 lg:px-4 py-2 lg:py-3 text-center">
                            <span className={`mono text-xs lg:text-sm tabular-nums font-semibold ${durMin != null && durMin > 60 ? 'text-danger' : durMin != null && durMin > 15 ? 'text-warn' : 'text-ok'}`}>
                              {fmtDur}
                            </span>
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

      {/* Password gate */}
      <PasswordGate
        isOpen={pwdGateOpen}
        onSuccess={handlePwdSuccess}
        onClose={() => { setPwdGateOpen(false); setPendingAction(null); }}
        unlock={unlock}
        title="Configuración protegida"
        description="Ingresá la contraseña para modificar esta configuración."
      />
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
