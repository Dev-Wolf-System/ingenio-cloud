export type Periodo = 'turno' | 'dia' | 'zafra';

export interface ParadaRow {
  inicio: string; fin: string | null; minutos: number | null;
  motivo: string; maquina: string | null; origen: string | null;
  alertas_relacionadas: Array<{ id: string; titulo: string; severidad: string; detected_at: string; offset_min: number }>;
}

export interface Kpis {
  total: number;
  por_severidad: { info: number; warn: number; critical: number };
  por_area: Record<string, number>;
  duracion_media_min: number;
  duracion_max_min: number;
}

/** Métricas de confiabilidad. Failures = paradas reales; downtime = duración de paradas. */
export interface Reliabilidad {
  paradas_n: number;
  span_min: number;
  downtime_total_min: number;
  operating_min: number;
  mtbf_min: number | null;
  mttr_min: number | null;
  mttf_min: number | null;
  mtta_min: number | null;
}

export interface Comparativa {
  total_prev: number | null;
  delta_pct: number | null;
  por_severidad_prev: { info: number; warn: number; critical: number } | null;
}

export interface SensorStat { area: string; key: string; titulo: string; n: number; mtbf_min: number | null; duracion_media_min: number; }
export interface Correlacion { a: string; b: string; juntas: number; ventana_min: number; }
export interface Insight { resumen: string; patrones: string[]; recomendaciones: string[]; cached: boolean; generado_at: string; }

export interface AnalisisResponse {
  periodo: Periodo;
  rango: { desde: string; hasta: string; etiqueta: string };
  kpis: Kpis;
  reliabilidad: Reliabilidad;
  comparativa: Comparativa | null;
  series: {
    por_turno: Array<{ turno: 'Mañana' | 'Tarde' | 'Noche'; n: number }>;
    por_dia: Array<{ dia: string; n: number; duracion_media_min: number }>;
    heatmap: Array<{ dow: number; hora: number; n: number }>;
  };
  sensores: SensorStat[];
  correlaciones: Correlacion[];
  paradas: ParadaRow[];
  insight: Insight | null;
}
