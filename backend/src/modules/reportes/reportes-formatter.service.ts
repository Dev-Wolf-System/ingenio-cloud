import { Injectable } from '@nestjs/common';
import type { ReporteCompleto, ReportePayload } from './reportes.types';

/**
 * Formatea reporte completo en mensaje Telegram (parse_mode=HTML)
 * y arma el payload final del webhook.
 *
 * Telegram HTML soporta: <b> <i> <u> <s> <code> <pre> <a href="">
 * NO soporta tablas ni listas. Usa saltos de línea + emojis.
 * Límite mensaje: 4096 chars.
 */
@Injectable()
export class ReportesFormatterService {
  build(reporte: ReporteCompleto): ReportePayload {
    const mensaje = this.armarMensaje(reporte);
    return {
      tipo: 'reporte_turno',
      turno: reporte.ventana.turno,
      fecha_industrial: reporte.ventana.fecha_industrial,
      turno_inicio: reporte.ventana.inicio,
      turno_fin: reporte.ventana.fin,
      datos_completos: true,
      parse_mode: 'HTML',
      mensaje_telegram: mensaje,
      datos: {
        produccion: reporte.produccion,
        comparacion: reporte.comparacion,
        eficiencias: reporte.eficiencias,
        calidad: reporte.calidad,
        paradas: reporte.paradas,
        alertas: reporte.alertas,
      },
    };
  }

  private armarMensaje(r: ReporteCompleto): string {
    const horaInicio = r.ventana.inicio.slice(11, 16);
    const horaFin = r.ventana.fin.slice(11, 16);
    const fechaFmt = this.fmtFecha(r.ventana.fecha_industrial);

    const L: string[] = [];
    L.push(`🏭 <b>INGENIO CLOUD · REPORTE TURNO ${this.esc(r.ventana.turno)}</b>`);
    L.push(`📅 ${this.esc(fechaFmt)} · ${horaInicio} → ${horaFin}`);
    L.push('');
    L.push(`━━━ <b>PRODUCCIÓN</b> ━━━`);
    L.push(`🌱 Molienda: <b>${this.fmtNum(r.produccion.molienda_t, 1, 't')}</b>${this.fmtDelta(r.comparacion.molienda_delta_pct)}`);
    L.push(`🔥 Gas: <b>${this.fmtNum(r.produccion.gas_m3, 0, 'm³')}</b>${this.fmtDelta(r.comparacion.gas_delta_pct)}`);
    L.push(`🍬 Bolsas: <b>${this.fmtNum(r.produccion.bolsas, 0, '')}</b>${this.fmtDelta(r.comparacion.bolsas_delta_pct)}`);
    if (r.produccion.alcohol_gl_prom != null) {
      L.push(`🧉 Alcohol prom: ${r.produccion.alcohol_gl_prom.toFixed(1)} °GL`);
    }
    L.push('');
    L.push(`━━━ <b>EFICIENCIAS</b> ━━━`);
    if (r.eficiencias.gas_por_t != null) {
      const ok = r.eficiencias.gas_por_t < 12;
      L.push(`⚡ Gas/Molienda: ${r.eficiencias.gas_por_t.toFixed(2)} m³/t · obj &lt;12 ${ok ? '✅' : '⚠'}`);
    }
    if (r.eficiencias.ritmo_t_h != null) {
      const ok = r.eficiencias.ritmo_t_h >= r.eficiencias.ritmo_objetivo_t_h;
      L.push(`⚙️ Ritmo: ${r.eficiencias.ritmo_t_h.toFixed(1)} t/h · obj ${r.eficiencias.ritmo_objetivo_t_h} ${ok ? '✅' : '⚠'}`);
    }
    L.push('');
    L.push(`━━━ <b>CALIDAD</b> ━━━`);
    if (r.calidad.color_icumsa != null) L.push(`🎨 ICUMSA: ${r.calidad.color_icumsa.toFixed(0)} UI ${r.calidad.color_icumsa < 200 ? '✅' : '⚠'}`);
    if (r.calidad.bagazo_humedad != null) L.push(`💧 Bagazo Hum: ${r.calidad.bagazo_humedad.toFixed(1)}%`);
    if (r.calidad.bagazo_pol != null) L.push(`🌾 Bagazo Pol: ${r.calidad.bagazo_pol.toFixed(2)}% ${r.calidad.bagazo_pol < 2.5 ? '✅' : '⚠'}`);
    L.push('');
    L.push(`━━━ <b>PARADAS</b> ━━━`);
    if (r.paradas.count === 0) {
      L.push(`✅ Sin paradas registradas`);
    } else {
      L.push(`<b>${r.paradas.count} eventos · ${r.paradas.minutos_total} min</b>`);
      r.paradas.detalle.slice(0, 5).forEach((p) => {
        const rango = p.hasta ? `${p.desde}-${p.hasta}` : `${p.desde}-abierta`;
        const maquina = p.maquina ? ` <i>(${this.esc(p.maquina)})</i>` : '';
        L.push(`• <code>${rango}</code> ${this.esc(p.motivo)}${maquina}`);
      });
      if (r.paradas.detalle.length > 5) L.push(`… +${r.paradas.detalle.length - 5} más`);
    }
    L.push('');
    L.push(`━━━ <b>ALERTAS</b> ━━━`);
    if (r.alertas.length === 0) {
      L.push(`✅ Todo dentro de rango`);
    } else {
      r.alertas.forEach((a) => L.push(`⚠ ${this.esc(a)}`));
    }
    L.push('');
    L.push(`━━━━━━━━━━━━━━━━━━`);
    L.push(`<i>🤖 Ingenio Cloud · ${this.esc(fechaFmt)} ${horaFin}</i>`);

    return L.join('\n');
  }

  /** Escape HTML para Telegram (solo &, <, > son reservados en parse_mode=HTML) */
  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private fmtNum(v: number | null, decimals: number, unit: string): string {
    if (v == null) return '—';
    const n = v.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return unit ? `${n} ${unit}` : n;
  }

  private fmtDelta(pct: number | null): string {
    if (pct == null) return '';
    const arrow = pct >= 0 ? '▲' : '▼';
    return ` (${arrow} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs ant.)`;
  }

  private fmtFecha(d: string): string {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const [y, m, day] = d.split('-');
    return `${parseInt(day)} ${meses[parseInt(m) - 1]} ${y}`;
  }
}
