/**
 * Catálogo runtime de sensores (mirror del backend para labels + units + precision)
 * Se sincroniza vía /api/metrics/catalog en producción, esto es fallback.
 */

export interface SensorDef {
  sensor_id: string;
  label: string;
  area: 'energia' | 'produccion';
  unit: string;
  precision: number;
  type: 'numeric' | 'level' | 'computed' | 'derived';
}

export const SENSOR_DEFS: Record<string, SensorDef> = {
  // ENERGÍA
  caudal_total_vapor:        { sensor_id: 'caudal_total_vapor',        label: 'Caudal total vapor',     area: 'energia',    unit: 't/h',   precision: 1, type: 'computed' },
  caudal_caldera_2:          { sensor_id: 'caudal_caldera_2',          label: 'Caldera 2',              area: 'energia',    unit: 't/h',   precision: 1, type: 'numeric' },
  caudal_caldera_3:          { sensor_id: 'caudal_caldera_3',          label: 'Caldera 3',              area: 'energia',    unit: 't/h',   precision: 1, type: 'numeric' },
  caudal_caldera_6:          { sensor_id: 'caudal_caldera_6',          label: 'Caldera 6',              area: 'energia',    unit: 't/h',   precision: 1, type: 'numeric' },
  presion_alta_baja:         { sensor_id: 'presion_alta_baja',         label: 'Presión alta/baja',      area: 'energia',    unit: 'bar',   precision: 1, type: 'numeric' },
  presion_escape:            { sensor_id: 'presion_escape',            label: 'Presión escape',         area: 'energia',    unit: 'bar',   precision: 2, type: 'numeric' },
  presion_vg1:               { sensor_id: 'presion_vg1',               label: 'Presión VG1',            area: 'energia',    unit: 'bar',   precision: 1, type: 'numeric' },
  temp_agua_alimentacion:    { sensor_id: 'temp_agua_alimentacion',    label: 'Temp agua aliment.',     area: 'energia',    unit: '°C',    precision: 1, type: 'numeric' },
  presion_agua_alimentacion: { sensor_id: 'presion_agua_alimentacion', label: 'Presión agua aliment.',  area: 'energia',    unit: 'bar',   precision: 1, type: 'numeric' },
  potencia_weg:              { sensor_id: 'potencia_weg',              label: 'Potencia WEG',           area: 'energia',    unit: 'MW',    precision: 2, type: 'numeric' },
  potencia_siemens:          { sensor_id: 'potencia_siemens',          label: 'Potencia Siemens',       area: 'energia',    unit: 'MW',    precision: 2, type: 'numeric' },
  generacion_total:          { sensor_id: 'generacion_total',          label: 'Generación eléctrica',   area: 'energia',    unit: 'MW',    precision: 2, type: 'computed' },
  gas_actual:                { sensor_id: 'gas_actual',                label: 'Gas actual',             area: 'energia',    unit: 'm³/h',  precision: 0, type: 'numeric' },
  gas_acumulado_dia:         { sensor_id: 'gas_acumulado_dia',         label: 'Gas acumulado día',      area: 'energia',    unit: 'm³',    precision: 0, type: 'numeric' },

  // PRODUCCIÓN
  nivel_jugo_pesado:         { sensor_id: 'nivel_jugo_pesado',         label: 'Nivel jugo pesado',      area: 'produccion', unit: '%',     precision: 0, type: 'level' },
  ph_jugo:                   { sensor_id: 'ph_jugo',                   label: 'pH jugo',                area: 'produccion', unit: 'pH',    precision: 2, type: 'numeric' },
  sulfitado:                 { sensor_id: 'sulfitado',                 label: 'Sulfitado',              area: 'produccion', unit: 'ppm',   precision: 0, type: 'numeric' },
  temp_ultimo_calentador:    { sensor_id: 'temp_ultimo_calentador',    label: 'Temp últ. calentador',   area: 'produccion', unit: '°C',    precision: 1, type: 'numeric' },
  pol_cachaza:               { sensor_id: 'pol_cachaza',               label: 'Pol cachaza',            area: 'produccion', unit: '%',     precision: 2, type: 'numeric' },
  nivel_jugo_clarificado:    { sensor_id: 'nivel_jugo_clarificado',    label: 'Jugo clarificado',       area: 'produccion', unit: '%',     precision: 0, type: 'level' },
  caudal_jugo_clarificado:   { sensor_id: 'caudal_jugo_clarificado',   label: 'Caudal jugo clarif.',    area: 'produccion', unit: 't/h',   precision: 1, type: 'numeric' },
  caudal_jugo_destileria:    { sensor_id: 'caudal_jugo_destileria',    label: 'Caudal jugo destil.',    area: 'produccion', unit: 't/h',   precision: 1, type: 'numeric' },
  nivel_melado_tratado:      { sensor_id: 'nivel_melado_tratado',      label: 'Nivel melado tratado',   area: 'produccion', unit: '%',     precision: 0, type: 'level' },
  nivel_melado_1_2:          { sensor_id: 'nivel_melado_1_2',          label: 'Nivel melado 1/2',       area: 'produccion', unit: '%',     precision: 0, type: 'level' },
  nivel_cristalizador_1ra:   { sensor_id: 'nivel_cristalizador_1ra',   label: 'Cristalizador 1°',       area: 'produccion', unit: '%',     precision: 0, type: 'level' },
  produccion_azucar_diaria:  { sensor_id: 'produccion_azucar_diaria',  label: 'Producción azúcar',      area: 'produccion', unit: 'bolsas',precision: 0, type: 'numeric' },
  color_azucar_icumsa:       { sensor_id: 'color_azucar_icumsa',       label: 'Color azúcar',           area: 'produccion', unit: 'ICUMSA',precision: 0, type: 'numeric' },
  humedad_azucar:            { sensor_id: 'humedad_azucar',            label: 'Humedad azúcar',         area: 'produccion', unit: '%',     precision: 2, type: 'numeric' },
  caudal_alcohol:            { sensor_id: 'caudal_alcohol',            label: 'Caudal alcohol',         area: 'produccion', unit: 'L/h',   precision: 0, type: 'numeric' },
  caudal_vino_destilado:     { sensor_id: 'caudal_vino_destilado',     label: 'Caudal vino destil.',    area: 'produccion', unit: 'L/h',   precision: 0, type: 'numeric' },
  caudal_buen_gusto:         { sensor_id: 'caudal_buen_gusto',         label: 'Caudal buen gusto',      area: 'produccion', unit: 'L/h',   precision: 0, type: 'numeric' },
  vapor_destileria_k2:       { sensor_id: 'vapor_destileria_k2',       label: 'Vapor destil. (K2)',     area: 'produccion', unit: 'bar',   precision: 2, type: 'numeric' },
  nivel_agua_foza:           { sensor_id: 'nivel_agua_foza',           label: 'Nivel agua foza',        area: 'produccion', unit: '%',     precision: 0, type: 'level' },
  aire_destileria:           { sensor_id: 'aire_destileria',           label: 'Aire',                   area: 'produccion', unit: 'bar',   precision: 1, type: 'numeric' },
  promedio_molienda_actual:  { sensor_id: 'promedio_molienda_actual',  label: 'Prom. molienda actual',  area: 'produccion', unit: 't/h',   precision: 0, type: 'derived' },
};
