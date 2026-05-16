import { Controller, Get } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly svc: AlertsService) {}

  /** GET /api/alerts/active — alertas activas (no resueltas) */
  @Get('active')
  active() {
    return this.svc.listActive();
  }
}
