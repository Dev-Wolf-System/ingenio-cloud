export interface Setpoints {
  min?: number | null;
  max?: number | null;
  warnMin?: number | null;
  warnMax?: number | null;
}

export interface VariableDefinition {
  sensor_id: string;
  label: string;
  area: 'energia' | 'produccion' | 'guardia';
  unit: string;
  setpoints: Setpoints;
  precision: number;
  type: 'numeric' | 'level' | 'boolean' | 'computed' | 'derived';
  computed_from?: string[];
}

export const SENSOR_CATALOG: Record<string, VariableDefinition> = {
  // ENERGÍA
  caudal_total_vapor:        { sensor_id: 'caudal_total_vapor',        label: 'Caudal total vapor',        area: 'energia',    unit: 't/h',    setpoints: { min: 150, warnMax: 220 }, precision: 1, type: 'computed', computed_from: ['caudal_caldera_2','caudal_caldera_3','caudal_caldera_6'] },
  caudal_caldera_2:          { sensor_id: 'caudal_caldera_2',          label: 'Caudal caldera 2',          area: 'energia',    unit: 't/h',    setpoints: { min: 40, max: 80, warnMax: 75 }, precision: 1, type: 'numeric' },
  caudal_caldera_3:          { sensor_id: 'caudal_caldera_3',          label: 'Caudal caldera 3',          area: 'energia',    unit: 't/h',    setpoints: { min: 40, max: 80, warnMax: 75 }, precision: 1, type: 'numeric' },
  caudal_caldera_6:          { sensor_id: 'caudal_caldera_6',          label: 'Caudal caldera 6',          area: 'energia',    unit: 't/h',    setpoints: { min: 40, max: 80, warnMax: 75 }, precision: 1, type: 'numeric' },
  presion_alta_baja:         { sensor_id: 'presion_alta_baja',         label: 'Presión alta/baja',         area: 'energia',    unit: 'bar',    setpoints: { min: 15, max: 22, warnMin: 16, warnMax: 20 }, precision: 1, type: 'numeric' },
  presion_escape:            { sensor_id: 'presion_escape',            label: 'Presión escape',            area: 'energia',    unit: 'bar',    setpoints: { min: 1.5, max: 3.0 }, precision: 2, type: 'numeric' },
  presion_vg1:               { sensor_id: 'presion_vg1',               label: 'Presión VG1',               area: 'energia',    unit: 'bar',    setpoints: { min: 7, max: 10 }, precision: 1, type: 'numeric' },
  temp_agua_alimentacion:    { sensor_id: 'temp_agua_alimentacion',    label: 'Temp agua alimentación',    area: 'energia',    unit: '°C',     setpoints: { min: 95, max: 115, warnMax: 110 }, precision: 1, type: 'numeric' },
  presion_agua_alimentacion: { sensor_id: 'presion_agua_alimentacion', label: 'Presión agua alimentación', area: 'energia',    unit: 'bar',    setpoints: { min: 12, max: 16 }, precision: 1, type: 'numeric' },
  potencia_weg:              { sensor_id: 'potencia_weg',              label: 'Potencia WEG',              area: 'energia',    unit: 'MW',     setpoints: { min: 3, max: 8 }, precision: 2, type: 'numeric' },
  potencia_siemens:          { sensor_id: 'potencia_siemens',          label: 'Potencia Siemens',          area: 'energia',    unit: 'MW',     setpoints: { min: 3, max: 8 }, precision: 2, type: 'numeric' },
  generacion_total:          { sensor_id: 'generacion_total',          label: 'Generación eléctrica',      area: 'energia',    unit: 'MW',     setpoints: { min: 8, max: 15 }, precision: 2, type: 'computed', computed_from: ['potencia_weg','potencia_siemens'] },
  gas_actual:                { sensor_id: 'gas_actual',                label: 'Gas consumo actual',        area: 'energia',    unit: 'm³/h',   setpoints: { min: 50, max: 500, warnMax: 450 }, precision: 0, type: 'numeric' },
  gas_acumulado_dia:         { sensor_id: 'gas_acumulado_dia',         label: 'Gas acumulado día',         area: 'energia',    unit: 'm³',     setpoints: { min: 0 }, precision: 0, type: 'numeric' },

  // PRODUCCIÓN
  nivel_jugo_pesado:         { sensor_id: 'nivel_jugo_pesado',         label: 'Nivel jugo pesado',         area: 'produccion', unit: '%',      setpoints: { min: 30, max: 90, warnMax: 85 }, precision: 0, type: 'level' },
  ph_jugo:                   { sensor_id: 'ph_jugo',                   label: 'pH jugo',                   area: 'produccion', unit: 'pH',     setpoints: { min: 6.0, max: 7.0, warnMin: 6.2, warnMax: 6.8 }, precision: 2, type: 'numeric' },
  sulfitado:                 { sensor_id: 'sulfitado',                 label: 'Sulfitado',                 area: 'produccion', unit: 'ppm',    setpoints: { min: 80, max: 120 }, precision: 0, type: 'numeric' },
  temp_ultimo_calentador:    { sensor_id: 'temp_ultimo_calentador',    label: 'Última temp calentador',    area: 'produccion', unit: '°C',     setpoints: { min: 100, max: 108, warnMax: 110 }, precision: 1, type: 'numeric' },
  pol_cachaza:               { sensor_id: 'pol_cachaza',               label: 'Pol cachaza',               area: 'produccion', unit: '%',      setpoints: { max: 1.5, warnMax: 2.0 }, precision: 2, type: 'numeric' },
  nivel_jugo_clarificado:    { sensor_id: 'nivel_jugo_clarificado',    label: 'Nivel jugo clarificado',    area: 'produccion', unit: '%',      setpoints: { min: 40, max: 90 }, precision: 0, type: 'level' },
  caudal_jugo_clarificado:   { sensor_id: 'caudal_jugo_clarificado',   label: 'Caudal jugo clarificado',   area: 'produccion', unit: 't/h',    setpoints: { min: 200, max: 400 }, precision: 1, type: 'numeric' },
  caudal_jugo_destileria:    { sensor_id: 'caudal_jugo_destileria',    label: 'Caudal jugo a destilería',  area: 'produccion', unit: 't/h',    setpoints: { min: 20, max: 60 }, precision: 1, type: 'numeric' },
  nivel_melado_tratado:      { sensor_id: 'nivel_melado_tratado',      label: 'Nivel melado tratado',      area: 'produccion', unit: '%',      setpoints: { min: 30, max: 85 }, precision: 0, type: 'level' },
  nivel_melado_1_2:          { sensor_id: 'nivel_melado_1_2',          label: 'Nivel melado 1/2',          area: 'produccion', unit: '%',      setpoints: { min: 30, max: 85 }, precision: 0, type: 'level' },
  nivel_cristalizador_1ra:   { sensor_id: 'nivel_cristalizador_1ra',   label: 'Nivel cristalizador 1°',    area: 'produccion', unit: '%',      setpoints: { min: 40, max: 90 }, precision: 0, type: 'level' },
  produccion_azucar_diaria:  { sensor_id: 'produccion_azucar_diaria',  label: 'Producción azúcar día',     area: 'produccion', unit: 'bolsas', setpoints: { min: 0 }, precision: 0, type: 'numeric' },
  color_azucar_icumsa:       { sensor_id: 'color_azucar_icumsa',       label: 'Color azúcar (ICUMSA)',     area: 'produccion', unit: 'ICUMSA', setpoints: { max: 150, warnMax: 120 }, precision: 0, type: 'numeric' },
  humedad_azucar:            { sensor_id: 'humedad_azucar',            label: 'Humedad azúcar',            area: 'produccion', unit: '%',      setpoints: { min: 0, max: 0.1 }, precision: 2, type: 'numeric' },
  caudal_alcohol:            { sensor_id: 'caudal_alcohol',            label: 'Caudal alcohol',            area: 'produccion', unit: 'L/h',    setpoints: { min: 1500, max: 4000 }, precision: 0, type: 'numeric' },
  caudal_vino_destilado:     { sensor_id: 'caudal_vino_destilado',     label: 'Caudal vino destilado',     area: 'produccion', unit: 'L/h',    setpoints: { min: 0 }, precision: 0, type: 'numeric' },
  caudal_buen_gusto:         { sensor_id: 'caudal_buen_gusto',         label: 'Caudal buen gusto',         area: 'produccion', unit: 'L/h',    setpoints: { min: 0 }, precision: 0, type: 'numeric' },
  vapor_destileria_k2:       { sensor_id: 'vapor_destileria_k2',       label: 'Vapor destilería (K2)',     area: 'produccion', unit: 'bar',    setpoints: { min: 0, max: 10 }, precision: 2, type: 'numeric' },
  nivel_agua_foza:           { sensor_id: 'nivel_agua_foza',           label: 'Nivel agua foza',           area: 'produccion', unit: '%',      setpoints: { min: 20, max: 90, warnMin: 25 }, precision: 0, type: 'level' },
  aire_destileria:           { sensor_id: 'aire_destileria',           label: 'Aire',                      area: 'produccion', unit: 'bar',    setpoints: { min: 4, max: 8 }, precision: 1, type: 'numeric' },
  promedio_molienda_actual:  { sensor_id: 'promedio_molienda_actual',  label: 'Promedio molienda actual',  area: 'produccion', unit: 't/h',    setpoints: { min: 350, max: 600, warnMax: 580 }, precision: 0, type: 'derived' },
};

export function resolveStatus(value: number, sp: Setpoints): 'ok' | 'warn' | 'alarm' {
  if (sp.min != null && value < sp.min) return 'alarm';
  if (sp.max != null && value > sp.max) return 'alarm';
  if (sp.warnMin != null && value < sp.warnMin) return 'warn';
  if (sp.warnMax != null && value > sp.warnMax) return 'warn';
  return 'ok';
}
