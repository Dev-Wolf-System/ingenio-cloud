import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { InfluxQueryService } from './influx-query.service';

interface InfluxQueryRow {
  ts_hora_utc: string;
  gas_total_m3h: number | null;
}

// ART = UTC-3. Las ts_cierre en Supabase son timestamp sin TZ almacenadas en hora local ART.
const ART_OFFSET_MS = -3 * 60 * 60 * 1000;

function utcToArt(utcDate: Date): Date {
  return new Date(utcDate.getTime() + ART_OFFSET_MS);
}

function toSupabaseTs(d: Date): string {
  return d.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
}

@Injectable()
export class InfluxGasService {
  private readonly logger = new Logger(InfluxGasService.name);

  constructor(
    private readonly influx: InfluxQueryService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Consulta InfluxDB3: promedio por hora del día industrial corriente (08:00 ART en adelante).
   * Retorna múltiples filas — una por hora — para rellenar todas las horas sin dato de lab.
   */
  async fetchGasPorHora(): Promise<Array<{ ts_cierre: Date; m3_estimado: number }>> {
    // Schema long-format: variable es tag, valor en columna `value`.
    // Suma de las 3 calderas (2+3+6) promedio horario.
    // `ts_hora_utc` = cierre del bucket (date_bin abre el bucket + 1h).
    const sql = `
      WITH por_caldera AS (
        SELECT
          date_bin(INTERVAL '1 hour', time, TIMESTAMP '1970-01-01T00:00:00Z') + INTERVAL '1 hour' AS ts_hora_utc,
          variable,
          AVG(value) AS m3h
        FROM "dashboard-general-energia"
        WHERE time >= now() - INTERVAL '20 hours'
          AND variable IN (
            'caldera2.caldera2.cald2_gas_caudal',
            'caldera3.caldera3.cald3_gas_caudal',
            'caldera6.caldera6.cald6_gas_caudal'
          )
        GROUP BY 1, variable
      )
      SELECT
        ts_hora_utc,
        SUM(m3h) AS gas_total_m3h
      FROM por_caldera
      GROUP BY ts_hora_utc
      ORDER BY ts_hora_utc
    `;

    const rows = await this.influx.query<InfluxQueryRow>(sql);
    if (!rows.length) {
      this.logger.debug('InfluxDB: sin datos en las últimas 20h');
      return [];
    }

    return rows
      .filter((r) => r.gas_total_m3h != null && Number.isFinite(Number(r.gas_total_m3h)) && Number(r.gas_total_m3h) >= 0)
      .map((r) => ({
        ts_cierre: utcToArt(new Date(r.ts_hora_utc)),
        m3_estimado: Number(r.gas_total_m3h),
      }));
  }

  /**
   * Consumo parcial de la hora EN CURSO (desde el inicio del bucket horario hasta now).
   * Devuelve el m³ acumulado proporcional al tiempo transcurrido en la hora.
   *
   * Retorna `null` si no hay muestras o consumo es 0.
   */
  async fetchGasHoraEnCurso(): Promise<{
    ts_inicio_art: Date;
    ts_now_art: Date;
    fraccion_hora: number;
    m3h_promedio: number;
    m3_parcial: number;
  } | null> {
    const sql = `
      WITH por_caldera AS (
        SELECT variable, AVG(value) AS m3h
        FROM "dashboard-general-energia"
        WHERE time >= date_bin(INTERVAL '1 hour', now(), TIMESTAMP '1970-01-01T00:00:00Z')
          AND time <= now()
          AND variable IN (
            'caldera2.caldera2.cald2_gas_caudal',
            'caldera3.caldera3.cald3_gas_caudal',
            'caldera6.caldera6.cald6_gas_caudal'
          )
        GROUP BY variable
      )
      SELECT
        date_bin(INTERVAL '1 hour', now(), TIMESTAMP '1970-01-01T00:00:00Z') AS ts_inicio_utc,
        now() AS ts_now_utc,
        EXTRACT(EPOCH FROM (now() - date_bin(INTERVAL '1 hour', now(), TIMESTAMP '1970-01-01T00:00:00Z'))) / 3600.0 AS fraccion_hora,
        SUM(m3h) AS m3h_promedio
      FROM por_caldera
    `;

    const rows = await this.influx.query<{
      ts_inicio_utc: string;
      ts_now_utc: string;
      fraccion_hora: number;
      m3h_promedio: number | null;
    }>(sql);

    if (!rows.length || rows[0].m3h_promedio == null) return null;

    const r = rows[0];
    const m3h = Number(r.m3h_promedio);
    const frac = Number(r.fraccion_hora);
    if (!Number.isFinite(m3h) || m3h < 0) return null;

    return {
      ts_inicio_art: utcToArt(new Date(r.ts_inicio_utc)),
      ts_now_art: utcToArt(new Date(r.ts_now_utc)),
      fraccion_hora: frac,
      m3h_promedio: m3h,
      m3_parcial: m3h * frac,
    };
  }

  /**
   * Corre el ciclo completo: consulta InfluxDB y upserta todas las horas del día industrial
   * en production.gas_hora_estimado como fallback cuando el lab no cargó datos reales.
   */
  async syncGasEstimado(): Promise<void> {
    const datos = await this.fetchGasPorHora();
    if (!datos.length) return;

    const production = this.supabase.schema('production');

    const rows = datos.map(({ ts_cierre, m3_estimado }) => ({
      ts_cierre: toSupabaseTs(ts_cierre),
      m3_estimado,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await production.from('gas_hora_estimado').upsert(rows, { onConflict: 'ts_cierre' });

    if (error) {
      this.logger.warn(`Supabase upsert gas_hora_estimado: ${error.message}`);
    } else {
      this.logger.debug(`Gas estimado OK: ${rows.length} filas upsertadas`);
    }
  }
}
