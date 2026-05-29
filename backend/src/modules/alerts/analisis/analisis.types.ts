export interface AlertaRow {
  id: string; severity: string; area: string; source: string;
  title: string; detected_at: string; resolved_at: string | null;
  acknowledged_at: string | null;
}

export interface ParadaRow {
  inicio: string; fin: string | null; minutos: number | null;
  motivo: string; maquina: string | null; origen: string | null;
  alertas_relacionadas: Array<{ id: string; titulo: string; severidad: string; detected_at: string; offset_min: number }>;
}

export interface Kpis {
  total: number;
  por_severidad: { info: number; warn: number; critical: number };
  por_area: Record<string, number>;
  duracion_media_min: number;   // duración media de alertas (detección→normalización)
  duracion_max_min: number;
}

/** Métricas de confiabilidad. Failures = paradas reales; downtime = duración de paradas. */
export interface Reliabilidad {
  paradas_n: number;
  span_min: number;             // ventana del período
  downtime_total_min: number;   // Σ minutos de paradas
  operating_min: number;        // span − downtime
  mtbf_min: number | null;      // span / n  (tiempo medio entre fallas)
  mttr_min: number | null;      // downtime / n  (tiempo medio de reparación)
  mttf_min: number | null;      // operating / n  (uptime medio hasta falla)
  mtta_min: number | null;      // prom(acknowledged_at − detected_at) sobre alertas reconocidas
}

export interface Comparativa {
  total_prev: number | null;
  delta_pct: number | null;
  por_severidad_prev: { info: number; warn: number; critical: number } | null;
}

export interface SensorStat {
  area: string; key: string; titulo: string;
  n: number; mtbf_min: number | null; duracion_media_min: number;
}

export interface Correlacion { a: string; b: string; juntas: number; ventana_min: number; }

export interface Insight { resumen: string; patrones: string[]; recomendaciones: string[]; cached: boolean; generado_at: string; }

export interface AnalisisResponse {
  periodo: 'turno' | 'dia' | 'zafra';
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
