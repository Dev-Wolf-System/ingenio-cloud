import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { MssqlService } from '../mssql/mssql.service';
import { getCurrentShift, getPreviousShift, shiftDateKey, type Shift } from '../../common/shift';

@Injectable()
export class GuardiaService {
  private readonly logger = new Logger(GuardiaService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mssql: MssqlService,
    private readonly config: ConfigService,
  ) {}

  private async getCached(kpiId: string, shift: Shift) {
    const industrial = this.supabase.schema('industrial');
    const { data } = await industrial
      .from('shift_kpis_cache')
      .select('payload, fetched_at, valid_until')
      .eq('kpi_id', kpiId)
      .eq('shift_date', shiftDateKey(shift))
      .eq('shift_name', shift.name)
      .maybeSingle();
    if (!data) return null;
    if (data.valid_until && new Date(data.valid_until) < new Date()) return null;
    return data.payload;
  }

  private async setCached(
    kpiId: string,
    shift: Shift,
    payload: unknown,
    shiftRef: 'current' | 'previous',
  ) {
    const industrial = this.supabase.schema('industrial');
    await industrial.from('shift_kpis_cache').upsert(
      [
        {
          kpi_id: kpiId,
          shift_date: shiftDateKey(shift),
          shift_name: shift.name,
          shift_ref: shiftRef,
          payload: payload as never,
          fetched_at: new Date().toISOString(),
          valid_until: shiftRef === 'current' ? new Date(Date.now() + 5 * 60_000).toISOString() : null,
        },
      ],
      { onConflict: 'kpi_id,shift_date,shift_name,tenant_id,plant_id' },
    );
  }

  /**
   * Molienda promedio del turno ACTUAL — HTTP externo + cache 5 min
   */
  async getMolienda() {
    const current = getCurrentShift();
    const cached = await this.getCached('molienda_promedio', current);
    if (cached) return { ...cached, _cached: true };

    const url = this.config.get<string>('MOLIENDA_HTTP_URL');
    if (!url) {
      return { error: 'MOLIENDA_HTTP_URL no configurado', fallback: null };
    }
    try {
      const auth = this.config.get<string>('MOLIENDA_HTTP_AUTH');
      const res = await axios.get(url, {
        headers: auth ? { Authorization: auth } : undefined,
        timeout: 10_000,
      });
      await this.setCached('molienda_promedio', current, res.data, 'current');
      return res.data;
    } catch (err) {
      this.logger.error('HTTP molienda failed', err as Error);
      return { error: 'HTTP molienda upstream failed', fallback: null };
    }
  }

  /**
   * Gas turno previo — MSSQL CORONA
   * Query placeholder. Ajustar tabla/columnas reales una vez confirmadas.
   */
  async getGasPrevio() {
    const prev = getPreviousShift();
    const cached = await this.getCached('gas_previo', prev);
    if (cached) return { ...cached, _cached: true };

    if (!this.mssql.isAvailable()) {
      return { error: 'MSSQL no disponible', fallback: null };
    }

    try {
      // TODO: ajustar tabla + columnas exactas cuando humano confirme
      const rows = await this.mssql.query<{ total_m3: number; samples: number; promedio: number }>(
        `SELECT
           SUM(CAST(valor AS FLOAT)) AS total_m3,
           AVG(CAST(valor AS FLOAT)) AS promedio,
           COUNT(*) AS samples
         FROM pr_ezi_laboratorio_gral
         WHERE codigoproceso = @codigo
           AND fecha_hora BETWEEN @start AND @end`,
        {
          codigo: 'Gas',
          start: prev.start,
          end: prev.end,
        },
      );
      const row = rows[0] ?? { total_m3: 0, samples: 0, promedio: 0 };
      const horas_turno = 8;
      const payload = {
        promedio_m3_h: row.promedio,
        total_m3: row.total_m3,
        horas_turno,
        samples: row.samples,
        shift: prev.name,
        shift_date: shiftDateKey(prev),
      };
      await this.setCached('gas_previo', prev, payload, 'previous');
      return payload;
    } catch (err) {
      this.logger.error('Gas previo MSSQL failed', err as Error);
      return { error: 'MSSQL query failed', fallback: null };
    }
  }

  /**
   * Paradas turno previo — MSSQL CORONA
   */
  async getParadasPrevio() {
    const prev = getPreviousShift();
    const cached = await this.getCached('paradas_previo', prev);
    if (cached) return { ...cached, _cached: true };

    if (!this.mssql.isAvailable()) {
      return { error: 'MSSQL no disponible', fallback: null };
    }

    try {
      // TODO: ajustar tabla + columnas exactas
      const rows = await this.mssql.query<{
        motivo: string;
        cantidad: number;
        minutos: number;
      }>(
        `SELECT
           motivo,
           COUNT(*) AS cantidad,
           SUM(DATEDIFF(MINUTE, fecha_inicio, fecha_fin)) AS minutos
         FROM pr_ezi_laboratorio_gral
         WHERE codigoproceso LIKE 'Paradas%'
           AND fecha_hora BETWEEN @start AND @end
         GROUP BY motivo`,
        {
          start: prev.start,
          end: prev.end,
        },
      );
      const total = rows.reduce((acc, r) => acc + Number(r.cantidad ?? 0), 0);
      const tiempo_neto_horas = rows.reduce((acc, r) => acc + Number(r.minutos ?? 0), 0) / 60;
      const payload = {
        total,
        motivos: rows,
        tiempo_neto_horas,
        shift: prev.name,
        shift_date: shiftDateKey(prev),
      };
      await this.setCached('paradas_previo', prev, payload, 'previous');
      return payload;
    } catch (err) {
      this.logger.error('Paradas previo MSSQL failed', err as Error);
      return { error: 'MSSQL query failed', fallback: null };
    }
  }

  async getMillSpeedPrevio() {
    const prev = getPreviousShift();
    const cached = await this.getCached('vel_primer_molino', prev);
    if (cached) return { ...cached, _cached: true };
    return { error: 'No hay datos cacheados — esperando webhook del cierre de turno', fallback: null };
  }
}
