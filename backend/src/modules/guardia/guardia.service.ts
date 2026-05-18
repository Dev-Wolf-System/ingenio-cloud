import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';
import { getCurrentShift, getPreviousShift, shiftDateKey, type Shift } from '../../common/shift';

export interface ResumenGuardia {
  turno_anterior: string;
  desde: string;
  hasta: string;
  timestamp_consulta?: string;
  paradasFabrica: Record<string, unknown>;
  moliendaPromedio: Record<string, unknown>;
  consumoGas: Record<string, unknown>;
}

@Injectable()
export class GuardiaService {
  private readonly logger = new Logger(GuardiaService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly ai: AiService,
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
    ttlMinutes = 60,
  ) {
    const industrial = this.supabase.schema('industrial');
    const validUntil = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
    await industrial.from('shift_kpis_cache').upsert(
      [
        {
          kpi_id: kpiId,
          shift_date: shiftDateKey(shift),
          shift_name: shift.name,
          shift_ref: 'previous',
          payload: payload as never,
          fetched_at: new Date().toISOString(),
          valid_until: validUntil,
        },
      ],
      { onConflict: 'kpi_id,shift_date,shift_name,tenant_id,plant_id' },
    );
  }

  /**
   * Consulta Node-RED endpoint guardia anterior.
   * Cache server-side 30min para no martillar.
   */
  private async fetchResumenFromNodeRed(force = false): Promise<ResumenGuardia | null> {
    const prev = getPreviousShift();
    if (!force) {
      const cached = await this.getCached('resumen_guardia', prev);
      if (cached) return cached as ResumenGuardia;
    }

    const url = this.config.get<string>('NODERED_GUARDIA_URL');
    if (!url) {
      this.logger.warn('NODERED_GUARDIA_URL no configurado');
      return null;
    }
    try {
      const auth = this.config.get<string>('NODERED_AUTH');
      const res = await axios.post<ResumenGuardia>(
        url,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            ...(auth ? { Authorization: auth } : {}),
          },
          timeout: 15_000,
        },
      );
      const data = res.data;
      if (!data || !data.turno_anterior) {
        this.logger.warn('Node-RED guardia respuesta inválida', data as never);
        return null;
      }
      // Cache 30min (next refresh manual o cambio turno)
      await this.setCached('resumen_guardia', prev, data, 30);
      await this.setCached('gas_previo', prev, data.consumoGas, 30);
      await this.setCached('paradas_previo', prev, data.paradasFabrica, 30);
      await this.setCached('molienda_previo', prev, data.moliendaPromedio, 30);
      this.logger.log(`Resumen guardia fetched from Node-RED (turno ${data.turno_anterior})`);

      // Análisis IA fire-and-forget (no bloquea respuesta)
      this.runAnalisisIA(prev, data).catch((err) =>
        this.logger.warn('Análisis IA falló: ' + (err as Error).message),
      );

      return data;
    } catch (err) {
      this.logger.error('Fetch guardia Node-RED failed', err as Error);
      return null;
    }
  }

  /** Molienda promedio TURNO ACTUAL — HTTP externo + cache 5min */
  async getMolienda() {
    const current = getCurrentShift();
    const cached = await this.getCached('molienda_promedio', current);
    if (cached) return cached;
    const url = this.config.get<string>('MOLIENDA_HTTP_URL');
    if (!url) return { mensaje: 'Endpoint molienda actual no configurado' };
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

  /** Gas turno previo — desde resumen Node-RED */
  async getGasPrevio() {
    const resumen = await this.fetchResumenFromNodeRed();
    if (!resumen) return { mensaje: 'Sin datos del turno anterior' };
    return resumen.consumoGas;
  }

  async getParadasPrevio() {
    const resumen = await this.fetchResumenFromNodeRed();
    if (!resumen) return { mensaje: 'Sin datos del turno anterior' };
    return resumen.paradasFabrica;
  }

  async getMoliendaPrevio() {
    const resumen = await this.fetchResumenFromNodeRed();
    if (!resumen) return { mensaje: 'Sin datos del turno anterior' };
    return resumen.moliendaPromedio;
  }

  /** Resumen completo turno previo (objeto completo desde Node-RED) */
  async getResumenGuardia(force = false) {
    const resumen = await this.fetchResumenFromNodeRed(force);
    if (!resumen) return { mensaje: 'Sin datos del turno anterior' };
    return resumen;
  }

  /** Análisis IA del resumen — corre fire-and-forget post-fetch */
  private async runAnalisisIA(shift: Shift, payload: ResumenGuardia) {
    if (!this.ai.isAvailable()) {
      this.logger.warn('IA no disponible (OPENAI_API_KEY missing o cliente no iniciado)');
      return;
    }
    this.logger.log(`Iniciando análisis IA para turno ${shift.name} ${shift.start.toISOString().slice(0,10)}`);
    try {
      const result = await this.ai.analizarResumenGuardia(payload);
      if (!result) {
        this.logger.warn('Análisis IA devolvió null (parsing JSON failed o OpenAI sin respuesta)');
        return;
      }
      await this.setCached('analisis_ia', shift, result, 60 * 12);
      this.logger.log(`Análisis IA cacheado OK turno ${shift.name} ${shift.start.toISOString().slice(0,10)}`);
    } catch (err) {
      this.logger.error('Análisis IA exception: ' + (err as Error).message);
    }
  }

  /** Análisis IA cacheado del turno previo */
  async getAnalisisIA() {
    const prev = getPreviousShift();
    const cached = await this.getCached('analisis_ia', prev);
    if (!cached) {
      return {
        mensaje: 'Análisis IA aún no disponible',
        ia_available: this.ai.isAvailable(),
      };
    }
    return cached;
  }

  /** Disparar análisis IA manual ahora (await sincrónico) */
  async forceAnalisisIA() {
    if (!this.ai.isAvailable()) {
      return { ok: false, error: 'OPENAI_API_KEY no configurada o cliente IA no iniciado' };
    }
    const resumen = await this.fetchResumenFromNodeRed(true);
    if (!resumen) return { ok: false, error: 'Sin datos turno previo desde Node-RED' };
    const prev = getPreviousShift();
    this.logger.log(`forceAnalisisIA: iniciando para turno ${prev.name}`);
    try {
      const result = await this.ai.analizarResumenGuardia(resumen);
      if (!result) {
        return { ok: false, error: 'OpenAI devolvió respuesta vacía o JSON inválido' };
      }
      await this.setCached('analisis_ia', prev, result, 60 * 12);
      this.logger.log(`forceAnalisisIA: cacheado OK turno ${prev.name}`);
      return { ok: true, ...result };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`forceAnalisisIA exception: ${msg}`);
      return { ok: false, error: `Error OpenAI: ${msg}` };
    }
  }

  /** Vel molino — siempre cache (llega por WS de Node-RED) */
  async getMillSpeedPrevio() {
    const prev = getPreviousShift();
    const cached = await this.getCached('vel_primer_molino', prev);
    if (!cached) return { mensaje: 'Sin datos del turno anterior' };
    return cached;
  }
}
