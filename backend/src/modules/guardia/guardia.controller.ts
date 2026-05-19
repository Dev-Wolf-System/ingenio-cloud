import { Controller, Get, Post } from '@nestjs/common';
import { GuardiaService } from './guardia.service';

@Controller('guardia')
export class GuardiaController {
  constructor(private readonly svc: GuardiaService) {}

  /** GET /api/guardia/molienda — molienda promedio turno actual */
  @Get('molienda')
  molienda() {
    return this.svc.getMolienda();
  }

  /** GET /api/guardia/gas-previo — consumo gas turno anterior */
  @Get('gas-previo')
  gasPrevio() {
    return this.svc.getGasPrevio();
  }

  /** GET /api/guardia/paradas — paradas turno anterior */
  @Get('paradas')
  paradas() {
    return this.svc.getParadasPrevio();
  }

  /** GET /api/guardia/vel-molino — velocidad primer molino turno previo (recibido por webhook) */
  @Get('vel-molino')
  velMolino() {
    return this.svc.getMillSpeedPrevio();
  }

  /** GET /api/guardia/molienda-previo — molienda turno previo (cache) */
  @Get('molienda-previo')
  moliendaPrevio() {
    return this.svc.getMoliendaPrevio();
  }

  /** GET /api/guardia/resumen — resumen completo turno anterior (todos los KPIs) */
  @Get('resumen')
  resumen() {
    return this.svc.getResumenGuardia();
  }

  /** GET /api/guardia/turno-previo — resumen turno previo desde Postgres (v_resumen_turno_previo) */
  @Get('turno-previo')
  turnoPrevio() {
    return this.svc.getResumenTurnoPrevio();
  }

  /** GET /api/guardia/paradas-detalle — paradas individuales del turno previo */
  @Get('paradas-detalle')
  paradasDetalle() {
    return this.svc.getParadasDetalle();
  }

  /** GET /api/guardia/analisis-ia — análisis IA del turno previo */
  @Get('analisis-ia')
  analisisIA() {
    return this.svc.getAnalisisIA();
  }

  /** POST /api/guardia/analisis-ia/refresh — disparar IA manual ahora */
  @Post('analisis-ia/refresh')
  refreshAnalisisIA() {
    return this.svc.forceAnalisisIA();
  }
}
