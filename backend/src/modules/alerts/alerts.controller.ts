import { Controller, Get, Param, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly svc: AlertsService) {}

  /** GET /api/alerts/active — alertas activas (no resueltas) */
  @Get('active')
  active() {
    return this.svc.listActive();
  }

  /** GET /api/alerts/history?limit=100&offset=0 — historial de alertas resueltas */
  @Get('history')
  history(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.svc.listHistory(
      limit ? Math.min(parseInt(limit, 10), 500) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /** GET /api/alerts/:id/analisis-causa — análisis IA de causa (cache 5min) */
  @Get(':id/analisis-causa')
  analisisCausa(@Param('id') id: string) {
    return this.svc.getAnalisisCausa(id);
  }
}
