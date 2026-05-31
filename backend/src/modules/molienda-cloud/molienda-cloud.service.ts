import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { agregarCana, type CanaRow } from './comparativa';
import { rangoPeriodo, type Periodo } from '../alerts/analisis/periodo';
import { reliabilidad } from '../alerts/analisis/aggregate';
import type { ParadaRow } from '../alerts/analisis/analisis.types';

@Injectable()
export class MoliendaCloudService {
  private readonly logger = new Logger(MoliendaCloudService.name);
  constructor(private readonly supabase: SupabaseService) {}

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
    const { data, error } = await this.supabase.schema('legacy').from('muestras_lab')
      .select('peso_bruto, neto_cana, trash, pol, brix, pureza, rendimiento, fecha_industrial, nrocierre')
      .order('fecha_industrial', { ascending: false })
      .limit(5000);
    if (error) { this.logger.warn(`comparativaCana: ${error.message}`); return { stale: true, actual: null, ult_cierre: null, acumulado: null }; }

    const rows = (data ?? []) as Array<CanaRow & { fecha_industrial: string | null; nrocierre: number | null }>;
    if (!rows.length) return { actual: null, ult_cierre: null, acumulado: null };

    const maxFecha = rows.reduce((m, r) => (r.fecha_industrial && r.fecha_industrial > m ? r.fecha_industrial : m), '');
    const maxCierre = rows.reduce((m, r) => (r.nrocierre != null && r.nrocierre > m ? r.nrocierre : m), 0);

    const actual = agregarCana(rows.filter((r) => r.fecha_industrial === maxFecha));
    const ult_cierre = agregarCana(rows.filter((r) => r.nrocierre === maxCierre));
    const acumulado = agregarCana(rows);

    return { actual, ult_cierre, acumulado };
  }

  async movimientosCana(limit = 100) {
    const { data, error } = await this.supabase.schema('legacy').from('muestras_lab')
      .select('numero_pesada, grupo, razon_social, numero_analisis, peso_bruto, trash, brix, pol, neto_cana, variedad, salida_at')
      .order('numero_pesada', { ascending: false })
      .limit(limit);
    if (error) { this.logger.warn(`movimientosCana: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  async azucar(desde?: string, hasta?: string) {
    // Primero obtenemos la max fecha_industrial del día
    const { data: fechaData, error: fechaError } = await this.supabase.schema('legacy').from('especiales')
      .select('fecha_industrial')
      .order('fecha_industrial', { ascending: false })
      .limit(1);
    if (fechaError) { this.logger.warn(`azucar (fecha): ${fechaError.message}`); return { stale: true, data: [] }; }

    const maxFecha = (fechaData ?? [])[0]?.fecha_industrial ?? null;
    if (!maxFecha) return { data: [] };

    let q = this.supabase.schema('legacy').from('especiales')
      .select('proceso_codigo, fecha_industrial, hora_lectura, color_icumsa, turbidez, humedad, cenizas, sediment_test, so2_ppm, granulometria_20, granulometria_30, calidad, silo, destino')
      .eq('fecha_industrial', maxFecha)
      .order('hora_lectura', { ascending: true });
    if (desde) q = q.gte('hora_lectura', desde);
    if (hasta) q = q.lte('hora_lectura', hasta);

    const { data, error } = await q.limit(2000);
    if (error) { this.logger.warn(`azucar: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  async paradasAnalisis(periodo: Periodo, offset = 0) {
    const rango = rangoPeriodo(periodo, new Date(), undefined, offset);
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
            if (hh < 8) d.setDate(d.getDate() + 1);
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

    // fn_paradas_turno filtra grueso por fecha_industrial; recortar a ventana exacta.
    const desdeMs = rango.desde.getTime();
    const hastaMs = rango.hasta.getTime();
    paradas = paradas.filter((p) => {
      const ini = new Date(p.inicio).getTime();
      const fin = p.fin ? new Date(p.fin).getTime() : ini;
      return fin >= desdeMs && ini < hastaMs;
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

    return {
      periodo,
      rango: { desde: rango.desde.toISOString(), hasta: rango.hasta.toISOString(), etiqueta: rango.etiqueta },
      reliabilidad: reliab,
      paradas,
      por_area,
      por_motivo,
      series_dia,
    };
  }

  async lab(procesos: string[], desde?: string, hasta?: string) {
    let q = this.supabase.schema('legacy').from('lab_general')
      .select('proceso_codigo, fecha_industrial, hora_lectura, kilos, brix_manual, brix_automatico, pol_manual, pol_automatico, pureza')
      .order('hora_lectura', { ascending: true });
    if (procesos.length) q = q.in('proceso_codigo', procesos);
    if (desde) q = q.gte('hora_lectura', desde);
    if (hasta) q = q.lte('hora_lectura', hasta);
    const { data, error } = await q.limit(2000);
    if (error) { this.logger.warn(`lab: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }
}
