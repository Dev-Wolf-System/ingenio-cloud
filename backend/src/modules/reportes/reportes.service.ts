import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ReportesDataService } from './reportes-data.service';
import { ReportesFormatterService } from './reportes-formatter.service';
import { ReportesWebhookService } from './reportes-webhook.service';
import type { TurnoVentana, ReportePayload, CompletitudCheck } from './reportes.types';

export interface ProcesarResultado {
  ventana: TurnoVentana;
  completitud: CompletitudCheck;
  enviado: boolean;
  payload?: ReportePayload;
  webhook_status?: number;
  webhook_response?: string;
  error?: string;
  motivo?: string; // ya enviado / no completo / sin webhook url
}

@Injectable()
export class ReportesService {
  private readonly logger = new Logger(ReportesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly data: ReportesDataService,
    private readonly formatter: ReportesFormatterService,
    private readonly webhook: ReportesWebhookService,
  ) {}

  /**
   * Preview: arma payload sin enviar. Para debug/testing.
   */
  async preview(ventana: TurnoVentana): Promise<{ completitud: CompletitudCheck; payload: ReportePayload }> {
    const completitud = await this.data.checkCompletitud(ventana);
    const reporte = await this.data.armarReporte(ventana);
    const payload = this.formatter.build(reporte);
    return { completitud, payload };
  }

  /**
   * Procesa turno: check completitud → envía si listo y no enviado antes.
   * Idempotente: si ya hay un envío exitoso para ese turno+fecha, no reenvía.
   */
  async procesarTurno(ventana: TurnoVentana, intentoNumero = 1): Promise<ProcesarResultado> {
    // Check idempotencia
    const yaEnviado = await this.yaEnviado(ventana);
    if (yaEnviado) {
      return {
        ventana,
        completitud: { completo: true, horas_totales: 8, molienda_faltante: 0, gas_faltante: 0, detalle: 'ya enviado previamente' },
        enviado: false,
        motivo: 'ya_enviado',
      };
    }

    const completitud = await this.data.checkCompletitud(ventana);
    if (!completitud.completo) {
      await this.logAudit(ventana, intentoNumero, completitud, false, null, null, null, null);
      return { ventana, completitud, enviado: false, motivo: 'datos_incompletos' };
    }

    // Datos completos → armar + enviar
    const reporte = await this.data.armarReporte(ventana);
    const payload = this.formatter.build(reporte);
    const result = await this.webhook.send(payload);
    const enviado = result.ok;

    await this.logAudit(
      ventana,
      intentoNumero,
      completitud,
      enviado,
      payload,
      result.status,
      result.body,
      enviado ? null : 'webhook respondió no-ok',
    );

    return {
      ventana,
      completitud,
      enviado,
      payload,
      webhook_status: result.status,
      webhook_response: result.body,
      error: enviado ? undefined : 'webhook fail',
    };
  }

  async historico(limit = 50) {
    const prod = this.supabase.schema('production');
    const { data, error } = await prod
      .from('reportes_turno_enviados')
      .select('id, turno, fecha_industrial, turno_inicio, turno_fin, intento_numero, datos_completos, enviado, webhook_status, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      this.logger.warn(`historico fail: ${error.message}`);
      return [];
    }
    return data ?? [];
  }

  // ───────── helpers ─────────

  private async yaEnviado(ventana: TurnoVentana): Promise<boolean> {
    const prod = this.supabase.schema('production');
    const { data, error } = await prod
      .from('reportes_turno_enviados')
      .select('id')
      .eq('fecha_industrial', ventana.fecha_industrial)
      .eq('turno', ventana.turno)
      .eq('enviado', true)
      .limit(1);
    if (error) {
      this.logger.warn(`yaEnviado check fail: ${error.message}`);
      return false;
    }
    return (data ?? []).length > 0;
  }

  private async logAudit(
    ventana: TurnoVentana,
    intento: number,
    completitud: CompletitudCheck,
    enviado: boolean,
    payload: ReportePayload | null,
    webhookStatus: number | null,
    webhookResponse: string | null,
    errorMessage: string | null,
  ) {
    const prod = this.supabase.schema('production');
    const { error } = await prod.from('reportes_turno_enviados').insert({
      turno: ventana.turno,
      fecha_industrial: ventana.fecha_industrial,
      turno_inicio: ventana.inicio,
      turno_fin: ventana.fin,
      intento_numero: intento,
      datos_completos: completitud.completo,
      enviado,
      payload: payload as unknown as Record<string, unknown> | null,
      mensaje_telegram: payload?.mensaje_telegram ?? null,
      webhook_status: webhookStatus,
      webhook_response: webhookResponse,
      error_message: errorMessage ?? (completitud.completo ? null : completitud.detalle),
    });
    if (error) this.logger.warn(`audit insert fail: ${error.message}`);
  }
}
