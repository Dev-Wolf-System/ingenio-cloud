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
    @Query('periodo') periodo?: string,
    @Query('offset') offset?: string,
  ) {
    const list = (procesos ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const p = periodo === 'zafra' ? 'zafra' : 'dia';
    const off = Math.max(0, Math.min(parseInt(offset ?? '0', 10) || 0, 60));
    return this.svc.lab(list, p, off);
  }

  @Get('comparativa-cana')
  comparativaCana() { return this.svc.comparativaCana(); }

  @Get('movimientos-cana')
  movimientosCana(@Query('limit') limit?: string) {
    return this.svc.movimientosCana(limit ? parseInt(limit, 10) : 100);
  }

  @Get('paradas')
  paradas(@Query('periodo') periodo?: string, @Query('offset') offset?: string) {
    const p = (['turno', 'dia', 'zafra'] as const).includes(periodo as never) ? periodo as 'turno' | 'dia' | 'zafra' : 'dia';
    const off = Math.max(0, Math.min(parseInt(offset ?? '0', 10) || 0, 60));
    return this.svc.paradasAnalisis(p, off);
  }

  @Get('azucar')
  azucar(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.svc.azucar(desde, hasta);
  }
}
