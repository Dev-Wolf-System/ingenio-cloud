import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
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
      // La vista devuelve `timestamp without time zone` (hora ART local).
      // PostgREST lo serializa sin offset → el frontend lo malinterpreta como UTC (-3h).
      // Si el string no trae zona, le agregamos el offset ART explícito.
      const tagART = (v: string | null | undefined): string | null => {
        if (!v) return null;
        const s = String(v).trim();
        if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return s; // ya tiene zona
        return s.replace(' ', 'T') + '-03:00';
      };
      return {
        turno: row.turno ?? null,
        turno_inicio: tagART(row.turno_inicio),
        turno_fin: tagART(row.turno_fin),
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

  /** Última hora de molienda del turno en curso (production.v_molienda_bloques) */
  async getMoliendaActualUltima() {
    try {
      const production = this.supabase.schema('production');
      const { data, error } = await production
        .from('v_molienda_bloques')
        .select('etiqueta, molienda_kg, acumulado_kg, hora')
        .eq('bloque', 'turno_actual')
        .order('hora', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        this.logger.warn(`molienda-actual fail: ${error.message}`);
        return { stale: true, molienda_kg: null, acumulado_kg: null, etiqueta: null };
      }
      const row = data as {
        etiqueta?: string;
        molienda_kg?: number | string | null;
        acumulado_kg?: number | string | null;
        hora?: string;
      } | null;
      const toNum = (v: number | string | null | undefined): number | null => {
        if (v == null) return null;
        const n = typeof v === 'string' ? parseFloat(v) : v;
        return Number.isFinite(n) ? n : null;
      };
      return {
        etiqueta: row?.etiqueta ?? null,
        hora: row?.hora ?? null,
        molienda_kg: toNum(row?.molienda_kg),
        acumulado_kg: toNum(row?.acumulado_kg),
      };
    } catch (err) {
      this.logger.warn(`molienda-actual exception: ${(err as Error).message}`);
      return { stale: true, molienda_kg: null, acumulado_kg: null, etiqueta: null };
    }
  }

  /** Construye serie de un bloque: puntos en t + acumulado + recta de tendencia + stats */
  private buildBloqueSerie(
    raw: Array<{ label: string; molienda_kg: number | null; acumulado_kg?: number | null }>,
  ) {
    const base = raw.map((r) => ({
      label: r.label,
      molienda_t: r.molienda_kg != null ? Number((r.molienda_kg / 1000).toFixed(2)) : null,
    }));
    // acumulado: usar provisto por la vista, o running sum si falta
    let run = 0;
    const conAcum = base.map((p, i) => {
      const provided = raw[i].acumulado_kg;
      let acumulado_t: number;
      if (provided != null) {
        acumulado_t = Number((provided / 1000).toFixed(2));
      } else {
        if (p.molienda_t != null) run += p.molienda_t;
        acumulado_t = Number(run.toFixed(2));
      }
      return { ...p, acumulado_t };
    });
    // regresión lineal sobre molienda_t usando el índice completo (recta continua)
    const idxVals = conAcum
      .map((p, i) => ({ i, v: p.molienda_t }))
      .filter((x): x is { i: number; v: number } => x.v != null);
    const vals = idxVals.map((x) => x.v);
    let slope = 0;
    let intercept = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    if (idxVals.length >= 2) {
      const n = idxVals.length;
      const xs = idxVals.map((x) => x.i);
      const sx = xs.reduce((a, b) => a + b, 0);
      const sy = vals.reduce((a, b) => a + b, 0);
      const sxy = xs.reduce((a, x, k) => a + x * vals[k], 0);
      const sxx = xs.reduce((a, x) => a + x * x, 0);
      slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
      intercept = (sy - slope * sx) / n;
    }
    const puntos = conAcum.map((p, i) => ({
      ...p,
      tendencia_t:
        idxVals.length >= 2 ? Number((intercept + slope * i).toFixed(2)) : null,
    }));
    const max_t = vals.length ? Math.max(...vals) : 0;
    const min_t = vals.length ? Math.min(...vals) : 0;
    const promedio_t = vals.length
      ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
      : 0;
    const acumulado_t = conAcum.length ? conAcum[conAcum.length - 1].acumulado_t : 0;
    const tendencia_pct =
      promedio_t > 0 && idxVals.length >= 2
        ? Number((((slope * (conAcum.length - 1)) / promedio_t) * 100).toFixed(1))
        : 0;
    return { puntos, stats: { acumulado_t, max_t, min_t, promedio_t, tendencia_pct } };
  }

  /** Estado de molienda por bloques: zafra, día/turno corriente y anterior */
  async getMoliendaBloques() {
    const num = (v: number | string | null | undefined): number | null => {
      if (v == null) return null;
      const n = typeof v === 'string' ? parseFloat(v) : v;
      return Number.isFinite(n) ? n : null;
    };
    const empty = { puntos: [], stats: { acumulado_t: 0, max_t: 0, min_t: 0, promedio_t: 0, tendencia_pct: 0 } };
    const out: Record<string, unknown> = {
      anio_zafra: null,
      zafra: empty,
      dia_corriente: empty,
      turno_actual: empty,
      dia_anterior: empty,
      turno_anterior: empty,
    };

    try {
      const production = this.supabase.schema('production');
      const { data, error } = await production
        .from('v_molienda_bloques')
        .select('bloque, hora, anio_zafra, etiqueta, molienda_kg, acumulado_kg')
        .order('hora', { ascending: true });
      if (error) {
        this.logger.warn(`molienda-bloques fail: ${error.message}`);
      } else {
        const rows = (data ?? []) as Array<{
          bloque: string;
          anio_zafra: number;
          etiqueta: string;
          molienda_kg: number | string | null;
          acumulado_kg: number | string | null;
        }>;
        out.anio_zafra = rows[0]?.anio_zafra ?? null;
        for (const b of ['zafra', 'dia_corriente', 'turno_actual', 'dia_anterior']) {
          const sub = rows.filter((r) => r.bloque === b);
          out[b] = this.buildBloqueSerie(
            sub.map((r) => ({
              label: r.etiqueta,
              molienda_kg: num(r.molienda_kg),
              acumulado_kg: num(r.acumulado_kg),
            })),
          );
        }
      }
    } catch (err) {
      this.logger.warn(`molienda-bloques exception: ${(err as Error).message}`);
    }

    // turno_anterior: v_turno_hora_x_hora (la vista de bloques no lo trae)
    try {
      const production = this.supabase.schema('production');
      const { data, error } = await production
        .from('v_turno_hora_x_hora')
        .select('periodo, molienda_kg, ts_cierre')
        .eq('turno_rel', 'previo')
        .order('ts_cierre', { ascending: true });
      if (!error) {
        const rows = (data ?? []) as Array<{ periodo: string; molienda_kg: number | string | null }>;
        out.turno_anterior = this.buildBloqueSerie(
          rows.map((r) => ({ label: r.periodo, molienda_kg: num(r.molienda_kg) })),
        );
      } else {
        this.logger.warn(`molienda-bloques turno_anterior fail: ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(`molienda-bloques turno_anterior exception: ${(err as Error).message}`);
    }

    return out;
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

  /** Huella de los datos que alimentan la IA — si no cambia, no se regenera */
  private fingerprintResumen(resumen: Record<string, unknown>): string {
    const rel = {
      turno: resumen['turno'] ?? null,
      molienda: resumen['molienda_avg_t_h'] ?? null,
      gas_total: resumen['gas_total_m3'] ?? null,
      gas_avg: resumen['gas_avg_m3_h'] ?? null,
      paradas_count: resumen['paradas_count'] ?? null,
      paradas_min: resumen['paradas_minutos'] ?? null,
      paradas: resumen['paradas_detalle'] ?? [],
    };
    return createHash('sha1').update(JSON.stringify(rel)).digest('hex');
  }

  /** Análisis IA cacheado del turno previo */
  async getAnalisisIA() {
    const prev = getPreviousShift();
    const cached = (await this.getCached('analisis_ia', prev)) as
      | (Record<string, unknown> & { _fingerprint?: string; _generated_at?: string })
      | null;
    if (!cached) {
      return {
        mensaje: 'Análisis IA aún no disponible',
        ia_available: this.ai.isAvailable(),
      };
    }
    const { _fingerprint, _generated_at, ...result } = cached;
    void _fingerprint;
    return { ...result, generated_at: _generated_at ?? null };
  }

  /**
   * Genera el análisis IA del turno previo.
   * Cachea por huella de datos: si la huella no cambió, devuelve el cache
   * sin llamar a OpenAI (evita quemar tokens). Usado por el cron y el botón.
   */
  async generarAnalisisIA(): Promise<{
    ok: boolean;
    regenerado?: boolean;
    cached?: boolean;
    error?: string;
    resumen?: string;
    estado?: 'normal' | 'atencion' | 'critico';
    puntos_clave?: string[];
  }> {
    if (!this.ai.isAvailable()) {
      return { ok: false, error: 'OPENAI_API_KEY no configurada o cliente IA no iniciado' };
    }

    const resumen = await this.getResumenTurnoPrevio();
    if ('stale' in resumen && resumen.stale) {
      return { ok: false, error: 'Sin datos turno previo en v_resumen_turno_previo' };
    }

    const prev = getPreviousShift();
    const fp = this.fingerprintResumen(resumen as Record<string, unknown>);
    const cached = (await this.getCached('analisis_ia', prev)) as
      | (Record<string, unknown> & { _fingerprint?: string })
      | null;

    if (cached && cached._fingerprint === fp) {
      this.logger.log(`generarAnalisisIA: datos sin cambios (fp=${fp.slice(0, 8)}), usa cache`);
      return {
        ok: true,
        regenerado: false,
        cached: true,
        resumen: cached.resumen as string,
        estado: cached.estado as 'normal' | 'atencion' | 'critico',
        puntos_clave: (cached.puntos_clave as string[]) ?? [],
      };
    }

    const detallesParadas = ('paradas_detalle' in resumen && resumen.paradas_detalle) || [];
    this.logger.log(
      `generarAnalisisIA: regenerando turno ${prev.name} · ${detallesParadas.length} paradas · fp=${fp.slice(0, 8)}`,
    );
    try {
      const result = await this.ai.analizarResumenGuardia(resumen);
      if (!result) {
        return { ok: false, error: 'OpenAI devolvió respuesta vacía o JSON inválido' };
      }
      await this.setCached(
        'analisis_ia',
        prev,
        { ...result, _fingerprint: fp, _generated_at: new Date().toISOString() },
        60 * 24,
      );
      this.logger.log(`generarAnalisisIA: cacheado OK turno ${prev.name}`);
      return { ok: true, regenerado: true, ...result };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`generarAnalisisIA exception: ${msg}`);
      return { ok: false, error: `Error OpenAI: ${msg}` };
    }
  }

  /** Disparar análisis IA manual (botón "Generar"). Respeta la huella de datos. */
  async forceAnalisisIA() {
    return this.generarAnalisisIA();
  }

  /** Vel molino — siempre cache (llega por WS de Node-RED) */
  async getMillSpeedPrevio() {
    const prev = getPreviousShift();
    const cached = await this.getCached('vel_primer_molino', prev);
    if (!cached) return { mensaje: 'Sin datos del turno anterior' };
    return cached;
  }

  /** Tabla molienda+producción hora×hora del turno actual */
  async getProduccionHora() {
    try {
      const production = this.supabase.schema('production');
      const { data, error } = await production
        .from('v_turno_hora_x_hora')
        .select(
          'turno, periodo, ts_cierre, molienda_kg, gas_consumo, gas_es_estimado, ' +
          'bagazo_humedad, color_azucar, cenizas_azucar',
        )
        .eq('turno_rel', 'actual')
        .order('ts_cierre', { ascending: true });

      if (error) {
        this.logger.warn(`produccion-hora fail: ${error.message}`);
        return { stale: true, filas: [], stats: null };
      }

      const rows = (data ?? []) as Array<{
        turno: string;
        periodo: string;
        ts_cierre: string;
        molienda_kg: number | null;
        gas_consumo: number | null;
        gas_es_estimado: boolean;
        bagazo_humedad: number | null;
        color_azucar: number | null;
        cenizas_azucar: number | null;
      }>;

      const toNum = (v: number | null) => (v != null && Number.isFinite(v) ? v : null);

      const filas = rows.map((r) => ({
        periodo: r.periodo,
        molienda_t: r.molienda_kg != null ? Number((r.molienda_kg / 1000).toFixed(2)) : null,
        gas_m3: toNum(r.gas_consumo),
        gas_estimado: r.gas_es_estimado ?? false,
        bagazo_humedad: toNum(r.bagazo_humedad),
        color_azucar: toNum(r.color_azucar),
        cenizas: toNum(r.cenizas_azucar),
      }));

      // Acumulados y promedios
      const conMol = filas.filter((f) => f.molienda_t != null).map((f) => f.molienda_t!);
      const conGas = filas.filter((f) => f.gas_m3 != null).map((f) => f.gas_m3!);
      const conHum = filas.filter((f) => f.bagazo_humedad != null).map((f) => f.bagazo_humedad!);
      const conColor = filas.filter((f) => f.color_azucar != null).map((f) => f.color_azucar!);
      const conCen = filas.filter((f) => f.cenizas != null).map((f) => f.cenizas!);

      const avg = (arr: number[]) =>
        arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : null;
      const sum = (arr: number[]) =>
        arr.length ? Number(arr.reduce((a, b) => a + b, 0).toFixed(2)) : null;

      const turno = rows[0]?.turno ?? null;

      return {
        turno,
        filas,
        stats: {
          molienda_acum_t: sum(conMol),
          gas_acum_m3: sum(conGas),
          bagazo_humedad_prom: avg(conHum),
          color_azucar_prom: avg(conColor),
          cenizas_prom: avg(conCen),
        },
      };
    } catch (err) {
      this.logger.warn(`produccion-hora exception: ${(err as Error).message}`);
      return { stale: true, filas: [], stats: null };
    }
  }
}
