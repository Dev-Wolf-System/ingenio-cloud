import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';
import type { CanaAgg } from './comparativa';
import { rangoPeriodo, type Periodo } from '../alerts/analisis/periodo';
import { reliabilidad } from '../alerts/analisis/aggregate';
import type { ParadaRow } from '../alerts/analisis/analisis.types';

// Cache entrada para paradasAnalisis
interface ParadasCacheEntry {
  insight: { resumen: string; patrones: string[]; recomendaciones: string[] } | null;
  categorias: Record<string, string>;
  expiraAt: number;
}

// Heurística origen → categoría (fallback cuando la IA no clasifica)
const ORIGEN_CATEGORIA: Record<string, string> = {
  'Trapiche': 'Trapiche',
  'Calderas': 'Caldera',
  'Caldera': 'Caldera',
  'Eléctrica': 'Eléctrica',
  'Electrica': 'Eléctrica',
  'Instrumentación': 'Instrumentación',
  'Instrumentacion': 'Instrumentación',
  'Proceso': 'Proceso',
  'Externa': 'Externa',
  'Programada': 'Programada',
};

function mapByOrigen(origen: string | null | undefined): string {
  if (!origen) return 'Otros';
  for (const [key, cat] of Object.entries(ORIGEN_CATEGORIA)) {
    if (origen.toLowerCase().includes(key.toLowerCase())) return cat;
  }
  return 'Otros';
}

@Injectable()
export class MoliendaCloudService {
  private readonly logger = new Logger(MoliendaCloudService.name);
  private readonly paradasCache = new Map<string, ParadasCacheEntry>();
  constructor(private readonly supabase: SupabaseService, private readonly ai: AiService) {}

  async canchon() {
    const { data, error } = await this.supabase.schema('production').from('v_canchon_resumen').select('*');
    if (error) { this.logger.warn(`canchon: ${error.message}`); return { stale: true, data: null }; }
    return { data: (data ?? [])[0] ?? null };
  }

  async balanzaHora() {
    const { data, error } = await this.supabase.schema('production').from('v_descarga_balanza_hora').select('*');
    if (error) { this.logger.warn(`balanzaHora: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  async movimientosTipo() {
    const { data, error } = await this.supabase.schema('legacy').from('movimientos')
      .select('tipo_pesada, peso_neto, neto_cana, salida_at')
      .gte('salida_at', new Date(Date.now() - 24 * 3600_000).toISOString());
    if (error) { this.logger.warn(`movimientosTipo: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  async moliendaBloques() {
    const { data, error } = await this.supabase.schema('production').from('v_molienda_bloques').select('*');
    if (error) { this.logger.warn(`moliendaBloques: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  async comparativaCana() {
    // Lógica de períodos en la vista production.v_mc_comparativa_cana (espeja el dashboard):
    //   molienda = de v_molienda_bloques (mismos números que el dashboard: día corriente/anterior/zafra)
    //   tonelaje caña (bruta/neta/trash) = legacy.movimientos (live, zafra completa), día por salida_at -8h
    //   calidad ponderada = muestras_lab; zafra desde production.zafras.fecha_inicio
    const { data, error } = await this.supabase.schema('production').from('v_mc_comparativa_cana')
      .select('periodo, molienda_kg, cana_bruta_kg, cana_neta_kg, trash_kg, trash_pond, rto_pond, brix_pond, pol_pond, pureza_pond, n');
    if (error) { this.logger.warn(`comparativaCana: ${error.message}`); return { stale: true, actual: null, ult_cierre: null, acumulado: null }; }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const num = (v: unknown): number => (v == null ? 0 : Number(v));
    const numN = (v: unknown): number | null => (v == null ? null : Number(v));
    const pick = (p: string): CanaAgg | null => {
      const r = rows.find((x) => x.periodo === p);
      if (!r) return null;
      return {
        molienda_kg: num(r.molienda_kg),
        cana_bruta_kg: num(r.cana_bruta_kg),
        cana_neta_kg: num(r.cana_neta_kg),
        trash_kg: num(r.trash_kg),
        trash_pond: numN(r.trash_pond),
        rto_pond: numN(r.rto_pond),
        brix_pond: numN(r.brix_pond),
        pol_pond: numN(r.pol_pond),
        pureza_pond: numN(r.pureza_pond),
        n: num(r.n),
      };
    };

    return { actual: pick('actual'), ult_cierre: pick('ult_cierre'), acumulado: pick('acumulado') };
  }

  async movimientosCana(limit = 100) {
    // Lee de v_mc_movimientos_cana = legacy.movimientos (LIVE, trae la última pesada real,
    // ej. 493053) LEFT JOIN lab para calidad. NO se filtra al día corriente porque el lab
    // rezaga ~1 día: las pesadas de hoy aún no tienen brix/pol. Mostrando las últimas por
    // numero_pesada desc, arriba quedan las más nuevas (calidad pendiente) y debajo las ya
    // analizadas con brix/pol/pureza/rendimiento.
    const { data, error } = await this.supabase.schema('production').from('v_mc_movimientos_cana')
      .select('numero_pesada, grupo, razon_social, numero_analisis, peso_neto, trash, brix, pol, pureza, rendimiento, neto_cana, variedad, tipo_cana, salida_at, codigo_finca')
      .order('numero_pesada', { ascending: false })
      .limit(limit);
    if (error) { this.logger.warn(`movimientosCana: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  async azucar(offset = 0) {
    // fecha_industrial se almacena como timestamptz = medianoche ART (03:00 UTC).
    // Calculamos el día industrial en ART (corte 07:00) y restamos offset días.
    const n = new Date(); // container TZ = ART
    const diaInd = new Date(n);
    if (n.getHours() < 7) diaInd.setDate(diaInd.getDate() - 1);
    diaInd.setDate(diaInd.getDate() - offset);

    const yyyy = diaInd.getFullYear();
    const mm = String(diaInd.getMonth() + 1).padStart(2, '0');
    const dd = String(diaInd.getDate()).padStart(2, '0');
    // Medianoche ART = 03:00 UTC
    const targetTs = `${yyyy}-${mm}-${dd}T03:00:00.000Z`;
    const fechaLabel = `${dd}/${mm}/${yyyy}`;

    const { data, error } = await this.supabase.schema('production').from('v_mc_especiales')
      .select('proceso_codigo, fecha_industrial, hora_lectura, color_icumsa, turbidez, humedad, cenizas, sediment_test, so2_ppm, granulometria_20, granulometria_30, calidad, silo, destino')
      .eq('fecha_industrial', targetTs)
      .order('hora_lectura', { ascending: true })
      .limit(2000);

    if (error) { this.logger.warn(`azucar: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [], fecha: fechaLabel };
  }

  async paradasAnalisis(periodo: Periodo, offset = 0) {
    // Zafra: arrancar desde production.zafras.fecha_inicio del año en curso (no 1-ene),
    // así el selector "Zafra" sólo cuenta paradas de la zafra vigente (ej. 2026 desde 18-may).
    let zafraInicio: Date | undefined;
    if (periodo === 'zafra') {
      const anio = new Date().getFullYear();
      const { data: zf } = await this.supabase.schema('production').from('zafras')
        .select('fecha_inicio').eq('anio', anio).limit(1);
      const fi = (zf ?? [])[0]?.fecha_inicio as string | undefined;
      if (fi) zafraInicio = new Date(fi);
    }
    const rango = rangoPeriodo(periodo, new Date(), zafraInicio, offset);
    const spanMin = (rango.hasta.getTime() - rango.desde.getTime()) / 60_000;

    let paradas: ParadaRow[] = [];
    try {
      const { data, error } = await this.supabase.sb.rpc('fn_paradas_turno', {
        ts_inicio: rango.desde.toISOString(),
        ts_fin: rango.hasta.toISOString(),
      });
      if (!error && Array.isArray(data)) {
        paradas = (
          data as Array<{
            fecha_industrial: string;
            desde_hora: string;
            hasta_hora: string;
            motivo: string;
            maquina: string | null;
            origen_descripcion: string | null;
          }>
        ).map((p) => {
          const dia = String(p.fecha_industrial).slice(0, 10);
          const mkTs = (hhmm: string) => {
            const hh = parseInt(hhmm.slice(0, 2), 10);
            const d = new Date(`${dia}T${hhmm}-03:00`);
            // Día industrial abre/cierra 07:00, igual que inicioDiaIndustrial en
            // rangoPeriodo: horas < 07 pertenecen al día calendario siguiente.
            if (hh < 7) d.setDate(d.getDate() + 1);
            return d.toISOString();
          };
          const inicio = mkTs(p.desde_hora);
          const fin = p.hasta_hora ? mkTs(p.hasta_hora) : null;
          const minutos = fin
            ? Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60_000)
            : null;
          return { inicio, fin, minutos, motivo: p.motivo, maquina: p.maquina, origen: p.origen_descripcion, alertas_relacionadas: [] };
        });
      }
    } catch (err) {
      this.logger.warn(`paradasAnalisis fetch fail: ${(err as Error).message}`);
    }

    // fn_paradas_turno filtra grueso por fecha_industrial (±1 día); recortar a la ventana
    // exacta del período. Criterio: la parada PERTENECE al turno/día en que INICIÓ
    // (inicio dentro de [desde, hasta)) — evita que paradas de turnos vecinos se cuelen.
    const desdeMs = rango.desde.getTime();
    const hastaMs = rango.hasta.getTime();
    paradas = paradas.filter((p) => {
      const ini = new Date(p.inicio).getTime();
      return ini >= desdeMs && ini < hastaMs;
    });

    const reliab = reliabilidad([], paradas, spanMin);

    const porAreaMap = new Map<string, { n: number; minutos_total: number }>();
    const porMotivoMap = new Map<string, { n: number; minutos_total: number }>();
    const porDiaMap = new Map<string, { n: number; minutos: number }>();

    for (const p of paradas) {
      const area = p.origen ?? 'Sin área';
      const ea = porAreaMap.get(area) ?? { n: 0, minutos_total: 0 };
      ea.n++; ea.minutos_total += p.minutos ?? 0;
      porAreaMap.set(area, ea);

      const em = porMotivoMap.get(p.motivo) ?? { n: 0, minutos_total: 0 };
      em.n++; em.minutos_total += p.minutos ?? 0;
      porMotivoMap.set(p.motivo, em);

      const dia = p.inicio.slice(0, 10);
      const ed = porDiaMap.get(dia) ?? { n: 0, minutos: 0 };
      ed.n++; ed.minutos += p.minutos ?? 0;
      porDiaMap.set(dia, ed);
    }

    const por_area = Array.from(porAreaMap.entries())
      .map(([area, v]) => ({ area, n: v.n, minutos_total: v.minutos_total }))
      .sort((a, b) => b.minutos_total - a.minutos_total);

    const por_motivo = Array.from(porMotivoMap.entries())
      .map(([motivo, v]) => ({ motivo, n: v.n, minutos_total: v.minutos_total }))
      .sort((a, b) => b.minutos_total - a.minutos_total)
      .slice(0, 10);

    const series_dia = Array.from(porDiaMap.entries())
      .map(([dia, v]) => ({ dia, n: v.n, minutos: v.minutos }))
      .sort((a, b) => a.dia.localeCompare(b.dia));

    // ── Impacto en molienda ────────────────────────────────────────────────
    let impacto: { prom_t_h: number; toneladas_no_molidas: number } | null = null;
    try {
      const bloques = await this.moliendaBloques();
      const filasBloque = (bloques.data as Array<{ molienda_kg?: number | null; bloque?: string | null }>)
        .filter((f) => f.bloque === 'dia_corriente' && f.molienda_kg != null);
      if (filasBloque.length > 0) {
        const promKgH = filasBloque.reduce((s, f) => s + (f.molienda_kg ?? 0), 0) / filasBloque.length;
        const promTH = Math.round((promKgH / 1000) * 10) / 10;
        const downtime = reliab.downtime_total_min;
        const toneladas_no_molidas = Math.round((downtime / 60) * promTH);
        impacto = { prom_t_h: promTH, toneladas_no_molidas };
      }
    } catch (err) {
      this.logger.warn(`paradasAnalisis impacto: ${(err as Error).message}`);
    }

    // ── Insight IA (con cache 60 min) ─────────────────────────────────────
    const cacheKey = `${periodo}:${offset}`;
    const now = Date.now();
    const cached = this.paradasCache.get(cacheKey);
    let insight: { resumen: string; patrones: string[]; recomendaciones: string[]; cached?: boolean } | null = null;
    let categorias: Record<string, string> = {};

    if (cached && now < cached.expiraAt) {
      insight = cached.insight ? { ...cached.insight, cached: true } : null;
      categorias = cached.categorias;
    } else if (paradas.length > 0 && this.ai.isAvailable()) {
      const motivos = [...new Set(paradas.map((p) => p.motivo).filter(Boolean))];
      const aiResult = await this.ai.analizarParadas({
        etiqueta: rango.etiqueta,
        reliabilidad: {
          paradas_n: reliab.paradas_n,
          downtime_total_min: reliab.downtime_total_min,
          mtbf_min: reliab.mtbf_min,
          mttr_min: reliab.mttr_min,
        },
        por_area,
        por_motivo,
        motivos,
      });
      if (aiResult) {
        const { categorias: cats, ...rest } = aiResult;
        insight = { ...rest, cached: false };
        categorias = cats;
      }
      this.paradasCache.set(cacheKey, {
        insight: aiResult ? { resumen: aiResult.resumen, patrones: aiResult.patrones, recomendaciones: aiResult.recomendaciones } : null,
        categorias,
        expiraAt: now + 60 * 60_000,
      });
    }

    // ── Por categoría ─────────────────────────────────────────────────────
    const porCategoriaMap = new Map<string, { n: number; minutos_total: number }>();
    for (const p of paradas) {
      const cat = categorias[p.motivo] ?? mapByOrigen(p.origen);
      const ec = porCategoriaMap.get(cat) ?? { n: 0, minutos_total: 0 };
      ec.n++; ec.minutos_total += p.minutos ?? 0;
      porCategoriaMap.set(cat, ec);
    }
    const por_categoria = Array.from(porCategoriaMap.entries())
      .map(([categoria, v]) => ({ categoria, n: v.n, minutos_total: v.minutos_total }))
      .sort((a, b) => b.minutos_total - a.minutos_total);

    return {
      periodo,
      rango: { desde: rango.desde.toISOString(), hasta: rango.hasta.toISOString(), etiqueta: rango.etiqueta },
      reliabilidad: reliab,
      paradas,
      por_area,
      por_motivo,
      por_categoria,
      series_dia,
      impacto,
      insight,
    };
  }

  async lab(procesos: string[], periodo: 'dia' | 'zafra' = 'dia', offset = 0) {
    const nn = new Date(); // container TZ = ART
    // Día industrial corta a las 07:00 ART
    const diaInd = new Date(nn);
    if (nn.getHours() < 7) diaInd.setDate(diaInd.getDate() - 1);
    const cols = 'proceso_codigo, fecha_industrial, hora_lectura, kilos, brix_manual, brix_automatico, pol_manual, pol_automatico, pureza, ph_manual, temperatura_manual';

    // fecha_industrial = medianoche ART = T03:00:00.000Z en UTC.
    // Siempre usar timestamps exactos para evitar el bug de PostgREST UTC vs ART.
    const artToTs = (ymd: string) => `${ymd}T03:00:00.000Z`;
    const nnYmd = `${diaInd.getFullYear()}-${String(diaInd.getMonth() + 1).padStart(2, '0')}-${String(diaInd.getDate()).padStart(2, '0')}`;

    // ── Zafra: todo el rango de la zafra vigente (production.zafras.fecha_inicio → hoy) ──
    if (periodo === 'zafra') {
      const anio = diaInd.getFullYear();
      const { data: zf } = await this.supabase.schema('production').from('zafras')
        .select('fecha_inicio').eq('anio', anio).limit(1);
      const fi = (zf ?? [])[0]?.fecha_inicio as string | undefined;
      const desdeYmd = fi ? fi.slice(0, 10) : `${anio}-01-01`;
      let q = this.supabase.schema('production').from('v_mc_lab_general').select(cols)
        .gte('fecha_industrial', artToTs(desdeYmd)).lte('fecha_industrial', artToTs(nnYmd))
        .order('hora_lectura', { ascending: true });
      if (procesos.length) q = q.in('proceso_codigo', procesos);
      const { data, error } = await q.limit(8000);
      if (error) { this.logger.warn(`lab zafra: ${error.message}`); return { stale: true, data: [] }; }
      return { data: data ?? [] };
    }

    // ── Día: el día más reciente con datos (<= hoy) menos `offset` días ──
    // (el lab rezaga el cierre → "día actual" = último día con datos; offset retrocede)
    let fq = this.supabase.schema('production').from('v_mc_lab_general')
      .select('fecha_industrial').lte('fecha_industrial', artToTs(nnYmd))
      .order('fecha_industrial', { ascending: false }).limit(1);
    if (procesos.length) fq = fq.in('proceso_codigo', procesos);
    const { data: fd, error: fe } = await fq;
    if (fe) { this.logger.warn(`lab (fecha): ${fe.message}`); return { stale: true, data: [] }; }
    const maxFecha = (fd ?? [])[0]?.fecha_industrial as string | undefined;
    if (!maxFecha) return { data: [] };

    // Restar offset días sobre UTC (maxFecha ya es T03:00:00.000Z → getUTCDate seguro)
    const target = new Date(maxFecha);
    target.setUTCDate(target.getUTCDate() - offset);
    const ty = target.getUTCFullYear();
    const tm = String(target.getUTCMonth() + 1).padStart(2, '0');
    const td = String(target.getUTCDate()).padStart(2, '0');
    const targetTs = artToTs(`${ty}-${tm}-${td}`);
    const fechaLabel = `${td}/${tm}/${ty}`;

    let q = this.supabase.schema('production').from('v_mc_lab_general').select(cols)
      .eq('fecha_industrial', targetTs)
      .order('hora_lectura', { ascending: true });
    if (procesos.length) q = q.in('proceso_codigo', procesos);
    const { data, error } = await q.limit(2000);
    if (error) { this.logger.warn(`lab: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [], fecha: fechaLabel };
  }
}
