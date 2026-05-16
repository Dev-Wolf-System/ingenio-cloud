import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { getCurrentShift, getPreviousShift, shiftDateKey, type Shift } from '../../common/shift';

@Injectable()
export class GuardiaService {
  private readonly logger = new Logger(GuardiaService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private async getCached(kpiId: string, shift: Shift) {
    const industrial = this.supabase.schema('industrial');
    const { data } = await industrial
      .from('shift_kpis_cache')
      .select('payload, fetched_at')
      .eq('kpi_id', kpiId)
      .eq('shift_date', shiftDateKey(shift))
      .eq('shift_name', shift.name)
      .maybeSingle();
    return data?.payload ?? null;
  }

  /** Molienda promedio turno actual — HTTP externo + cache 5min */
  async getMolienda() {
    const current = getCurrentShift();
    const cached = await this.getCached('molienda_promedio', current);
    if (cached) return cached;
    const url = this.config.get<string>('MOLIENDA_HTTP_URL');
    if (!url) return { error: 'MOLIENDA_HTTP_URL no configurado' };
    try {
      const auth = this.config.get<string>('MOLIENDA_HTTP_AUTH');
      const res = await axios.get(url, {
        headers: auth ? { Authorization: auth } : undefined,
        timeout: 10_000,
      });
      return res.data;
    } catch (err) {
      this.logger.error('HTTP molienda failed', err as Error);
      return { error: 'HTTP molienda upstream failed' };
    }
  }

  /** Gas turno previo — desde cache (poblado por POST /api/guardia/ingest) */
  async getGasPrevio() {
    const prev = getPreviousShift();
    const cached = await this.getCached('gas_previo', prev);
    if (!cached) return { mensaje: 'Sin datos del turno anterior' };
    return cached;
  }

  /** Paradas turno previo — desde cache */
  async getParadasPrevio() {
    const prev = getPreviousShift();
    const cached = await this.getCached('paradas_previo', prev);
    if (!cached) return { mensaje: 'Sin datos del turno anterior' };
    return cached;
  }

  /** Molienda turno previo — desde cache */
  async getMoliendaPrevio() {
    const prev = getPreviousShift();
    const cached = await this.getCached('molienda_previo', prev);
    if (!cached) return { mensaje: 'Sin datos del turno anterior' };
    return cached;
  }

  /** Resumen completo turno previo */
  async getResumenGuardia() {
    const prev = getPreviousShift();
    const cached = await this.getCached('resumen_guardia', prev);
    if (!cached) return { mensaje: 'Sin datos del turno anterior' };
    return cached;
  }

  async getMillSpeedPrevio() {
    const prev = getPreviousShift();
    const cached = await this.getCached('vel_primer_molino', prev);
    if (!cached) return { mensaje: 'Sin datos del turno anterior' };
    return cached;
  }
}
