import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InfluxQueryOptions {
  /** Timeout en ms. Default 10s. */
  timeoutMs?: number;
  /** Database override (default INFLUX_DATABASE). */
  database?: string;
}

export interface InfluxConnectionInfo {
  url: string;
  database: string;
  hasToken: boolean;
  configured: boolean;
}

@Injectable()
export class InfluxQueryService implements OnModuleInit {
  private readonly logger = new Logger(InfluxQueryService.name);
  private readonly url: string;
  private readonly token: string;
  private readonly database: string;

  constructor(private readonly config: ConfigService) {
    this.url = this.config.get<string>('INFLUX_URL', 'http://influxdb3:8181');
    this.token = this.config.get<string>('INFLUX_TOKEN', '');
    this.database = this.config.get<string>('INFLUX_DATABASE', 'corona2026');
  }

  async onModuleInit() {
    if (!this.token) {
      this.logger.warn('INFLUX_TOKEN no seteado — queries fallarán hasta que se configure');
      return;
    }
    const ok = await this.ping();
    if (ok) {
      this.logger.log(`Influx OK → ${this.url} (db=${this.database})`);
    } else {
      this.logger.warn(`Influx unreachable → ${this.url} (verificar network + token)`);
    }
  }

  getConnectionInfo(): InfluxConnectionInfo {
    return {
      url: this.url,
      database: this.database,
      hasToken: !!this.token,
      configured: !!this.url && !!this.token,
    };
  }

  /**
   * Ejecuta SQL contra InfluxDB 3 vía `/api/v3/query_sql`.
   * Retorna array de filas tipadas (caller hace cast/parse).
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    opts: InfluxQueryOptions = {},
  ): Promise<T[]> {
    if (!this.token) {
      this.logger.debug('Influx query skipped: token no configurado');
      return [];
    }

    const db = opts.database ?? this.database;
    const timeout = opts.timeoutMs ?? 10_000;

    try {
      const res = await fetch(`${this.url}/api/v3/query_sql`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ q: sql, db }),
        signal: AbortSignal.timeout(timeout),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(
          `Influx query ${res.status}: ${text.slice(0, 300)} | SQL: ${sql.slice(0, 200)}`,
        );
        return [];
      }

      const rows = (await res.json()) as T[];
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`Influx fetch error: ${msg} | SQL: ${sql.slice(0, 200)}`);
      return [];
    }
  }

  /** Ping liviano para health checks. Resuelve DNS + auth + parse. */
  async ping(): Promise<boolean> {
    if (!this.token) return false;
    try {
      const res = await fetch(`${this.url}/api/v3/query_sql`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: 'SELECT 1', db: this.database }),
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Lista measurements (tablas) del database. */
  async listTables(): Promise<string[]> {
    const rows = await this.query<{ table_schema: string; table_name: string }>(
      `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'iox' ORDER BY table_name`,
    );
    return rows.map((r) => r.table_name);
  }

  /** Lista columnas de una tabla. */
  async listColumns(
    table: string,
  ): Promise<Array<{ column_name: string; data_type: string }>> {
    return this.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table.replace(/'/g, "''")}' ORDER BY column_name`,
    );
  }
}
