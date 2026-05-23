import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

interface InfluxQueryRow {
  ts_hora: string;
  gas_total_m3h: number | null;
}

@Injectable()
export class InfluxGasService {
  private readonly logger = new Logger(InfluxGasService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Consulta InfluxDB3: promedio de la última hora de los 3 caudalímetros de gas.
   * Agrupa por hora (truncado) para poder upsert por ts_cierre.
   */
  async fetchGasPromedioUltimaHora(): Promise<{ ts_cierre: Date; m3_estimado: number } | null> {
    const host = this.config.get<string>('INFLUX_URL', 'http://influxdb3:8181');
    const token = this.config.get<string>('INFLUX_TOKEN', '');
    const database = this.config.get<string>('INFLUX_DATABASE', 'corona2026');

    // Traer promedio del último 60 min para cada caldera y sumarlos
    const sql = `
      SELECT
        date_trunc('hour', time + INTERVAL '1 hour') AS ts_hora,
        AVG("caldera2.caldera2.cald2_gas_caudal")
          + AVG("caldera3.caldera3.cald3_gas_caudal")
          + AVG("caldera6.caldera6.cald6_gas_caudal") AS gas_total_m3h
      FROM "dashboard-general-energia"
      WHERE time >= now() - INTERVAL '60 minutes'
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 1
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
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`InfluxDB query failed ${res.status}: ${text.slice(0, 200)}`);
        return null;
      }

      const rows = (await res.json()) as InfluxQueryRow[];
      if (!rows?.length || rows[0].gas_total_m3h == null) {
        this.logger.debug('InfluxDB: sin datos en la última hora');
        return null;
      }

      const row = rows[0];
      return {
        ts_cierre: new Date(row.ts_hora),
        m3_estimado: Number(row.gas_total_m3h),
      };
    } catch (err) {
      this.logger.warn(`InfluxDB fetch error: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Corre el ciclo completo: consulta InfluxDB y upserta en production.gas_hora_estimado.
   */
  async syncGasEstimado(): Promise<void> {
    const dato = await this.fetchGasPromedioUltimaHora();
    if (!dato) return;

    const { ts_cierre, m3_estimado } = dato;

    // Evitar sobrescribir con 0 o valores negativos
    if (!Number.isFinite(m3_estimado) || m3_estimado < 0) {
      this.logger.debug(`InfluxDB: valor inválido (${m3_estimado}), ignorando`);
      return;
    }

    const production = this.supabase.schema('production');
    const { error } = await production.from('gas_hora_estimado').upsert(
      {
        ts_cierre: ts_cierre.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19),
        m3_estimado,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'ts_cierre' },
    );

    if (error) {
      this.logger.warn(`Supabase upsert gas_hora_estimado: ${error.message}`);
    } else {
      this.logger.debug(`Gas estimado OK: ${ts_cierre.toISOString()} → ${m3_estimado.toFixed(1)} m³/h`);
    }
  }
}
