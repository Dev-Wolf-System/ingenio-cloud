import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';
import { rangoPeriodo, Periodo } from './analisis/periodo';
import { computeKpis, sensoresStats, correlaciones, cruzarParadas } from './analisis/aggregate';
import type { AlertaRow, ParadaRow, AnalisisResponse, Insight } from './analisis/analisis.types';

const VENTANA_CORR_MIN = 15;
const PARADA_ANTES_MIN = 30;
const PARADA_DESPUES_MIN = 10;
const INSIGHT_TTL_MS = 60 * 60_000;

@Injectable()
export class AlertsAnalisisService {
  private readonly logger = new Logger(AlertsAnalisisService.name);
  private insightCache = new Map<string, { data: Insight; ts: number }>();

  constructor(private readonly supabase: SupabaseService, private readonly ai: AiService) {}

  async analisis(periodo: Periodo, refresh = false): Promise<AnalisisResponse> {
    const rango = rangoPeriodo(periodo);
    const alertsSchema = this.supabase.schema('alerts');

    const fetchAlerts = async (desde: Date, hasta: Date): Promise<AlertaRow[]> => {
      const { data, error } = await alertsSchema.from('active')
        .select('id, severity, area, source, title, detected_at, resolved_at')
        .gte('detected_at', desde.toISOString())
        .lt('detected_at', hasta.toISOString());
      if (error) { this.logger.warn(`analisis alerts fail: ${error.message}`); return []; }
      return (data ?? []) as AlertaRow[];
    };

    const alerts = await fetchAlerts(rango.desde, rango.hasta);

    let comparativa: AnalisisResponse['comparativa'] = null;
    if (rango.prevDesde && rango.prevHasta) {
      const prev = await fetchAlerts(rango.prevDesde, rango.prevHasta);
      const kp = computeKpis(prev);
      const delta = kp.total > 0 ? Number((((alerts.length - kp.total) / kp.total) * 100).toFixed(1)) : null;
      comparativa = { total_prev: kp.total, delta_pct: delta, por_severidad_prev: kp.por_severidad };
    }

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
          const minutos =
            fin
              ? Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60_000)
              : null;
          return {
            inicio,
            fin,
            minutos,
            motivo: p.motivo,
            maquina: p.maquina,
            origen: p.origen_descripcion,
            alertas_relacionadas: [],
          };
        });
      }
    } catch (err) {
      this.logger.warn(`analisis paradas fail: ${(err as Error).message}`);
    }
    paradas = cruzarParadas(alerts, paradas, PARADA_ANTES_MIN, PARADA_DESPUES_MIN);

    const turnoDe = (iso: string): 'Mañana' | 'Tarde' | 'Noche' => {
      const h = new Date(iso).getHours();
      return h >= 5 && h <= 12 ? 'Mañana' : h >= 13 && h <= 20 ? 'Tarde' : 'Noche';
    };
    const porTurnoMap = new Map<string, number>([['Mañana', 0], ['Tarde', 0], ['Noche', 0]]);
    const porDiaMap = new Map<string, { n: number; durs: number[] }>();
    const heatMap = new Map<string, number>();
    for (const a of alerts) {
      const tt = turnoDe(a.detected_at);
      porTurnoMap.set(tt, (porTurnoMap.get(tt) ?? 0) + 1);
      const d = new Date(a.detected_at);
      const diaKey = a.detected_at.slice(0, 10);
      if (!porDiaMap.has(diaKey)) porDiaMap.set(diaKey, { n: 0, durs: [] });
      const pd = porDiaMap.get(diaKey)!;
      pd.n++;
      if (a.resolved_at) pd.durs.push((new Date(a.resolved_at).getTime() - d.getTime()) / 60_000);
      const hk = `${d.getDay()}:${d.getHours()}`;
      heatMap.set(hk, (heatMap.get(hk) ?? 0) + 1);
    }
    const series = {
      por_turno: Array.from(porTurnoMap.entries()).map(([turno, n]) => ({
        turno: turno as 'Mañana' | 'Tarde' | 'Noche',
        n,
      })),
      por_dia: Array.from(porDiaMap.entries())
        .map(([dia, v]) => ({
          dia,
          n: v.n,
          duracion_media_min: v.durs.length
            ? Number((v.durs.reduce((a, b) => a + b, 0) / v.durs.length).toFixed(1))
            : 0,
        }))
        .sort((a, b) => a.dia.localeCompare(b.dia)),
      heatmap: Array.from(heatMap.entries()).map(([k, n]) => {
        const [dow, hora] = k.split(':').map(Number);
        return { dow, hora, n };
      }),
    };

    const kpis = computeKpis(alerts);
    const sensores = sensoresStats(alerts);
    const corr = correlaciones(alerts, VENTANA_CORR_MIN);

    let insight: Insight | null = null;
    const cacheKey = periodo;
    const cached = this.insightCache.get(cacheKey);
    if (!refresh && cached && Date.now() - cached.ts < INSIGHT_TTL_MS) {
      insight = { ...cached.data, cached: true };
    } else if (this.ai.isAvailable()) {
      const r = await this.ai.analizarPeriodoAlertas({
        periodo,
        etiqueta: rango.etiqueta,
        kpis,
        comparativa: comparativa
          ? { total_prev: comparativa.total_prev, delta_pct: comparativa.delta_pct }
          : null,
        sensores,
        correlaciones: corr,
        paradas: paradas.map((p) => ({
          motivo: p.motivo,
          minutos: p.minutos,
          alertas_relacionadas: p.alertas_relacionadas.length,
        })),
      });
      if (r) {
        insight = { ...r, cached: false, generado_at: new Date().toISOString() };
        this.insightCache.set(cacheKey, { data: insight, ts: Date.now() });
      }
    }

    return {
      periodo,
      rango: {
        desde: rango.desde.toISOString(),
        hasta: rango.hasta.toISOString(),
        etiqueta: rango.etiqueta,
      },
      kpis,
      comparativa,
      series,
      sensores,
      correlaciones: corr,
      paradas,
      insight,
    };
  }
}
