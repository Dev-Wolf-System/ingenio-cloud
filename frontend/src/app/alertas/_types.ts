// Shared types, constants and utilities for the alertas module.

export type Area = 'energia' | 'produccion' | 'trapiche';
export type Severity = 'info' | 'warn' | 'critical';

export interface Threshold {
  id?: string;
  area: Area;
  key: string;
  min_value: number | null;
  max_value: number | null;
  enabled: boolean;
  severity: Severity;
  notes?: string | null;
  escalate_after_min?: number | null;
  escalate_drift_pct?: number | null;
}

export interface SensorKey {
  area: Area;
  key: string;
  unit: string | null;
  value: number;
}

export interface HistoryAlert {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  area: string;
  title: string;
  message: string | null;
  metadata: { value?: number; min_value?: number; max_value?: number; unit?: string } | null;
  detected_at: string;
  resolved_at: string | null;
}

export const AREAS: { id: Area; label: string; color: string }[] = [
  { id: 'energia', label: 'Energía', color: '#FFB800' },
  { id: 'produccion', label: 'Producción', color: '#00E5A0' },
  { id: 'trapiche', label: 'Trapiche', color: '#4FBFE5' },
];

export const SEVERITY_STYLE: Record<Severity, { color: string; bg: string; label: string }> = {
  info:     { color: '#4FBFE5', bg: 'rgba(79,191,229,0.12)',  label: 'Info' },
  warn:     { color: '#FFB800', bg: 'rgba(255,184,0,0.12)',   label: 'Advertencia' },
  critical: { color: '#FF4757', bg: 'rgba(255,71,87,0.14)',   label: 'Crítica' },
};

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export const LS_MODAL = 'alert_modal_enabled';
export const LS_BEEP  = 'alert_beep_enabled';
export const LS_VOICE = 'alert_voice_enabled';

export function getLs(key: string, def: boolean): boolean {
  if (typeof window === 'undefined') return def;
  const v = localStorage.getItem(key);
  return v === null ? def : v === 'true';
}

export function setLs(key: string, val: boolean): void {
  localStorage.setItem(key, String(val));
  // Notificar a otras pestañas/componentes
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: String(val) }));
}
