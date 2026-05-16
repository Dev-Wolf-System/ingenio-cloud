import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { InfluxService } from '../influx/influx.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly svc: MetricsService,
    private readonly influx: InfluxService,
  ) {}

  /** GET /api/metrics/snapshot?area=energia|produccion */
  @Get('snapshot')
  snapshot(@Query('area') area?: 'energia' | 'produccion') {
    return this.svc.snapshot(area);
  }

  /** GET /api/metrics/dashboard-snapshot?area=energia|produccion — datos Node-RED dashboard */
  @Get('dashboard-snapshot')
  dashboardSnapshot(@Query('area') area?: 'energia' | 'produccion') {
    return this.svc.dashboardSnapshot(area);
  }

  /** GET /api/metrics/catalog — catálogo completo sensores (legacy/admin) */
  @Get('catalog')
  catalog() {
    return this.svc.catalog();
  }

  /**
   * GET /api/metrics/history?area=energia&key=Potencia_WEG&from=ISO&to=ISO&granularity=raw|1m|5m|1h
   * Lee InfluxDB. Devuelve serie tiempo para sparklines/tendencias.
   */
  @Get('history')
  async history(
    @Query('area') area: 'energia' | 'produccion',
    @Query('key') key: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity?: 'raw' | '1m' | '5m' | '1h',
  ) {
    if (!area || !key) throw new BadRequestException('area + key requeridos');
    if (!this.influx.isAvailable()) return { area, key, points: [], _error: 'influx_disabled' };

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 60_000);
    const points = await this.influx.getHistory({
      area,
      key,
      from: from ?? defaultFrom.toISOString(),
      to: to ?? now.toISOString(),
      granularity: granularity ?? '5m',
    });
    return { area, key, granularity: granularity ?? '5m', points };
  }

  /**
   * GET /api/metrics/sparkline?area=X&key=Y&minutes=30
   * Devuelve array de valores plain para mini gráfica.
   */
  @Get('sparkline')
  async sparkline(
    @Query('area') area: 'energia' | 'produccion',
    @Query('key') key: string,
    @Query('minutes') minutes?: string,
  ) {
    if (!area || !key) throw new BadRequestException('area + key requeridos');
    if (!this.influx.isAvailable()) return { values: [] };
    const m = minutes ? parseInt(minutes, 10) : 30;
    const values = await this.influx.getSparkline(area, key, m);
    return { values };
  }
}
