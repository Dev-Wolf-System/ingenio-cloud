import { Injectable, Logger } from '@nestjs/common';
import { InfluxQueryService } from './influx-query.service';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Reemplaza la ingesta por WebSocket (Node-RED → /ws/dashboard/*) para las señales
 * que SÍ existen en InfluxDB, leyéndolas directo cada 1s. El WebSocket llevaba
 * ~9.7 días caído (dashboard_data congelado) mientras Influx seguía recibiendo
 * datos en vivo por un flow separado — de ahí el cambio de fuente.
 *
 * Señales SIN equivalente en Influx (confirmado: 0 datos) quedan fuera de
 * este mapeo y siguen dependiendo del WebSocket si algún día vuelve:
 *   trapiche:   Bagazo_Humedad, Bagazo_Pol%, Molienda_Kilos, Molino1_Velocidad
 *   produccion: Color_Cinta_{Corta,Larga}, Humedad_Cinta_{Corta,Larga},
 *               Nivel_Cristalizador, Nivel_Melado_{1,2,Tratado}, Produccion_Bolsas_Dia
 *
 * Trapiche_Estado ← trap_conductor (motor conductor principal). Tabla nueva
 * (datos desde 2026-08-05), verificado consistente con parada real abierta
 * al momento del mapeo (0 = parado). Pendiente confirmar que marca >0 cuando
 * el trapiche vuelva a moler.
 */

interface TagMap {
  variable: string; // nombre exacto del tag en InfluxDB
  key: string;       // key destino en industrial.dashboard_data (igual a la que usaba el WS)
  unit: string;
}

const ENERGIA_MAP: TagMap[] = [
  { variable: 'caldera2.caldera2.cald2_gas_caudal', key: 'Caudal_Gas_Cald2', unit: 'm³/h' },
  { variable: 'caldera3.caldera3.cald3_gas_caudal', key: 'Caudal_Gas_Cald3', unit: 'm³/h' },
  { variable: 'caldera6.caldera6.cald6_gas_caudal', key: 'Caudal_Gas_Cald6', unit: 'm³/h' },
  { variable: 'caldera2.caldera2.cald2_vapor_caudal', key: 'Caudal_Vapor_Cald2', unit: 'Tn/H' },
  { variable: 'caldera3.caldera3.cald3_vapor_caudal', key: 'Caudal_Vapor_Cald3', unit: 'Tn/H' },
  { variable: 'caldera6.caldera6.cald6_vapor_caudal', key: 'Caudal_Vapor_Cald6', unit: 'Tn/H' },
  { variable: 'siemens.siemens.siemens_potencia_activa', key: 'Potencia_Activa_Siemens', unit: 'Kw' },
  { variable: 'skoda.skoda.Potencia_Activa_Total_AEG', key: 'Potencia_Activa_Weg', unit: 'Kv' },
  { variable: 'caldera.Caldera.cald_agua_aliment1_presion', key: 'Presion_Agua_Alimentacion', unit: 'Kg' },
  { variable: 'caldera.Caldera.cald_vapor_alta_presion', key: 'Presion_Vapor_Alta', unit: 'Kg/cm2' },
  { variable: 'caldera.Caldera.cald_vapor_baja_presion', key: 'Presion_Vapor_Baja', unit: 'Kg/cm2' },
  { variable: 'vapor.vapor.vapor_escape_aux_presion', key: 'Presion_Vapor_Escape', unit: 'Kg/cm2' },
  { variable: 'vapor.vapor.vapor_escape_aux_vg1_presion', key: 'Presion_Vapor_Vg1', unit: 'Kg/cm2' },
  { variable: 'caldera.Caldera.cald_agua_aliment_temp', key: 'Temperatura_Agua_Alimentacion', unit: '°C' },
];

const TRAPICHE_MAP: TagMap[] = [
  { variable: 'trapiche_cabina.trapiche_cabina.trap_molino6_presion_este', key: '6to_Molino_Presion_Este', unit: 'Kg/cm2' },
  { variable: 'trapiche_cabina.trapiche_cabina.trap_molino6_presion_oeste', key: '6to_Molino_Presion_Oeste', unit: 'Kg/cm2' },
  { variable: 'vapor.vapor.vapor_agua_imbibicion_caudal', key: 'Agua_Imbibicion_Caudal', unit: 'm3' },
  { variable: 'vapor.vapor.vapor_agua_imbibicion_temp', key: 'Agua_Imbibicion_Temp', unit: '°C' },
  { variable: 'trapiche_cabina.trapiche_cabina.trap_conductor', key: 'Trapiche_Estado', unit: 'raw' },
];

const PRODUCCION_MAP: TagMap[] = [
  { variable: 'Destileria.Destileria.dest_alcohol_caudal', key: 'Caudal_Alcohol', unit: 'm³/h' },
  { variable: 'Destileria.Destileria.dest_vino_caudal', key: 'Caudal_Vino', unit: 'm³/h' },
  { variable: 'Fermentacion.fermentacion.Ferm_melaza_dilutor_caudal', key: 'Caudal_Diluctor_Melaza', unit: 'm³/h' },
  { variable: 'buengusto.buengusto.BG_vino_frio_caudal', key: 'Caudal_Vino_BuenGusto', unit: 'm³/h' },
  { variable: 'fabrica_bb.fabrica_bb.Fab_agua_industrial_nivel', key: 'Nivel_Agua_Industrial', unit: '%' },
  { variable: 'fabrica.fabrica.Fab_jugo_clarificado_nivel', key: 'Nivel_Jugo_Clarificado', unit: '%' },
  { variable: 'Clarificacion3.Clarificacion3.clar3_jugo_pesado_nivel', key: 'Nivel_Jugo_Pesado', unit: '%' },
  { variable: 'Clarificacion3.Clarificacion3.clar3_encalado_ph2', key: 'PH_Encalado', unit: 'pH' },
  { variable: 'Clarificacion3.Clarificacion3.clar3_sulfitado_presion', key: 'Presion_Sulfitado', unit: 'Bar' },
  { variable: 'caldera.Caldera.cald_aire_presion', key: 'Presion_Aire', unit: 'Bar' },
  { variable: 'Clarificacion3.Clarificacion3.clar3_calentador13_temp', key: 'Temperatura_Calentador', unit: '°C' },
];

const AREAS: Array<{ area: 'energia' | 'trapiche' | 'produccion'; map: TagMap[] }> = [
  { area: 'energia', map: ENERGIA_MAP },
  { area: 'trapiche', map: TRAPICHE_MAP },
  { area: 'produccion', map: PRODUCCION_MAP },
];

interface DashboardRow {
  area: string;
  key: string;
  value: number;
  display: string | null;
  unit: string | null;
  raw: number | null;
  updated_at: string;
}

@Injectable()
export class InfluxDashboardSyncService {
  private readonly logger = new Logger(InfluxDashboardSyncService.name);

  constructor(
    private readonly influx: InfluxQueryService,
    private readonly supabase: SupabaseService,
  ) {}

  /** Último valor por variable en el último minuto (ventana tolerante a jitter del PLC). */
  private async fetchLastValues(table: string, variables: string[]): Promise<Map<string, number>> {
    const list = variables.map((v) => `'${v.replace(/'/g, "''")}'`).join(',');
    const sql = `
      WITH ranked AS (
        SELECT variable, value, time,
          ROW_NUMBER() OVER (PARTITION BY variable ORDER BY time DESC) AS rn
        FROM "${table}"
        WHERE time >= now() - INTERVAL '1 minute'
          AND variable IN (${list})
      )
      SELECT variable, value FROM ranked WHERE rn = 1
    `;
    const rows = await this.influx.query<{ variable: string; value: number }>(sql, { timeoutMs: 3000 });
    const map = new Map<string, number>();
    for (const r of rows) {
      const v = Number(r.value);
      if (Number.isFinite(v)) map.set(r.variable, v);
    }
    return map;
  }

  /** Corre las 3 áreas en paralelo y upserta todo en un solo batch. */
  async syncAll(): Promise<{ synced: number }> {
    const now = new Date().toISOString();

    const results = await Promise.all(
      AREAS.map(async ({ area, map }) => {
        const table = `dashboard-general-${area}`;
        const values = await this.fetchLastValues(table, map.map((m) => m.variable));
        const rows: DashboardRow[] = [];
        for (const { variable, key, unit } of map) {
          const value = values.get(variable);
          if (value === undefined) continue; // sensor sin dato reciente → no pisar el valor previo
          rows.push({ area, key, value, display: `${value} ${unit}`, unit, raw: value, updated_at: now });
        }

        if (area === 'energia') {
          const get = (key: string) => rows.find((r) => r.key === key)?.value ?? 0;
          rows.push(
            {
              area, key: 'Gas_Total',
              value: +(get('Caudal_Gas_Cald2') + get('Caudal_Gas_Cald3') + get('Caudal_Gas_Cald6')).toFixed(1),
              display: null, unit: 'm³/h', raw: null, updated_at: now,
            },
            {
              area, key: 'Vapor_Total_Calderas',
              value: +(get('Caudal_Vapor_Cald2') + get('Caudal_Vapor_Cald3') + get('Caudal_Vapor_Cald6')).toFixed(1),
              display: null, unit: 'Tn/H', raw: null, updated_at: now,
            },
            {
              area, key: 'Potencia_Total',
              value: +((get('Potencia_Activa_Weg') + get('Potencia_Activa_Siemens')) / 1000).toFixed(2),
              display: null, unit: 'MW', raw: null, updated_at: now,
            },
          );
        }
        return rows;
      }),
    );

    const allRows = results.flat();
    if (allRows.length === 0) return { synced: 0 };

    const { error } = await this.supabase
      .schema('industrial')
      .from('dashboard_data')
      .upsert(allRows, { onConflict: 'area,key,tenant_id,plant_id' });

    if (error) {
      this.logger.warn(`syncAll upsert failed: ${error.message}`);
      return { synced: 0 };
    }
    return { synced: allRows.length };
  }
}
