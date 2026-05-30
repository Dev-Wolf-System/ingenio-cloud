import { Controller, Get, Query } from '@nestjs/common';
import { MoliendaCloudService } from './molienda-cloud.service';

@Controller('molienda-cloud')
export class MoliendaCloudController {
  constructor(private readonly svc: MoliendaCloudService) {}

  @Get('canchon')
  canchon() { return this.svc.canchon(); }

  @Get('balanza-hora')
  balanzaHora() { return this.svc.balanzaHora(); }

  @Get('movimientos-tipo')
  movimientosTipo() { return this.svc.movimientosTipo(); }

  @Get('molienda-bloques')
  moliendaBloques() { return this.svc.moliendaBloques(); }

  @Get('lab')
  lab(
    @Query('procesos') procesos?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const list = (procesos ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return this.svc.lab(list, desde, hasta);
  }
}
