import { Controller, Get, Post, Query } from '@nestjs/common';
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

  /** GET /api/guardia/molienda-actual — último valor de molienda cargado del turno corriente */
  @Get('molienda-actual')
  moliendaActual() {
    return this.svc.getMoliendaActualUltima();
  }

  /** GET /api/guardia/molienda-bloques — estado de molienda por bloques (zafra, día/turno) */
  @Get('molienda-bloques')
  moliendaBloques() {
    return this.svc.getMoliendaBloques();
  }

  /** GET /api/guardia/gas-actual — último valor de gas cargado del turno corriente */
  @Get('gas-actual')
  gasActual() {
    return this.svc.getGasActualUltima();
  }

  /** GET /api/guardia/gas-hora-curso — consumo estimado hora EN CURSO (Influx, cache 30s) */
  @Get('gas-hora-curso')
  gasHoraCurso() {
    return this.svc.getGasHoraEnCurso();
  }

  /** GET /api/guardia/vapor-actual — consumo vapor compensado + producción + diferencial */
  @Get('vapor-actual')
  vaporActual() {
    return this.svc.getVaporActual();
  }

  /** GET /api/guardia/vapor-hxh?horas=24 — serie horaria consumido vs producido */
  @Get('vapor-hxh')
  vaporHxH(@Query('horas') horas?: string) {
    const h = horas ? parseInt(horas, 10) : 24;
    return this.svc.getVaporHorxHora(Number.isFinite(h) ? h : 24);
  }

  /** GET /api/guardia/gas-bloques — estado de gas por bloques (zafra, día/turno) */
  @Get('gas-bloques')
  gasBloques() {
    return this.svc.getGasBloques();
  }

  /** GET /api/guardia/molienda-hora — molienda hora x hora turno previo + stats */
  @Get('molienda-hora')
  moliendaHora() {
    return this.svc.getMoliendaHoraPrevio();
  }

  /** GET /api/guardia/produccion-hora — tabla molienda+producción hora×hora turno actual */
  @Get('produccion-hora')
  produccionHora() {
    return this.svc.getProduccionHora();
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
