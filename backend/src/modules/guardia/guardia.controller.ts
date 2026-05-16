import { Controller, Get } from '@nestjs/common';
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
}
