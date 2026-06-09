import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';
import { InfluxAlcoholService } from '../influx/influx-alcohol.service';
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

export interface FincaAnalisRow { finca: string; camiones: number; ton_neta: number; rto: number; vs_avg: number }
export interface CañeroAnalisRow { cañero: string; camiones: number; ton_neta: number; rto: number }
export interface AnalisCanaResult {
  zafras: Array<{ anio: number; label: string }>;
  stats: { camiones: number; ton_neta: number; rto_avg: number; fincas_count: number } | null;
  por_finca: FincaAnalisRow[];
  por_cañero: CañeroAnalisRow[];
  insight: { resumen: string; alertas: string[]; recomendaciones: string[] } | null;
}
interface CanaCacheEntry { data: AnalisCanaResult; expiraAt: number }

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
  private readonly canaCache = new Map<number, CanaCacheEntry>();
  constructor(
    private readonly supabase: SupabaseService,
    private readonly ai: AiService,
    private readonly influxAlcohol: InfluxAlcoholService,
  ) {}

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

  async analisCana(zafraAnio: number): Promise<AnalisCanaResult> {
    const { data: zafrasData } = await this.supabase.schema('production').from('zafras')
      .select('anio, fecha_inicio, fecha_fin').order('anio', { ascending: false });

    const zafras = (zafrasData ?? []).map((z) => ({ anio: z.anio as number, label: `Zafra ${z.anio}` }));
    const zafraInfo = (zafrasData ?? []).find((z) => z.anio === zafraAnio);
    if (!zafraInfo) return { zafras, stats: null, por_finca: [], por_cañero: [], insight: null };

    const cached = this.canaCache.get(zafraAnio);
    if (cached && cached.expiraAt > Date.now()) return { ...cached.data, zafras };

    const desde = zafraInfo.fecha_inicio as string;
    const hasta = (zafraInfo.fecha_fin as string | null) ?? new Date().toISOString();

    const { data: agg, error } = await this.supabase.schema('production')
      .rpc('fn_analis_cana', { p_desde: desde, p_hasta: hasta });

    if (error) { this.logger.warn(`analisCana: ${error.message}`); return { zafras, stats: null, por_finca: [], por_cañero: [], insight: null }; }

    const raw = agg as { stats: { camiones: number; ton_neta: number; rto_avg: number; fincas_count: number }; por_finca: Array<{ finca: string; camiones: number; ton_neta: number; rto: number }>; por_cañero: CañeroAnalisRow[] } | null;
    if (!raw?.stats) return { zafras, stats: null, por_finca: [], por_cañero: [], insight: null };

    const { stats, por_cañero } = raw;
    const rto_avg = stats.rto_avg ?? 0;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const por_finca: FincaAnalisRow[] = (raw.por_finca ?? []).map((f) => ({
      ...f, vs_avg: round2((f.rto ?? 0) - rto_avg),
    }));

    const ttl = zafraInfo.fecha_fin ? 24 * 3600_000 : 2 * 60_000; // zafra activa: 2 min

    // Devolver datos inmediatamente sin esperar AI
    const result: AnalisCanaResult = { zafras, stats, por_finca, por_cañero, insight: null };
    this.canaCache.set(zafraAnio, { data: result, expiraAt: Date.now() + 15_000 }); // TTL corto: 15s para que la 2da llamada traiga AI

    // AI en background — actualiza cache cuando termina
    this.ai.analizarCana({ zafra: zafraAnio, stats, por_finca }).then((insight) => {
      if (insight) {
        const withInsight: AnalisCanaResult = { ...result, insight };
        this.canaCache.set(zafraAnio, { data: withInsight, expiraAt: Date.now() + ttl });
      }
    }).catch(() => {});

    return result;
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
          let fin = p.hasta_hora ? mkTs(p.hasta_hora) : null;
          // Si fin quedó antes que inicio (ej: hasta_hora=07:00 con hh===7 no suma +1 día),
          // la parada cruzó medianoche → sumar 1 día al fin. Mismo criterio que el SQL de la vista.
          if (fin && new Date(fin) <= new Date(inicio)) {
            const d = new Date(fin);
            d.setDate(d.getDate() + 1);
            fin = d.toISOString();
          }
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

    // Complementar con paradas_inferidas: fuente autoritativa para paradas multidía
    // que MSSQL solo registra como fragmento del último día (operador carga solo el tramo del día).
    // También incluye paradas abiertas no registradas aún en MSSQL.
    try {
      const { data: inferidas } = await this.supabase.schema('production')
        .from('paradas_inferidas')
        .select('id, inicio_sensor, fin')
        .or(`fin.is.null,fin.gte.${rango.desde.toISOString()}`);
      const nowMs = Date.now();
      for (const inf of (inferidas ?? []) as Array<{ id: number; inicio_sensor: string; fin: string | null }>) {
        const iniMs = new Date(inf.inicio_sensor).getTime();
        const finMs = inf.fin ? new Date(inf.fin).getTime() : nowMs;

        if (finMs <= desdeMs) continue;  // cerrada antes del período → skip
        if (iniMs >= hastaMs) continue;  // empieza después del período → skip

        // Parada multidía (empezó antes del período): las entradas MSSQL dentro de su rango
        // son solo el "fragmento del último día" → eliminarlas para evitar doble conteo.
        if (iniMs < desdeMs) {
          paradas = paradas.filter((p) => {
            const pIni = new Date(p.inicio).getTime();
            return pIni < desdeMs || pIni >= finMs;
          });
        }

        // Parada dentro del período (abierta o cerrada): skip si MSSQL ya la tiene (±15 min).
        // Evita duplicar cuando el operador cargó en MSSQL la misma parada que la inferida.
        if (iniMs >= desdeMs) {
          const yaEnMssql = paradas.some((p) => Math.abs(new Date(p.inicio).getTime() - iniMs) < 15 * 60_000);
          if (yaEnMssql) continue;
        }

        const minutos = Math.round((finMs - iniMs) / 60_000);
        paradas.push({
          inicio: inf.inicio_sensor,
          fin: inf.fin,
          minutos,
          motivo: inf.fin ? 'Parada sensor (cerrada)' : 'En curso (sensor)',
          maquina: null,
          origen: 'Trapiche',
          alertas_relacionadas: [],
        });
      }
    } catch (err) {
      this.logger.warn(`paradasAnalisis inferidas fail: ${(err as Error).message}`);
    }

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
    // Promedio zafra hasta el ÚLTIMO día con producción plena (>3000 t/día).
    // Excluye días de parada/startup al final de la serie para que el promedio
    // no se diluya si la fábrica lleva varios días detenida.
    let impacto: { prom_t_h: number; toneladas_no_molidas: number } | null = null;
    try {
      const bloques = await this.moliendaBloques();
      type BloqueRow = { molienda_kg?: number | string | null; bloque?: string | null; hora?: string | null };
      const toKg = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v));

      // Ordenar días de zafra por fecha asc
      const zafraOrdenada = (bloques.data as BloqueRow[])
        .filter((f) => f.bloque === 'zafra')
        .sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''));

      // Índice del último día con producción plena (>3000 t = fábrica funcionando bien)
      const PLENA_KG = 3_000_000;
      let lastPlenaIdx = -1;
      for (let i = 0; i < zafraOrdenada.length; i++) {
        if (toKg(zafraOrdenada[i].molienda_kg) >= PLENA_KG) lastPlenaIdx = i;
      }

      if (lastPlenaIdx >= 0) {
        // Usar solo días hasta lastPlenaIdx con >500 t (excluye días de startup/arranque parcial)
        const diasValidos = zafraOrdenada
          .slice(0, lastPlenaIdx + 1)
          .filter((f) => toKg(f.molienda_kg) > 500_000);
        if (diasValidos.length > 0) {
          const avgKgDia = diasValidos.reduce((s, f) => s + toKg(f.molienda_kg), 0) / diasValidos.length;
          const promTH = Math.round((avgKgDia / 1000 / 24) * 10) / 10;
          const toneladas_no_molidas = Math.round((reliab.downtime_total_min / 60) * promTH);
          impacto = { prom_t_h: promTH, toneladas_no_molidas };
        }
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

  async alcoholDia(offset = 0) {
    return this.influxAlcohol.alcoholDia(offset);
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
