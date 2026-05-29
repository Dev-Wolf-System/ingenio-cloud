'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePasswordSession } from '@/lib/hooks/usePasswordSession';
import {
  type Area,
  type Severity,
  type Threshold,
  type SensorKey,
  type HistoryAlert,
  AREAS,
  apiUrl,
  LS_MODAL,
  LS_BEEP,
  LS_VOICE,
  getLs,
  setLs,
} from '../_types';

// ── fetch functions ──────────────────────────────────────────────────────────

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

// ── hook ─────────────────────────────────────────────────────────────────────

export function useAlertasConfig() {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        severity: 'warn' as Severity,
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

  return {
    // data
    sensors,
    thresholds,
    loading,
    saving,
    saveOk,
    areaFilter,
    setAreaFilter,
    search,
    setSearch,
    history,
    historyTotal,
    historyLoading,
    // toggles
    modalEnabled,
    beepEnabled,
    voiceEnabled,
    // actions
    reload,
    reloadHistory,
    getThreshold,
    update,
    filteredSensors,
    onSave,
    toggleModal,
    toggleBeep,
    toggleVoice,
    stats,
    // password gate
    unlock,
    pwdGateOpen,
    setPwdGateOpen,
    setPendingAction,
    handlePwdSuccess,
  };
}
