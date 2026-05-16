import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface DashboardPayloadItem {
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

  /**
   * Recibe payload Node-RED { dashboard_<area>: { Alias: {value, display, unit, raw, timestamp}, ... } }
   * Upsert en industrial.dashboard_data.
   */
  async ingestDashboard(
    area: 'energia' | 'produccion',
    data: Record<string, DashboardPayloadItem>,
  ): Promise<{ ingested: number }> {
    const rows = Object.entries(data)
      .map(([key, item]) => {
        if (!item || typeof item.value !== 'number' || !Number.isFinite(item.value)) {
          return null;
        }
        return {
          area,
          key,
          value: item.value,
          display: item.display ?? null,
          unit: item.unit ?? null,
          raw: item.raw ?? null,
          updated_at: item.timestamp ?? new Date().toISOString(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) {
      this.logger.warn(`Empty dashboard payload for area ${area}`);
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

  /**
   * Recibe payload Node-RED velocidad molino:
   * { turno, desde, hasta, cantidad_puntos, promedio, maximo, minimo, labels, valores }
   */
  async ingestMillSpeed(payload: {
    turno: string;
    desde?: string;
    hasta?: string;
    cantidad_puntos: number;
    promedio: number;
    maximo: number;
    minimo: number;
    labels: string[];
    valores: number[];
  }) {
    const today = new Date().toISOString().slice(0, 10);
    const shiftName =
      payload.turno === 'MAÑANA' ? 'morning' :
      payload.turno === 'TARDE' ? 'afternoon' :
      payload.turno === 'NOCHE' ? 'night' : 'unknown';

    const industrial = this.supabase.schema('industrial');
    const { error } = await industrial.from('shift_kpis_cache').upsert(
      [
        {
          kpi_id: 'vel_primer_molino',
          shift_date: today,
          shift_name: shiftName,
          shift_ref: 'previous',
          payload: payload as never,
          fetched_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'kpi_id,shift_date,shift_name,tenant_id,plant_id' },
    );
    if (error) {
      this.logger.error('Mill speed upsert failed', error);
      throw new Error(error.message);
    }
    this.logger.log(`Mill speed cached for ${today} ${shiftName} (${payload.cantidad_puntos} pts)`);
    return { ok: true };
  }
}
