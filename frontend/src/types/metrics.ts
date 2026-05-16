export type MetricArea = 'energia' | 'produccion' | 'guardia';
export type MetricStatus = 'ok' | 'warn' | 'alarm' | 'unknown';

export interface Setpoints {
  min?: number | null;
  max?: number | null;
  warnMin?: number | null;
  warnMax?: number | null;
}

export interface SensorMappingRow {
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
  show_in_dashboard: boolean;
  show_in_kpi_hero: boolean;
}

export interface MetricReading {
  sensor_id: string;
  value: number;
  status: MetricStatus;
  updated_at: string;
}

export interface ActiveAlert {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  area: MetricArea;
  source: string;
  title: string;
  message: string | null;
  suggested_action: string | null;
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}
