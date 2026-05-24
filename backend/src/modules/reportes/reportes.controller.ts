import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { ReportesDataService } from './reportes-data.service';
import type { TurnoNombre, TurnoVentana } from './reportes.types';

interface EnviarBody {
  turno: TurnoNombre;
  fecha_industrial?: string;
}

@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly svc: ReportesService,
    private readonly data: ReportesDataService,
  ) {}

  /**
   * GET /api/reportes/turno/preview?ahora=ISO
   * Genera payload del turno cerrado SIN enviar webhook.
   * Si pasa `ahora`, calcula respecto a esa fecha.
   */
  @Get('turno/preview')
  async preview(@Query('ahora') ahora?: string) {
    const ventana = this.data.ventanaTurnoCerrado(ahora);
    return this.svc.preview(ventana);
  }

  /**
   * POST /api/reportes/turno/enviar
   * Fuerza el envío de un turno específico (idempotente: no reenvía si ya OK).
   * body: { turno, fecha_industrial }
   */
  @Post('turno/enviar')
  async enviar(@Body() body: EnviarBody) {
    if (!body?.turno || !['MAÑANA', 'TARDE', 'NOCHE'].includes(body.turno)) {
      throw new BadRequestException('Falta turno o valor inválido. Debe ser MAÑANA, TARDE o NOCHE.');
    }
    if (!body.fecha_industrial || !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_industrial)) {
      throw new BadRequestException('Falta fecha_industrial o formato inválido (YYYY-MM-DD).');
    }
    const ventana = this.armarVentanaManual(body.turno, body.fecha_industrial);
    return this.svc.procesarTurno(ventana, 1);
  }

  /**
   * GET /api/reportes/turno/historico?limit=50
   * Últimos N intentos (enviados + fallidos).
   */
  @Get('turno/historico')
  async historico(@Query('limit') limit?: string) {
    return this.svc.historico(limit ? Number(limit) : 50);
  }

  private armarVentanaManual(turno: TurnoNombre, fechaIndustrial?: string): TurnoVentana {
    const TZ = '-03:00';
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    const fecha = fechaIndustrial ?? hoy;

    if (turno === 'MAÑANA') {
      return { turno, fecha_industrial: fecha, inicio: `${fecha}T05:00:00${TZ}`, fin: `${fecha}T13:00:00${TZ}` };
    }
    if (turno === 'TARDE') {
      return { turno, fecha_industrial: fecha, inicio: `${fecha}T13:00:00${TZ}`, fin: `${fecha}T21:00:00${TZ}` };
    }
    // NOCHE: arranca día siguiente 21 y cierra al otro día 05? — convención local:
    // fecha_industrial es la fecha del día calendario donde arrancó la NOCHE (21:00).
    const d = new Date(`${fecha}T00:00:00${TZ}`);
    d.setDate(d.getDate() + 1);
    const finFecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { turno, fecha_industrial: fecha, inicio: `${fecha}T21:00:00${TZ}`, fin: `${finFecha}T05:00:00${TZ}` };
  }
}
