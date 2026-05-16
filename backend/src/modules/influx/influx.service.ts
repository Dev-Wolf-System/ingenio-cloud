import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InfluxDBClient } from '@influxdata/influxdb3-client';

@Injectable()
export class InfluxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InfluxService.name);
  private client: InfluxDBClient | null = null;
  private database!: string;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('INFLUX_URL');
    const token = this.config.get<string>('INFLUX_TOKEN');
    this.database = this.config.get<string>('INFLUX_DATABASE') ?? 'corona2026';
    if (!host || !token) {
      this.logger.warn('INFLUX_URL/INFLUX_TOKEN vacíos — endpoint history deshabilitado');
      return;
    }
    try {
      this.client = new InfluxDBClient({ host, token, database: this.database });
      this.enabled = true;
      this.logger.log(`InfluxDB client → ${host} db=${this.database}`);
    } catch (err) {
      this.logger.error('InfluxDB init failed', err as Error);
    }
  }

  async onModuleDestroy() {
    if (this.client) await this.client.close();
  }

  isAvailable(): boolean {
    return this.enabled;
  }

  async querySql<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    if (!this.client) throw new Error('InfluxDB no disponible');
    const rows: T[] = [];
    for await (const row of this.client.query(sql, this.database, { type: 'sql' })) {
      rows.push(row as T);
    }
    return rows;
  }

  /**
   * History de una key específica.
   * granularity: 'raw' | '1m' | '5m' | '1h'
   */
  async getHistory(args: {
    area: 'energia' | 'produccion';
    key: string;
    from: string;
    to: string;
    granularity?: 'raw' | '1m' | '5m' | '1h';
  }): Promise<{ time: string; value: number; min?: number; max?: number }[]> {
    if (!this.client) return [];
    const g = args.granularity ?? '5m';
    const interval =
      g === '1m' ? "INTERVAL '1 minute'" :
      g === '5m' ? "INTERVAL '5 minutes'" :
      g === '1h' ? "INTERVAL '1 hour'" : null;

    const sql = interval
      ? `SELECT
           DATE_BIN(${interval}, time, TIMESTAMP '1970-01-01') AS bucket,
           AVG(value) AS value,
           MIN(value) AS min_v,
           MAX(value) AS max_v
         FROM dashboard_signals
         WHERE area = '${args.area}'
           AND key = '${args.key.replace(/'/g, "''")}'
           AND time >= TIMESTAMP '${args.from}'
           AND time <  TIMESTAMP '${args.to}'
         GROUP BY bucket
         ORDER BY bucket ASC`
      : `SELECT time AS bucket, value, value AS min_v, value AS max_v
         FROM dashboard_signals
         WHERE area = '${args.area}'
           AND key = '${args.key.replace(/'/g, "''")}'
           AND time >= TIMESTAMP '${args.from}'
           AND time <  TIMESTAMP '${args.to}'
         ORDER BY bucket ASC
         LIMIT 5000`;

    const rows = await this.querySql<{ bucket: Date | string; value: number; min_v: number; max_v: number }>(sql);
    return rows.map((r) => ({
      time: typeof r.bucket === 'string' ? r.bucket : new Date(r.bucket).toISOString(),
      value: Number(r.value),
      min: Number(r.min_v),
      max: Number(r.max_v),
    }));
  }

  /** Sparkline rápida: últimos N minutos, granularity auto. */
  async getSparkline(area: 'energia' | 'produccion', key: string, minutes = 30): Promise<number[]> {
    if (!this.client) return [];
    const to = new Date();
    const from = new Date(to.getTime() - minutes * 60_000);
    const granularity = minutes <= 30 ? '1m' : '5m';
    const points = await this.getHistory({
      area,
      key,
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
    });
    return points.map((p) => p.value);
  }
}
