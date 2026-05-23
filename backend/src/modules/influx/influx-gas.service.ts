import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

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
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Consulta InfluxDB3: promedio por hora del día industrial corriente (08:00 ART en adelante).
   * Retorna múltiples filas — una por hora — para rellenar todas las horas sin dato de lab.
   */
  async fetchGasPorHora(): Promise<Array<{ ts_cierre: Date; m3_estimado: number }>> {
    const host = this.config.get<string>('INFLUX_URL', 'http://influxdb3:8181');
    const token = this.config.get<string>('INFLUX_TOKEN', '');
    const database = this.config.get<string>('INFLUX_DATABASE', 'corona2026');

    // Inicio del día industrial actual en UTC:
    // Si son >= 11:00 UTC (>= 08:00 ART), el día arrancó hoy a las 11:00 UTC.
    // Si son < 11:00 UTC (< 08:00 ART), el día arrancó ayer a las 11:00 UTC.
    // Usamos INTERVAL '20 hours' de lookback para cubrir el día industrial completo
    // sin necesidad de calcular el inicio exacto acá.
    const sql = `
      SELECT
        date_bin(INTERVAL '1 hour', time, TIMESTAMP '1970-01-01T00:00:00Z') + INTERVAL '1 hour' AS ts_hora_utc,
        AVG("caldera2.caldera2.cald2_gas_caudal")
          + AVG("caldera3.caldera3.cald3_gas_caudal")
          + AVG("caldera6.caldera6.cald6_gas_caudal") AS gas_total_m3h
      FROM "dashboard-general-energia"
      WHERE time >= now() - INTERVAL '20 hours'
      GROUP BY 1
      ORDER BY 1
    `;

    try {
      const res = await fetch(`${host}/api/v3/query_sql`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ q: sql, db: database }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`InfluxDB query failed ${res.status}: ${text.slice(0, 200)}`);
        return [];
      }

      const rows = (await res.json()) as InfluxQueryRow[];
      if (!rows?.length) {
        this.logger.debug('InfluxDB: sin datos en las últimas 20h');
        return [];
      }

      return rows
        .filter((r) => r.gas_total_m3h != null && Number.isFinite(Number(r.gas_total_m3h)) && Number(r.gas_total_m3h) >= 0)
        .map((r) => ({
          // ts_hora_utc es el cierre en UTC → convertir a ART restando 3h
          ts_cierre: utcToArt(new Date(r.ts_hora_utc)),
          m3_estimado: Number(r.gas_total_m3h),
        }));
    } catch (err) {
      this.logger.warn(`InfluxDB fetch error: ${(err as Error).message}`);
      return [];
    }
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
