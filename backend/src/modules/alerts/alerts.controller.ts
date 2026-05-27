import { Controller, Get, Param } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly svc: AlertsService) {}

  /** GET /api/alerts/active — alertas activas (no resueltas) */
  @Get('active')
  active() {
    return this.svc.listActive();
  }

  /** GET /api/alerts/:id/analisis-causa — análisis IA de causa (cache 5min) */
  @Get(':id/analisis-causa')
  analisisCausa(@Param('id') id: string) {
    return this.svc.getAnalisisCausa(id);
  }
}
