import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private mapTurno(t: string): 'morning' | 'afternoon' | 'night' | 'unknown' {
    if (t === 'MAÑANA') return 'morning';
    if (t === 'TARDE') return 'afternoon';
    if (t === 'NOCHE') return 'night';
    return 'unknown';
  }

  /**
   * Fecha del turno previo en formato YYYY-MM-DD.
   * Ej: si recibo a las 05:15 hoy = "MAÑANA actual" → previo es turno NOCHE que arrancó AYER 21:00.
   *     `shift_date` debe ser fecha INICIO del turno previo (consistente con shiftDateKey).
   */
  private resolveShiftDate(turnoPrevio: 'morning' | 'afternoon' | 'night'): string {
    const now = new Date();
    // Turno actual cuando recibimos = el turno que YA empezó hace ~15min
    // Previo NOCHE → empezó ayer 21:00 → shift_date = ayer
    // Previo MAÑANA → empezó hoy 05:00 → shift_date = hoy
    // Previo TARDE → empezó hoy 13:00 → shift_date = hoy
    if (turnoPrevio === 'night') {
      const yesterday = new Date(now);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      return yesterday.toISOString().slice(0, 10);
    }
    return now.toISOString().slice(0, 10);
  }

  /** Resumen guardia anterior (HTTP POST) */
  async ingestGuardiaResumen(payload: {
    turno_anterior: string;
    desde: string;
    hasta: string;
    timestamp_consulta?: string;
    paradasFabrica: unknown;
    moliendaPromedio: unknown;
    consumoGas: unknown;
  }) {
    const shiftName = this.mapTurno(payload.turno_anterior);
    if (shiftName === 'unknown') {
      this.logger.warn(`Guardia turno desconocido: ${payload.turno_anterior}`);
      return { ok: false, error: 'turno desconocido' };
    }
    // Fecha consistente con shiftDateKey: inicio del turno previo
    const shiftDate = this.resolveShiftDate(shiftName);

    const industrial = this.supabase.schema('industrial');

    // 3 KPIs separados en cache: gas_previo, paradas_previo, molienda_previo
    const rows = [
      {
        kpi_id: 'gas_previo',
        shift_date: shiftDate,
        shift_name: shiftName,
        shift_ref: 'previous',
        payload: payload.consumoGas as never,
        fetched_at: new Date().toISOString(),
      },
      {
        kpi_id: 'paradas_previo',
        shift_date: shiftDate,
        shift_name: shiftName,
        shift_ref: 'previous',
        payload: payload.paradasFabrica as never,
        fetched_at: new Date().toISOString(),
      },
      {
        kpi_id: 'molienda_previo',
        shift_date: shiftDate,
        shift_name: shiftName,
        shift_ref: 'previous',
        payload: payload.moliendaPromedio as never,
        fetched_at: new Date().toISOString(),
      },
      {
        kpi_id: 'resumen_guardia',
        shift_date: shiftDate,
        shift_name: shiftName,
        shift_ref: 'previous',
        payload: payload as never,
        fetched_at: new Date().toISOString(),
      },
    ];

    const { error } = await industrial.from('shift_kpis_cache').upsert(rows, {
      onConflict: 'kpi_id,shift_date,shift_name,tenant_id,plant_id',
    });
    if (error) {
      this.logger.error('Guardia resumen upsert failed', error);
      throw new Error(error.message);
    }
    this.logger.log(`Guardia resumen cached ${shiftDate} ${shiftName} (${rows.length} KPIs)`);
    return { ok: true, kpis_cached: rows.length };
  }
}
