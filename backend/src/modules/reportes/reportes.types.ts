export type TurnoNombre = 'MAÑANA' | 'TARDE' | 'NOCHE';

export interface TurnoVentana {
  turno: TurnoNombre;
  fecha_industrial: string; // YYYY-MM-DD
  inicio: string;           // ISO con offset -03:00
  fin: string;              // ISO con offset -03:00
}

export interface ProduccionTurno {
  molienda_t: number | null;
  gas_m3: number | null;
  bolsas: number | null;
  alcohol_gl_prom: number | null;
}

export interface EficienciasTurno {
  gas_por_t: number | null;
  ritmo_t_h: number | null;
  ritmo_objetivo_t_h: number;
}

export interface CalidadTurno {
  color_icumsa: number | null;
  humedad_azucar: number | null;
  bagazo_humedad: number | null;
  bagazo_pol: number | null;
  cachaza_pol: number | null;
}

export interface ParadaItem {
  motivo: string;
  maquina: string | null;
  origen: string | null;
  desde: string;
  hasta: string | null;
  minutos: number | null;
}

export interface ParadasTurno {
  count: number;
  minutos_total: number;
  detalle: ParadaItem[];
}

export interface Comparacion {
  molienda_delta_pct: number | null;
  gas_delta_pct: number | null;
  bolsas_delta_pct: number | null;
}

export interface ReporteCompleto {
  ventana: TurnoVentana;
  produccion: ProduccionTurno;
  produccion_anterior: ProduccionTurno;
  comparacion: Comparacion;
  eficiencias: EficienciasTurno;
  calidad: CalidadTurno;
  paradas: ParadasTurno;
  alertas: string[];
}

export interface CompletitudCheck {
  completo: boolean;
  horas_totales: number;
  molienda_faltante: number;     // horas sin dato real
  gas_faltante: number;          // horas sin dato real
  detalle: string;               // human-readable
}

export interface ReportePayload {
  tipo: 'reporte_turno';
  turno: TurnoNombre;
  fecha_industrial: string;
  turno_inicio: string;
  turno_fin: string;
  datos_completos: true;
  parse_mode: 'Markdown';
  mensaje_telegram: string;
  datos: {
    produccion: ProduccionTurno;
    comparacion: Comparacion;
    eficiencias: EficienciasTurno;
    calidad: CalidadTurno;
    paradas: ParadasTurno;
    alertas: string[];
  };
}
