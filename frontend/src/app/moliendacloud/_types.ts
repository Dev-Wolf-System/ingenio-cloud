export type CanchonResumen = Record<string, number | string | null>;
export interface BalanzaHoraRow { [k: string]: number | string | null }
export interface MovimientoRow { tipo_pesada: string | null; peso_neto: number | null; neto_cana: number | null; salida_at: string }
export interface MoliendaBloque { bloque: string; hora: string; etiqueta: string; molienda_kg: number; fuente: string; acumulado_kg: number }
export interface LabRow { proceso_codigo: string; fecha_industrial: string; hora_lectura: string | null; kilos: number | null; brix_manual: number | null; brix_automatico: number | null; pol_manual: number | null; pol_automatico: number | null; pureza: number | null }
