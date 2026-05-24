import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ReportesService } from './reportes.service';
import { ReportesDataService } from './reportes-data.service';
import type { TurnoVentana } from './reportes.types';

/**
 * Cron de reportes de turno.
 *
 * Cierre turno → +30min cron arranca → retry cada 1min hasta éxito o stop.
 * 13:30 → MAÑANA cerró 13:00
 * 21:30 → TARDE  cerró 21:00
 * 05:30 → NOCHE  cerró 05:00
 *
 * Stop conditions:
 *  - datos completos → envía → done
 *  - hard limit REPORTE_TURNO_RETRY_MAX_HOURS
 *  - próximo cron de turno arranca → mata pendientes del anterior
 *  - REPORTE_TURNO_ENABLED=false → skip
 */
@Injectable()
export class ReportesCronService implements OnModuleInit {
  private readonly logger = new Logger(ReportesCronService.name);
  private retryActivo: { ventana: TurnoVentana; intento: number; iniciado: number; timer: NodeJS.Timeout | null } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly reportes: ReportesService,
    private readonly data: ReportesDataService,
  ) {}

  onModuleInit(): void {
    const enabled = this.config.get<string>('REPORTE_TURNO_ENABLED') !== 'false';
    this.logger.log(`Reportes turno cron ${enabled ? 'ACTIVO' : 'DESACTIVADO'} (REPORTE_TURNO_ENABLED)`);
  }

  /** MAÑANA cerró 13:00 → cron 13:30 */
  @Cron('30 13 * * *', { name: 'reporte_manana', timeZone: 'America/Argentina/Buenos_Aires' })
  cronManana() {
    this.disparar();
  }

  /** TARDE cerró 21:00 → cron 21:30 */
  @Cron('30 21 * * *', { name: 'reporte_tarde', timeZone: 'America/Argentina/Buenos_Aires' })
  cronTarde() {
    this.disparar();
  }

  /** NOCHE cerró 05:00 → cron 05:30 */
  @Cron('30 5 * * *', { name: 'reporte_noche', timeZone: 'America/Argentina/Buenos_Aires' })
  cronNoche() {
    this.disparar();
  }

  /**
   * Dispara procesamiento del turno cerrado en este momento.
   * Si hay un retry pendiente de turno anterior → lo cancela.
   */
  private async disparar() {
    if (this.config.get<string>('REPORTE_TURNO_ENABLED') === 'false') {
      this.logger.log('REPORTE_TURNO_ENABLED=false → skip');
      return;
    }
    this.cancelarRetryAnterior();

    const ventana = this.data.ventanaTurnoCerrado();
    this.logger.log(`Disparar reporte ${ventana.turno} ${ventana.fecha_industrial} (${ventana.inicio} → ${ventana.fin})`);
    this.retryActivo = { ventana, intento: 1, iniciado: Date.now(), timer: null };
    this.intentar();
  }

  private async intentar() {
    const ctx = this.retryActivo;
    if (!ctx) return;
    const { ventana, intento, iniciado } = ctx;
    const maxHoras = Number(this.config.get('REPORTE_TURNO_RETRY_MAX_HOURS') ?? 4);
    const intervaloMin = Number(this.config.get('REPORTE_TURNO_RETRY_INTERVAL_MINUTES') ?? 1);

    const transcurridoH = (Date.now() - iniciado) / 3600_000;
    if (transcurridoH >= maxHoras) {
      this.logger.warn(`Reporte ${ventana.turno} ${ventana.fecha_industrial} HARD LIMIT ${maxHoras}h → abandono`);
      this.retryActivo = null;
      return;
    }

    try {
      const result = await this.reportes.procesarTurno(ventana, intento);
      if (result.enviado) {
        this.logger.log(`Reporte ${ventana.turno} ENVIADO intento=${intento} status=${result.webhook_status}`);
        this.retryActivo = null;
        return;
      }
      if (result.motivo === 'ya_enviado') {
        this.logger.log(`Reporte ${ventana.turno} ya enviado previamente → stop`);
        this.retryActivo = null;
        return;
      }
      this.logger.debug(`Reporte ${ventana.turno} intento=${intento} no listo: ${result.completitud.detalle}`);
    } catch (err) {
      this.logger.error(`Reporte ${ventana.turno} intento=${intento} excepción: ${(err as Error).message}`);
    }

    // reagendar (chequear que no haya sido cancelado durante el await)
    if (!this.retryActivo || this.retryActivo !== ctx) return;
    this.retryActivo.intento = intento + 1;
    this.retryActivo.timer = setTimeout(() => this.intentar(), intervaloMin * 60_000);
  }

  private cancelarRetryAnterior() {
    if (this.retryActivo?.timer) {
      clearTimeout(this.retryActivo.timer);
      this.logger.log(`Cancelando retry pendiente del turno anterior (${this.retryActivo.ventana.turno})`);
    }
    this.retryActivo = null;
  }
}
