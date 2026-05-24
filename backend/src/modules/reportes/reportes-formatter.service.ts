import { Injectable } from '@nestjs/common';
import type { ReporteCompleto, ReportePayload } from './reportes.types';

/**
 * Formatea reporte en mensaje Telegram parse_mode=Markdown (legacy).
 * Estilo plano sin negritas, alineado por columnas con espacios.
 * Escape de caracteres especiales Markdown (_ * [ `) en contenido dinámico.
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
      parse_mode: 'Markdown',
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
    const fechaCorta = this.fmtFechaCorta(r.ventana.fecha_industrial);
    const fechaCortaSinAnio = fechaCorta.slice(0, 5);
    const turnoCap = this.capitalize(r.ventana.turno);

    const L: string[] = [];
    L.push(`🏭 INGENIO CLOUD`);
    L.push(`Reporte Turno ${this.esc(turnoCap)}`);
    L.push(`📅 ${fechaCorta} · ${horaInicio} → ${horaFin}`);
    L.push(`━━━━━━━━━━━━━━━━━━`);
    L.push('');

    L.push(`📊 PRODUCCIÓN`);
    L.push(this.colKv('🌱 Molienda', this.fmtNum(r.produccion.molienda_t, 1, 't')));
    L.push(this.colKv('🔥 Gas',      this.fmtNum(r.produccion.gas_m3, 0, 'm³')));
    L.push(this.colKv('🍬 Bolsas',   this.fmtNum(r.produccion.bolsas, 0, '')));
    L.push('');

    L.push(`⚙️ EFICIENCIAS`);
    if (r.eficiencias.gas_por_t != null) {
      const ok = r.eficiencias.gas_por_t < 12;
      L.push(`${ok ? '✅' : '⚠️'} Gas/Molienda  ${this.fmtNum(r.eficiencias.gas_por_t, 2, 'm³/t')}  (obj <12)`);
    }
    if (r.eficiencias.ritmo_t_h != null) {
      const ok = r.eficiencias.ritmo_t_h >= r.eficiencias.ritmo_objetivo_t_h;
      L.push(`${ok ? '✅' : '⚠️'} Ritmo         ${this.fmtNum(r.eficiencias.ritmo_t_h, 1, 't/h')}   (obj ${r.eficiencias.ritmo_objetivo_t_h})`);
    }
    L.push('');

    const calLines: string[] = [];
    if (r.calidad.color_icumsa != null) calLines.push(`ICUMSA           ${this.fmtNum(r.calidad.color_icumsa, 0, 'UI')}`);
    if (r.calidad.bagazo_humedad != null) calLines.push(`Bagazo humedad  ${this.fmtNum(r.calidad.bagazo_humedad, 1, '%')}`);
    if (r.calidad.bagazo_pol != null) calLines.push(`Bagazo Pol      ${this.fmtNum(r.calidad.bagazo_pol, 2, '%')}`);
    if (r.calidad.cachaza_pol != null) calLines.push(`Cachaza Pol     ${this.fmtNum(r.calidad.cachaza_pol, 2, '%')}`);
    if (calLines.length > 0) {
      L.push(`💧 CALIDAD`);
      calLines.forEach((l) => L.push(l));
      L.push('');
    }

    if (r.paradas.count === 0) {
      L.push(`✅ PARADAS · sin paradas registradas`);
    } else {
      const m = r.paradas.minutos_total;
      const hs = Math.floor(m / 60);
      const mins = m % 60;
      const durTxt = hs > 0 ? `${hs}h ${mins}m` : `${mins}m`;
      L.push(`⏸ PARADAS · ${r.paradas.count} eventos · ${m} min (${durTxt})`);
      L.push('');
      r.paradas.detalle.forEach((p) => {
        const rango = p.hasta ? `${p.desde}–${p.hasta}` : `${p.desde}–abierta`;
        const dur = p.minutos != null ? ` · ${p.minutos} min` : '';
        L.push(`🔧 ${rango}${dur}`);
        L.push(`   ${this.esc(p.motivo)}`);
        if (p.maquina || p.origen) {
          const tail = [p.maquina, p.origen].filter(Boolean).join(' · ');
          L.push(`   └ ${this.esc(tail)}`);
        }
        L.push('');
      });
    }

    L.push(`🚨 ALERTAS`);
    if (r.alertas.length === 0) {
      L.push(`- Todo dentro de rango`);
    } else {
      r.alertas.forEach((a) => L.push(`- ${this.esc(a.replace(/-/g, '−'))}`));
    }
    L.push('');

    L.push(`━━━━━━━━━━━━━━━━━━`);
    L.push(`🤖 Ingenio Cloud · ${fechaCortaSinAnio} ${horaFin}`);

    return L.join('\n');
  }

  private colKv(label: string, value: string): string {
    const padded = label.padEnd(14, ' ');
    return `${padded} ${value}`;
  }

  /** Escape caracteres especiales Markdown legacy: _ * [ ` */
  private esc(s: string): string {
    return s.replace(/([_*[`])/g, '\\$1');
  }

  private fmtNum(v: number | null, decimals: number, unit: string): string {
    if (v == null) return '—';
    const n = v.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return unit ? `${n} ${unit}` : n;
  }

  /** dd/mm/yyyy */
  private fmtFechaCorta(d: string): string {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
}
