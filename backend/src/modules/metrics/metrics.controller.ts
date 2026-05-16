import { Controller, Get, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly svc: MetricsService) {}

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

}
