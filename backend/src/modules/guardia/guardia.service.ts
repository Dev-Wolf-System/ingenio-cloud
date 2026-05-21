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

/** Shape de cada parada dentro de v_resumen_turno_previo.paradas_detalle */
export interface ParadaDetalle {
  desde: string;          // 'HH:MM'
  hasta: string;          // 'HH:MM' o 'abierta'
  rango?: string;         // 'HH:MM → HH:MM'
  estado?: string;        // 'abierta' | 'cerrada'
  motivo: string;
  origen?: string;        // 'Auxiliar de Molienda', etc.
  maquina?: string;       // 'Conductor Principal', etc.
  minutos_neto?: number | null;
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

  /**
   * Molienda promedio TURNO ACTUAL — desde Postgres (vista pública).
   * Cae a HTTP externo legacy solo si la vista no responde.
   */
  async getMolienda() {
    // 1. Intento via vista Postgres (rápido + sin dependencia HTTP externa)
    try {
      const pub = this.supabase.schema('public');
      const { data, error } = await pub
        .from('v_molienda_turno_actual')
        .select('turno, turno_inicio, turno_fin, promedio_t_h, total_kg')
        .maybeSingle();
      if (!error && data) {
        const row = data as { turno?: string; turno_inicio?: string; turno_fin?: string; promedio_t_h?: string | number | null; total_kg?: string | number | null };
        const toNum = (v: string | number | null | undefined): number | null => {
          if (v == null) return null;
          const n = typeof v === 'string' ? parseFloat(v) : v;
          return Number.isFinite(n) ? n : null;
        };
        return {
          turno: row.turno ?? null,
          turno_inicio: row.turno_inicio ?? null,
          turno_fin: row.turno_fin ?? null,
          promedio_t_h: toNum(row.promedio_t_h),
          total_kg: toNum(row.total_kg),
        };
      }
      this.logger.warn(`v_molienda_turno_actual fail: ${error?.message ?? 'no data'}`);
    } catch (err) {
      this.logger.warn(`v_molienda_turno_actual exception: ${(err as Error).message}`);
    }

    // 2. Fallback HTTP legacy (si está configurado)
    const current = getCurrentShift();
    const cached = await this.getCached('molienda_promedio', current);
    if (cached) return cached;
    const url = this.config.get<string>('MOLIENDA_HTTP_URL');
    if (!url) return { stale: true, mensaje: 'Sin vista ni endpoint molienda actual' };
    try {
      const auth = this.config.get<string>('MOLIENDA_HTTP_AUTH');
      const res = await axios.get(url, {
        headers: auth ? { Authorization: auth } : undefined,
        timeout: 10_000,
      });
      return res.data;
    } catch (err) {
      this.logger.error('HTTP molienda failed', err as Error);
      return { stale: true, error: 'HTTP molienda upstream failed' };
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

  /**
   * Resumen turno previo desde Postgres (vista v_resumen_turno_previo).
   * Reemplaza el viejo flujo Node-RED HTTP. Datos vienen de legacy.lab_general
   * filtrados según hora actual ART → determina automáticamente turno previo.
   */
  async getResumenTurnoPrevio() {
    try {
      const pub = this.supabase.schema('public');
      const { data, error } = await pub
        .from('v_resumen_turno_previo')
        .select('*')
        .maybeSingle();
      if (error) {
        this.logger.warn(`resumen-turno-previo fail: ${error.message}`);
        return { stale: true, error: error.message };
      }
      const row = data as {
        turno?: string;
        turno_inicio?: string;
        turno_fin?: string;
        molienda_avg_t_h?: string | number | null;
        gas_total_m3?: string | number | null;
        gas_avg_m3_h?: string | number | null;
        paradas_count?: string | number | null;
        paradas_minutos?: number | null;
        paradas_detalle?: ParadaDetalle[] | null;
      } | null;
      if (!row) return { stale: true };
      // Normalizar a number (PostgREST devuelve numeric/bigint como string)
      const toNum = (v: string | number | null | undefined): number | null => {
        if (v == null) return null;
        const n = typeof v === 'string' ? parseFloat(v) : v;
        return Number.isFinite(n) ? n : null;
      };
      return {
        turno: row.turno ?? null,
        turno_inicio: row.turno_inicio ?? null,
        turno_fin: row.turno_fin ?? null,
        molienda_avg_t_h: toNum(row.molienda_avg_t_h),
        gas_total_m3: toNum(row.gas_total_m3),
        gas_avg_m3_h: toNum(row.gas_avg_m3_h),
        paradas_count: toNum(row.paradas_count),
        paradas_minutos: row.paradas_minutos ?? 0,
        paradas_detalle: row.paradas_detalle ?? [],
      };
    } catch (err) {
      this.logger.warn(`resumen-turno-previo exception: ${(err as Error).message}`);
      return { stale: true, error: (err as Error).message };
    }
  }

  /** Molienda hora x hora del turno previo (production.v_turno_hora_x_hora) */
  async getMoliendaHoraPrevio() {
    try {
      const production = this.supabase.schema('production');
      const { data, error } = await production
        .from('v_turno_hora_x_hora')
        .select('turno, periodo, molienda_kg, ts_cierre')
        .eq('turno_rel', 'previo')
        .order('ts_cierre', { ascending: true });
      if (error) {
        this.logger.warn(`molienda-hora fail: ${error.message}`);
        return { stale: true, turno: null, puntos: [], stats: null };
      }
      const rows = (data ?? []) as Array<{
        turno: string;
        periodo: string;
        molienda_kg: number | null;
        ts_cierre: string;
      }>;

      const base = rows.map((r) => ({
        periodo: r.periodo,
        molienda_t: r.molienda_kg != null ? Number((r.molienda_kg / 1000).toFixed(2)) : null,
      }));

      // Media móvil 3 periodos (centrada) — solo sobre valores existentes
      const puntos = base.map((p, i) => {
        const window = [base[i - 1]?.molienda_t, base[i]?.molienda_t, base[i + 1]?.molienda_t]
          .filter((v): v is number => v != null);
        const media_movil =
          window.length > 0
            ? Number((window.reduce((a, b) => a + b, 0) / window.length).toFixed(2))
            : null;
        return { ...p, media_movil: p.molienda_t != null ? media_movil : null };
      });

      // Stats + identificar periodo pico/valle
      const conValor = puntos
        .map((p, i) => ({ i, periodo: p.periodo, v: p.molienda_t }))
        .filter((x): x is { i: number; periodo: string; v: number } => x.v != null);

      if (conValor.length === 0) {
        return {
          turno: rows[0]?.turno ?? null,
          stats: { promedio: 0, maximo: 0, minimo: 0, periodo_max: null, periodo_min: null },
          tendencia_pct: 0,
          puntos,
        };
      }

      const valores = conValor.map((x) => x.v);
      const promedio = Number((valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(2));
      const maximo = Math.max(...valores);
      const minimo = Math.min(...valores);
      const periodo_max = conValor.find((x) => x.v === maximo)?.periodo ?? null;
      const periodo_min = conValor.find((x) => x.v === minimo)?.periodo ?? null;

      // Tendencia: regresión lineal simple (least squares) sobre conValor
      const n = conValor.length;
      let tendencia_pct = 0;
      if (n >= 2) {
        const xs = conValor.map((_, idx) => idx);
        const ys = valores;
        const sx = xs.reduce((a, b) => a + b, 0);
        const sy = ys.reduce((a, b) => a + b, 0);
        const sxy = xs.reduce((acc, x, idx) => acc + x * ys[idx], 0);
        const sxx = xs.reduce((acc, x) => acc + x * x, 0);
        const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
        // % variación total estimada (slope × tramos) sobre el promedio
        tendencia_pct =
          promedio > 0 ? Number((((slope * (n - 1)) / promedio) * 100).toFixed(1)) : 0;
      }

      return {
        turno: rows[0]?.turno ?? null,
        stats: { promedio, maximo, minimo, periodo_max, periodo_min },
        tendencia_pct,
        puntos,
      };
    } catch (err) {
      this.logger.warn(`molienda-hora exception: ${(err as Error).message}`);
      return { stale: true, turno: null, puntos: [], stats: null };
    }
  }

  /** Detalle paradas — extraído de v_resumen_turno_previo.paradas_detalle */
  async getParadasDetalle(): Promise<ParadaDetalle[]> {
    const resumen = await this.getResumenTurnoPrevio();
    if ('stale' in resumen && resumen.stale) return [];
    return ('paradas_detalle' in resumen && resumen.paradas_detalle) || [];
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

  /** Disparar análisis IA manual ahora (consume v_resumen_turno_previo + paradas detalle) */
  async forceAnalisisIA() {
    if (!this.ai.isAvailable()) {
      return { ok: false, error: 'OPENAI_API_KEY no configurada o cliente IA no iniciado' };
    }

    // 1. Datos del turno previo desde Postgres (vista única con paradas_detalle jsonb)
    const resumen = await this.getResumenTurnoPrevio();
    if ('stale' in resumen && resumen.stale) {
      return { ok: false, error: 'Sin datos turno previo en v_resumen_turno_previo' };
    }
    const detallesParadas = ('paradas_detalle' in resumen && resumen.paradas_detalle) || [];
    const payloadIA = resumen;

    const prev = getPreviousShift();
    this.logger.log(
      `forceAnalisisIA: iniciando turno ${prev.name} · ${detallesParadas.length} paradas detalle`,
    );
    try {
      const result = await this.ai.analizarResumenGuardia(payloadIA);
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
