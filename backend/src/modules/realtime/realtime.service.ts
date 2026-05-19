import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Formatos aceptados de Node-RED:
 *
 * A) Array nuevo (formato actual):
 *   [{ alias, value, unit, time }, ...]
 *
 * B) Wrapped legacy:
 *   { dashboard_<area>: { Alias: { value, display, unit, raw, timestamp } } }
 */
export interface ArrayItem {
  alias: string;
  value: number;
  unit?: string;
  time?: string;
}

export interface WrappedItem {
  value: number;
  display?: string;
  unit?: string;
  raw?: number;
  timestamp?: string;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Detecta formato (array o wrapped) y normaliza a rows DB */
  private normalizeDashboard(area: 'energia' | 'produccion' | 'trapiche', body: unknown) {
    const rows: Array<{
      area: string;
      key: string;
      value: number;
      display: string | null;
      unit: string | null;
      raw: number | null;
      updated_at: string;
    }> = [];

    // Formato A: array directo
    if (Array.isArray(body)) {
      for (const item of body as ArrayItem[]) {
        if (!item || typeof item.value !== 'number' || !Number.isFinite(item.value)) continue;
        const clamped = Math.max(0, item.value);
        rows.push({
          area,
          key: item.alias,
          value: clamped,
          display: item.unit ? `${clamped} ${item.unit}` : null,
          unit: item.unit ?? null,
          raw: item.value,
          updated_at: item.time ? new Date(item.time).toISOString() : new Date().toISOString(),
        });
      }
      return rows;
    }

    // Formato B: wrapped { dashboard_<area>: {...} }
    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>;
      const wrappedKey =
        area === 'energia' ? 'dashboard_energia'
        : area === 'produccion' ? 'dashboard_produccion'
        : 'dashboard_trapiche';
      const inner = obj[wrappedKey] ?? obj;
      if (inner && typeof inner === 'object') {
        for (const [key, raw] of Object.entries(inner as Record<string, unknown>)) {
          const item = raw as WrappedItem;
          if (!item || typeof item.value !== 'number' || !Number.isFinite(item.value)) continue;
          const clamped = Math.max(0, item.value);
          rows.push({
            area,
            key,
            value: clamped,
            display: item.display ?? (item.unit ? `${clamped} ${item.unit}` : null),
            unit: item.unit ?? null,
            raw: item.raw ?? item.value,
            updated_at: item.timestamp ?? new Date().toISOString(),
          });
        }
      }
    }
    return rows;
  }

  async ingestDashboard(area: 'energia' | 'produccion' | 'trapiche', body: unknown) {
    const rows = this.normalizeDashboard(area, body);
    if (rows.length === 0) {
      this.logger.warn(`Empty payload for area ${area}`);
      return { ingested: 0 };
    }
    const industrial = this.supabase.schema('industrial');
    const { error } = await industrial
      .from('dashboard_data')
      .upsert(rows, { onConflict: 'area,key,tenant_id,plant_id' });
    if (error) {
      this.logger.error(`upsert dashboard_data ${area} failed`, error);
      throw new Error(error.message);
    }
    this.logger.log(`Dashboard ${area}: ingested ${rows.length} keys`);
    return { ingested: rows.length };
  }

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

  /**
   * Mill speed turno previo (websocket — llega 1x cada cambio de turno +15min)
   *
   * Acepta tanto el formato NUEVO (stats + grafico) como el legacy (promedio
   * + labels + valores). Normaliza al formato nuevo antes de cachear.
   */
  async ingestMillSpeed(payload: Record<string, unknown>) {
    const turnoRaw = String(payload.turno ?? '');
    const shiftName = this.mapTurno(turnoRaw);
    if (shiftName === 'unknown') {
      this.logger.warn(`Mill speed turno desconocido: ${turnoRaw}`);
      return { ok: false, error: 'turno desconocido' };
    }

    // Detectar formato NUEVO (stats + grafico) o LEGACY (promedio + labels + valores)
    const isNew =
      payload.stats != null &&
      typeof payload.stats === 'object' &&
      payload.grafico != null &&
      typeof payload.grafico === 'object';

    let normalized: {
      turno: string;
      desde?: string;
      hasta?: string;
      cantidad_puntos: number;
      stats: { promedio_rpm: number; maximo_rpm: number; minimo_rpm: number };
      grafico: {
        labels: string[];
        velocidad_promedio: number[];
        velocidad_maxima: number[];
        velocidad_minima: number[];
      };
    };

    if (isNew) {
      const stats = payload.stats as { promedio_rpm?: number; maximo_rpm?: number; minimo_rpm?: number };
      const grafico = payload.grafico as {
        labels?: string[];
        velocidad_promedio?: number[];
        velocidad_maxima?: number[];
        velocidad_minima?: number[];
      };
      normalized = {
        turno: turnoRaw,
        desde: payload.desde as string | undefined,
        hasta: payload.hasta as string | undefined,
        cantidad_puntos: Number(payload.cantidad_puntos ?? 0),
        stats: {
          promedio_rpm: Number(stats.promedio_rpm ?? 0),
          maximo_rpm: Number(stats.maximo_rpm ?? 0),
          minimo_rpm: Number(stats.minimo_rpm ?? 0),
        },
        grafico: {
          labels: grafico.labels ?? [],
          velocidad_promedio: grafico.velocidad_promedio ?? [],
          velocidad_maxima: grafico.velocidad_maxima ?? [],
          velocidad_minima: grafico.velocidad_minima ?? [],
        },
      };
    } else {
      // LEGACY: promedio + labels + valores → expandir a estructura nueva
      const valores = (payload.valores as number[]) ?? [];
      const labels = (payload.labels as string[]) ?? [];
      normalized = {
        turno: turnoRaw,
        desde: payload.desde as string | undefined,
        hasta: payload.hasta as string | undefined,
        cantidad_puntos: Number(payload.cantidad_puntos ?? valores.length),
        stats: {
          promedio_rpm: Number(payload.promedio ?? 0),
          maximo_rpm: Number(payload.maximo ?? 0),
          minimo_rpm: Number(payload.minimo ?? 0),
        },
        grafico: {
          labels,
          velocidad_promedio: valores,
          velocidad_maxima: valores, // sin desglose en legacy, replicamos
          velocidad_minima: valores,
        },
      };
    }

    const shiftDate = this.resolveShiftDate(shiftName);
    const industrial = this.supabase.schema('industrial');
    const { error } = await industrial.from('shift_kpis_cache').upsert(
      [
        {
          kpi_id: 'vel_primer_molino',
          shift_date: shiftDate,
          shift_name: shiftName,
          shift_ref: 'previous',
          payload: normalized as never,
          fetched_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'kpi_id,shift_date,shift_name,tenant_id,plant_id' },
    );
    if (error) {
      this.logger.error('Mill speed upsert failed', error);
      throw new Error(error.message);
    }
    this.logger.log(
      `Mill speed cached ${shiftDate} ${shiftName} (${normalized.cantidad_puntos} pts, fmt=${isNew ? 'new' : 'legacy'})`,
    );
    return { ok: true };
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
