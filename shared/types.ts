/**
 * Tipos compartidos backend ↔ frontend
 */

export type MetricArea = 'energia' | 'produccion' | 'guardia';
export type MetricStatus = 'ok' | 'warn' | 'alarm' | 'unknown';
export type ShiftName = 'morning' | 'afternoon' | 'night';
export type ShiftRef = 'current' | 'previous';
export type AlertSeverity = 'info' | 'warn' | 'critical';

export interface Setpoints {
  min?: number | null;
  max?: number | null;
  warnMin?: number | null;
  warnMax?: number | null;
}

export interface SensorMapping {
  sensor_id: string;
  label: string;
  area: MetricArea;
  category: string | null;
  unit: string;
  setpoint_min: number | null;
  setpoint_max: number | null;
  setpoint_warn_min: number | null;
  setpoint_warn_max: number | null;
  precision: number;
  type: 'numeric' | 'level' | 'boolean' | 'computed' | 'derived';
  computed_from: string[] | null;
  show_in_dashboard: boolean;
  show_in_kpi_hero: boolean;
  active: boolean;
  tenant_id: string | null;
  plant_id: string | null;
}

export interface MetricLive {
  sensor_id: string;
  value: number;
  status: MetricStatus;
  updated_at: string;
}

export interface MetricReading extends MetricLive {
  label: string;
  area: MetricArea;
  unit: string;
  category?: string | null;
  setpoints?: Setpoints;
}

export interface ActiveAlert {
  id: string;
  severity: AlertSeverity;
  area: MetricArea;
  source: string;
  title: string;
  message: string | null;
  suggested_action: string | null;
  metadata: Record<string, unknown> | null;
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface Shift {
  name: ShiftName;
  displayName: string;
  start: string;
  end: string;
  elapsedMinutes: number;
  remainingMinutes: number;
  progress: number;
}

export interface MoliendaKPI {
  promedio_t_h: number;
  acumulado_t?: number;
  horas_transcurridas?: number;
  _cached?: boolean;
}

export interface GasPrevioKPI {
  promedio_m3_h: number;
  total_m3: number;
  horas_turno: number;
  samples: number;
  shift: ShiftName;
  shift_date: string;
  _cached?: boolean;
}

export interface ParadasKPI {
  total: number;
  motivos: { motivo: string; cantidad: number; minutos: number }[];
  tiempo_neto_horas: number;
  shift: ShiftName;
  shift_date: string;
  _cached?: boolean;
}

export interface MillSpeedKPI {
  promedio_rpm: number;
  samples: { timestamp: string; rpm: number }[];
  _cached?: boolean;
}

export interface MetricsWebhookPayload {
  tenant_slug?: string;
  plant_slug?: string;
  source?: 'n8n' | 'node-red' | 'manual';
  timestamp?: string;
  metrics: Array<{
    sensor_id: string;
    value: number | string;
    unit?: string;
    timestamp?: string;
  }>;
}

export interface MillSpeedWebhookPayload {
  tenant_slug?: string;
  plant_slug?: string;
  shift: ShiftName;
  shift_date: string;
  promedio_rpm: number;
  samples: { timestamp: string; rpm: number }[];
}
