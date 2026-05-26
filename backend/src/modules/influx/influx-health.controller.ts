import { Controller, Get } from '@nestjs/common';
import { InfluxQueryService } from './influx-query.service';

interface InfluxHealthResponse {
  status: 'ok' | 'degraded' | 'down';
  url: string;
  database: string;
  hasToken: boolean;
  reachable: boolean;
  latencyMs: number | null;
  tables?: string[];
  error?: string;
}

@Controller('health/influx')
export class InfluxHealthController {
  constructor(private readonly influx: InfluxQueryService) {}

  @Get()
  async check(): Promise<InfluxHealthResponse> {
    const info = this.influx.getConnectionInfo();

    if (!info.configured) {
      return {
        status: 'down',
        url: info.url,
        database: info.database,
        hasToken: info.hasToken,
        reachable: false,
        latencyMs: null,
        error: 'INFLUX_TOKEN no configurado',
      };
    }

    const t0 = Date.now();
    const reachable = await this.influx.ping();
    const latencyMs = Date.now() - t0;

    if (!reachable) {
      return {
        status: 'down',
        url: info.url,
        database: info.database,
        hasToken: info.hasToken,
        reachable: false,
        latencyMs,
        error: 'ping fallido (verificar DNS interno + token)',
      };
    }

    let tables: string[] = [];
    try {
      tables = await this.influx.listTables();
    } catch {
      // no bloquea status si listado falla
    }

    return {
      status: tables.length ? 'ok' : 'degraded',
      url: info.url,
      database: info.database,
      hasToken: info.hasToken,
      reachable: true,
      latencyMs,
      tables,
    };
  }
}
