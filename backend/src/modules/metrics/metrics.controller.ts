import { Controller, Get, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly svc: MetricsService) {}

  /** GET /api/metrics/snapshot?area=energia|produccion */
  @Get('snapshot')
  snapshot(@Query('area') area?: 'energia' | 'produccion' | 'trapiche') {
    return this.svc.snapshot(area);
  }

  /** GET /api/metrics/dashboard-snapshot?area=energia|produccion — datos Node-RED dashboard */
  @Get('dashboard-snapshot')
  dashboardSnapshot(@Query('area') area?: 'energia' | 'produccion' | 'trapiche') {
    return this.svc.dashboardSnapshot(area);
  }

  /** GET /api/metrics/catalog — catálogo completo sensores (legacy/admin) */
  @Get('catalog')
  catalog() {
    return this.svc.catalog();
  }

  /** GET /api/metrics/canchon — total de camiones en canchón (production.v_canchon_resumen) */
  @Get('canchon')
  canchon() {
    return this.svc.canchonResumen();
  }

  /** GET /api/metrics/color-cinta-larga — color ICUMSA + humedad última lectura cinta larga */
  @Get('color-cinta-larga')
  colorCintaLarga() {
    return this.svc.colorCintaLarga();
  }

}
