import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  TurnoNombre,
  TurnoVentana,
  ReporteCompleto,
  ProduccionTurno,
  ParadaItem,
  CompletitudCheck,
} from './reportes.types';

/**
 * Calcula ventanas de turno (05-13 MAÑANA, 13-21 TARDE, 21-05 NOCHE).
 * Trae datos hxh desde production.fn_hxh_rango (RPC parametrizable) y agrega por turno.
 * Verifica completitud estricta: solo datos reales (no estimados).
 */
@Injectable()
export class ReportesDataService {
  private readonly logger = new Logger(ReportesDataService.name);
  private readonly RITMO_OBJETIVO_T_H = 220;
  private readonly TZ_OFFSET = '-03:00';

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Calcula la ventana del turno que acaba de cerrar dado un timestamp "ahora".
   * Si ahora=13:30 → cerró MAÑANA del día de hoy.
   * Si ahora=21:30 → cerró TARDE de hoy.
   * Si ahora=05:30 → cerró NOCHE (inicio ayer 21:00, fin hoy 05:00).
   */
  ventanaTurnoCerrado(ahoraISO?: string): TurnoVentana {
    const ahora = ahoraISO ? new Date(ahoraISO) : new Date();
    const ahoraLocal = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const h = ahoraLocal.getHours();
    const hoy = this.fmtDate(ahoraLocal);
    const ayer = this.fmtDate(new Date(ahoraLocal.getTime() - 24 * 3600_000));

    let turno: TurnoNombre;
    let inicio: string;
    let fin: string;
    let fechaIndustrial: string;

    if (h >= 5 && h < 13) {
      // NOCHE cerrada (ayer 21 → hoy 05)
      turno = 'NOCHE';
      inicio = `${ayer}T21:00:00${this.TZ_OFFSET}`;
      fin = `${hoy}T05:00:00${this.TZ_OFFSET}`;
      fechaIndustrial = ayer;
    } else if (h >= 13 && h < 21) {
      // MAÑANA cerrada (hoy 05 → hoy 13)
      turno = 'MAÑANA';
      inicio = `${hoy}T05:00:00${this.TZ_OFFSET}`;
      fin = `${hoy}T13:00:00${this.TZ_OFFSET}`;
      fechaIndustrial = hoy;
    } else {
      // TARDE cerrada (hoy 13 → hoy 21)
      turno = 'TARDE';
      inicio = `${hoy}T13:00:00${this.TZ_OFFSET}`;
      fin = `${hoy}T21:00:00${this.TZ_OFFSET}`;
      fechaIndustrial = hoy;
    }

    return { turno, fecha_industrial: fechaIndustrial, inicio, fin };
  }

  ventanaAnterior(actual: TurnoVentana): TurnoVentana {
    const finPrev = new Date(actual.inicio);
    const inicioPrev = new Date(finPrev.getTime() - 8 * 3600_000);
    const turnos: TurnoNombre[] = ['MAÑANA', 'TARDE', 'NOCHE'];
    const idx = turnos.indexOf(actual.turno);
    const turnoPrev = turnos[(idx - 1 + 3) % 3];
    return {
      turno: turnoPrev,
      fecha_industrial: this.fmtDate(inicioPrev),
      inicio: inicioPrev.toISOString().replace('Z', this.TZ_OFFSET),
      fin: finPrev.toISOString().replace('Z', this.TZ_OFFSET),
    };
  }

  /**
   * Verifica que TODAS las horas del turno tengan dato real (no estimado).
   * Falla si: hora faltante OR molienda_es_estimado OR gas_es_estimado.
   */
  async checkCompletitud(ventana: TurnoVentana): Promise<CompletitudCheck> {
    const filas = await this.fetchHxH(ventana);
    const horasTotales = 8; // turno = 8 horas
    const molFalta = filas.filter((f) => f.molienda_kg == null || f.molienda_es_estimado).length;
    const gasFalta = filas.filter((f) => f.gas_consumo == null || f.gas_es_estimado).length;
    const horasFalta = Math.max(0, horasTotales - filas.length);
    const completo = horasFalta === 0 && molFalta === 0 && gasFalta === 0;
    return {
      completo,
      horas_totales: filas.length,
      molienda_faltante: molFalta + horasFalta,
      gas_faltante: gasFalta + horasFalta,
      detalle: completo
        ? `OK 8/8 horas reales`
        : `horas=${filas.length}/8 molienda_faltante=${molFalta + horasFalta} gas_faltante=${gasFalta + horasFalta}`,
    };
  }

  /**
   * Trae datos hxh del turno y los agrega en un ReporteCompleto.
   */
  async armarReporte(ventana: TurnoVentana): Promise<ReporteCompleto> {
    const [actual, anterior, paradas] = await Promise.all([
      this.fetchHxH(ventana),
      this.fetchHxH(this.ventanaAnterior(ventana)),
      this.fetchParadas(ventana),
    ]);

    const produccion = this.agregarProduccion(actual);
    const produccionAnterior = this.agregarProduccion(anterior);
    const calidad = this.agregarCalidad(actual);
    const horasReales = actual.length || 1;
    const ritmo = produccion.molienda_t != null ? produccion.molienda_t / horasReales : null;
    const gasPorT =
      produccion.gas_m3 != null && produccion.molienda_t && produccion.molienda_t > 0
        ? produccion.gas_m3 / produccion.molienda_t
        : null;

    const comparacion = {
      molienda_delta_pct: this.pctDelta(produccion.molienda_t, produccionAnterior.molienda_t),
      gas_delta_pct: this.pctDelta(produccion.gas_m3, produccionAnterior.gas_m3),
      bolsas_delta_pct: this.pctDelta(produccion.bolsas, produccionAnterior.bolsas),
    };

    const eficiencias = {
      gas_por_t: gasPorT,
      ritmo_t_h: ritmo,
      ritmo_objetivo_t_h: this.RITMO_OBJETIVO_T_H,
    };

    const alertas = this.calcularAlertas(eficiencias, calidad);

    return {
      ventana,
      produccion,
      produccion_anterior: produccionAnterior,
      comparacion,
      eficiencias,
      calidad,
      paradas,
      alertas,
    };
  }

  // ───────── helpers ─────────

  private async fetchHxH(ventana: TurnoVentana): Promise<HxHRow[]> {
    const prod = this.supabase.schema('production');
    const { data, error } = await prod.rpc('fn_hxh_rango', {
      p_inicio: ventana.inicio,
      p_fin: ventana.fin,
    });

    if (error) {
      this.logger.warn(`fetchHxH rpc fail: ${error.message}`);
      return [];
    }
    return (data ?? []) as unknown as HxHRow[];
  }

  private async fetchParadas(ventana: TurnoVentana) {
    const lg = this.supabase.schema('legacy');
    const fechaInicio = ventana.inicio.slice(0, 10);
    const fechaFin = ventana.fin.slice(0, 10);
    const { data, error } = await lg
      .from('lab_general')
      .select('fecha_industrial, desde_hora, hasta_hora, motivo, maquina, origen_descripcion')
      .eq('proceso_codigo', 'Paradas')
      .not('motivo', 'is', null)
      .not('desde_hora', 'is', null)
      .gte('fecha_industrial', fechaInicio)
      .lte('fecha_industrial', fechaFin);

    if (error) {
      this.logger.warn(`fetchParadas fail: ${error.message}`);
      return { count: 0, minutos_total: 0, detalle: [] };
    }

    const items: ParadaItem[] = (data ?? [])
      .map((r) => this.armarParadaItem(r as ParadaRaw, ventana))
      .filter((p): p is ParadaItem => p !== null);

    const minutosTotal = items.reduce((acc, p) => acc + (p.minutos ?? 0), 0);
    return { count: items.length, minutos_total: minutosTotal, detalle: items };
  }

  private armarParadaItem(r: ParadaRaw, ventana: TurnoVentana): ParadaItem | null {
    if (!r.desde_hora) return null;
    const fechaBase = String(r.fecha_industrial).slice(0, 10);
    // Si desde_hora < 07:00 pertenece a la madrugada siguiente (día industrial 07-07)
    const desdeDate = this.combinarFechaHora(fechaBase, r.desde_hora, true);
    if (desdeDate < new Date(ventana.inicio) || desdeDate >= new Date(ventana.fin)) return null;

    const hastaDate = r.hasta_hora ? this.combinarFechaHora(fechaBase, r.hasta_hora, true, r.desde_hora) : null;
    const minutos =
      hastaDate && desdeDate ? Math.round((hastaDate.getTime() - desdeDate.getTime()) / 60_000) : null;

    return {
      motivo: r.motivo ?? '',
      maquina: r.maquina,
      origen: r.origen_descripcion,
      desde: r.desde_hora.slice(0, 5),
      hasta: r.hasta_hora ? r.hasta_hora.slice(0, 5) : null,
      minutos,
    };
  }

  private combinarFechaHora(fecha: string, hora: string, ajustarMadrugada: boolean, desdeHora?: string): Date {
    const [h] = hora.split(':').map(Number);
    const desdeH = desdeHora ? Number(desdeHora.split(':')[0]) : null;
    let fechaFinal = fecha;
    if (ajustarMadrugada && h < 7) {
      const d = new Date(`${fecha}T00:00:00${this.TZ_OFFSET}`);
      d.setDate(d.getDate() + 1);
      fechaFinal = this.fmtDate(d);
    }
    // Si hasta_hora < desde_hora y desde estaba en mismo día → hasta cruzó medianoche
    if (desdeH != null && h < desdeH && !ajustarMadrugada) {
      const d = new Date(`${fecha}T00:00:00${this.TZ_OFFSET}`);
      d.setDate(d.getDate() + 1);
      fechaFinal = this.fmtDate(d);
    }
    return new Date(`${fechaFinal}T${hora}${this.TZ_OFFSET}`);
  }

  private agregarProduccion(rows: HxHRow[]): ProduccionTurno {
    if (rows.length === 0) {
      return { molienda_t: null, gas_m3: null, bolsas: null, alcohol_gl_prom: null };
    }
    const sumNotNull = (vals: (number | null)[]) =>
      vals.filter((v): v is number => v != null).reduce((a, b) => a + b, 0);
    const avgNotNull = (vals: (number | null)[]) => {
      const arr = vals.filter((v): v is number => v != null);
      return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    };
    const moliendaKg = sumNotNull(rows.map((r) => r.molienda_kg));
    return {
      molienda_t: moliendaKg > 0 ? +(moliendaKg / 1000).toFixed(1) : null,
      gas_m3: rows.some((r) => r.gas_consumo != null) ? Math.round(sumNotNull(rows.map((r) => r.gas_consumo))) : null,
      bolsas: rows.some((r) => r.bolsas_azucar != null) ? Math.round(sumNotNull(rows.map((r) => r.bolsas_azucar))) : null,
      alcohol_gl_prom: avgNotNull(rows.map((r) => r.alcohol_gl)),
    };
  }

  private agregarCalidad(rows: HxHRow[]) {
    const avg = (vals: (number | null)[]) => {
      const arr = vals.filter((v): v is number => v != null);
      return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    };
    return {
      color_icumsa: this.round1(avg(rows.map((r) => r.color_azucar))),
      humedad_azucar: null, // no está en la vista hxh aún
      bagazo_humedad: this.round1(avg(rows.map((r) => r.bagazo_humedad))),
      bagazo_pol: this.round1(avg(rows.map((r) => r.bagazo_pol))),
      cachaza_pol: this.round1(avg(rows.map((r) => r.cachaza_pol))),
    };
  }

  private calcularAlertas(ef: { ritmo_t_h: number | null; ritmo_objetivo_t_h: number; gas_por_t: number | null }, cal: { color_icumsa: number | null; bagazo_pol: number | null }): string[] {
    const out: string[] = [];
    if (ef.ritmo_t_h != null && ef.ritmo_t_h < ef.ritmo_objetivo_t_h * 0.9) {
      out.push(`Ritmo molienda ${ef.ritmo_t_h.toFixed(1)} t/h bajo objetivo (${ef.ritmo_objetivo_t_h})`);
    }
    if (ef.gas_por_t != null && ef.gas_por_t > 13) {
      out.push(`Consumo gas ${ef.gas_por_t.toFixed(2)} m³/t alto (obj <12)`);
    }
    if (cal.color_icumsa != null && cal.color_icumsa > 200) {
      out.push(`ICUMSA ${cal.color_icumsa.toFixed(0)} UI sobre objetivo (200)`);
    }
    if (cal.bagazo_pol != null && cal.bagazo_pol > 2.5) {
      out.push(`Bagazo Pol ${cal.bagazo_pol.toFixed(2)}% alto (obj <2.5)`);
    }
    return out;
  }

  private pctDelta(actual: number | null, anterior: number | null): number | null {
    if (actual == null || anterior == null || anterior === 0) return null;
    return +(((actual - anterior) / anterior) * 100).toFixed(1);
  }

  private round1(v: number | null): number | null {
    return v == null ? null : +v.toFixed(2);
  }

  private fmtDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

interface HxHRow {
  ts_cierre: string;
  molienda_kg: number | null;
  molienda_es_estimado: boolean;
  gas_consumo: number | null;
  gas_es_estimado: boolean;
  bolsas_azucar: number | null;
  bagazo_humedad: number | null;
  bagazo_pol: number | null;
  cachaza_pol: number | null;
  color_azucar: number | null;
  alcohol_gl: number | null;
}

interface ParadaRaw {
  fecha_industrial: string;
  desde_hora: string | null;
  hasta_hora: string | null;
  motivo: string | null;
  maquina: string | null;
  origen_descripcion: string | null;
}
