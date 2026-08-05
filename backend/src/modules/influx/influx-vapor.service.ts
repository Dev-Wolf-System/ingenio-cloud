import { Injectable, Logger } from '@nestjs/common';
import { InfluxQueryService } from './influx-query.service';

/**
 * Compensación de caudal por presión:
 *   Q_real = Q_medido * sqrt((P - P_ref_low) / (P_ref_high - P_ref_low))
 *
 * Constantes operativas Ingenio:
 *   P_REF_LOW = 2 bar   (presión de referencia inferior)
 *   P_REF_HIGH = 18 bar (presión de calibración del transmisor)
 */
const P_REF_LOW = 2;
const P_REF_HIGH = 18;
const P_REF_RANGE = P_REF_HIGH - P_REF_LOW; // 16

/** Caudales (variable Influx) y a qué presión están atados ('alta'|'baja') */
export const VAPOR_CAUDAL_DEFS = [
  { variable: 'vapor.vapor.vapor_auxilio_caudal',       label: 'Auxilio',        sector: 'Auxilio',     presion: 'baja' as const },
  { variable: 'vapor.vapor.vapor_preparacion_caudal',   label: 'Preparación',    sector: 'Preparación', presion: 'alta' as const },
  { variable: 'vapor.vapor.vapor_reducido_caudal',      label: 'Reducido',       sector: 'Reductora',   presion: 'baja' as const },
  { variable: 'vapor.vapor.vapor_termo_dest_caudal',    label: 'Termo Dest.',    sector: 'Destilería',  presion: 'baja' as const },
  { variable: 'vapor.vapor.vapor_trapiche_caudal',      label: 'Trapiche',       sector: 'Trapiche',    presion: 'baja' as const },
  { variable: 'vapor.vapor.vapor_usina_alta_caudal',    label: 'Usina Alta',     sector: 'Usina',       presion: 'alta' as const },
  { variable: 'vapor.vapor.vapor_usina_baja_caudal',    label: 'Usina Baja',     sector: 'Usina',       presion: 'alta' as const },
];

// Colector alta/baja: viven en "dashboard-general-energia" (medición de caldera),
// NO en "dashboard-vapor-caudales" (donde están los 7 caudales de consumo).
const VAR_PRESION_ALTA = 'caldera.Caldera.cald_vapor_alta_presion';
const VAR_PRESION_BAJA = 'caldera.Caldera.cald_vapor_baja_presion';
const VAR_PRODUCCION = [
  'caldera2.caldera2.cald2_vapor_caudal',
  'caldera3.caldera3.cald3_vapor_caudal',
  'caldera6.caldera6.cald6_vapor_caudal',
];

export interface VaporSectorActual {
  variable: string;
  label: string;
  sector: string;
  presion: 'alta' | 'baja';
  crudo_tnh: number;
  factor: number | null;
  compensado_tnh: number;
}

export interface VaporActualResult {
  total_tnh: number;
  presion_alta: number | null;
  presion_baja: number | null;
  factor_alta: number | null;
  factor_baja: number | null;
  por_caudal: VaporSectorActual[];
  produccion_tnh: number | null;
  diferencial_tnh: number | null;
  diferencial_pct: number | null;
  timestamp: string;
}

export interface VaporSerieRow {
  hora_utc: string;
  variable: string;
  m3h: number;
}

@Injectable()
export class InfluxVaporService {
  private readonly logger = new Logger(InfluxVaporService.name);

  constructor(private readonly influx: InfluxQueryService) {}

  /** Calcula factor compensación. Retorna null si presión inválida (<P_REF_LOW). */
  private factor(presion: number | null): number | null {
    if (presion == null || !Number.isFinite(presion)) return null;
    const num = presion - P_REF_LOW;
    if (num <= 0) return null;
    return Math.sqrt(num / P_REF_RANGE);
  }

  /** Consumo de vapor actual (últimos 60s avg) por sector + total compensado. */
  async fetchVaporActual(): Promise<VaporActualResult | null> {
    const caudalVars = VAPOR_CAUDAL_DEFS.map((d) => `'${d.variable}'`).join(',');
    const presionVars = `'${VAR_PRESION_ALTA}','${VAR_PRESION_BAJA}'`;

    // Caudales de los 7 consumidores y presiones de colector viven en tablas distintas.
    const sqlCaudales = `
      SELECT variable, AVG(value) AS valor
      FROM "dashboard-vapor-caudales"
      WHERE time >= now() - INTERVAL '10 seconds'
        AND variable IN (${caudalVars})
      GROUP BY variable
    `;
    const sqlPresiones = `
      SELECT variable, AVG(value) AS valor
      FROM "dashboard-general-energia"
      WHERE time >= now() - INTERVAL '10 seconds'
        AND variable IN (${presionVars})
      GROUP BY variable
    `;
    const [rowsCaudales, rowsPresiones] = await Promise.all([
      this.influx.query<{ variable: string; valor: number | null }>(sqlCaudales),
      this.influx.query<{ variable: string; valor: number | null }>(sqlPresiones),
    ]);
    const rows = [...rowsCaudales, ...rowsPresiones];
    if (!rows.length) return null;

    const valores = new Map<string, number>();
    for (const r of rows) {
      if (r.valor != null && Number.isFinite(Number(r.valor))) {
        valores.set(r.variable, Number(r.valor));
      }
    }

    const presionAlta = valores.get(VAR_PRESION_ALTA) ?? null;
    const presionBaja = valores.get(VAR_PRESION_BAJA) ?? null;
    const factorAlta = this.factor(presionAlta);
    const factorBaja = this.factor(presionBaja);

    const por_caudal: VaporSectorActual[] = VAPOR_CAUDAL_DEFS.map((def) => {
      const crudo = valores.get(def.variable) ?? 0;
      const crudoClamp = crudo > 0 ? crudo : 0;
      const factor = def.presion === 'alta' ? factorAlta : factorBaja;
      const compensado = factor != null ? crudoClamp * factor : 0;
      return {
        variable: def.variable,
        label: def.label,
        sector: def.sector,
        presion: def.presion,
        crudo_tnh: Number(crudo.toFixed(2)),
        factor: factor != null ? Number(factor.toFixed(4)) : null,
        compensado_tnh: Number(compensado.toFixed(2)),
      };
    });

    const total = por_caudal.reduce((a, r) => a + r.compensado_tnh, 0);

    // Producción calderas (sin compensación, ya está corregido por transmisor)
    const produccion = await this.fetchProduccionActual();

    const diferencial = produccion != null ? Number((produccion - total).toFixed(2)) : null;
    const diferencialPct =
      produccion != null && produccion > 0
        ? Number((((produccion - total) / produccion) * 100).toFixed(1))
        : null;

    return {
      total_tnh: Number(total.toFixed(2)),
      presion_alta: presionAlta != null ? Number(presionAlta.toFixed(2)) : null,
      presion_baja: presionBaja != null ? Number(presionBaja.toFixed(2)) : null,
      factor_alta: factorAlta != null ? Number(factorAlta.toFixed(4)) : null,
      factor_baja: factorBaja != null ? Number(factorBaja.toFixed(4)) : null,
      por_caudal,
      produccion_tnh: produccion,
      diferencial_tnh: diferencial,
      diferencial_pct: diferencialPct,
      timestamp: new Date().toISOString(),
    };
  }

  /** Producción de vapor de las calderas C2+C3+C6 (último minuto avg). */
  async fetchProduccionActual(): Promise<number | null> {
    const inList = VAR_PRODUCCION.map((v) => `'${v}'`).join(',');
    const sql = `
      SELECT variable, AVG(value) AS valor
      FROM "dashboard-general-energia"
      WHERE time >= now() - INTERVAL '10 seconds'
        AND variable IN (${inList})
      GROUP BY variable
    `;
    const rows = await this.influx.query<{ variable: string; valor: number | null }>(sql);
    if (!rows.length) return null;
    const total = rows.reduce((a, r) => {
      const v = r.valor != null && Number.isFinite(Number(r.valor)) ? Number(r.valor) : 0;
      return a + (v > 0 ? v : 0);
    }, 0);
    return Number(total.toFixed(2));
  }

  /**
   * Serie temporal últimas N horas: vapor consumido compensado vs producido por hora.
   * Devuelve agregado por bucket hora UTC.
   */
  async fetchVaporHorxHora(horas = 24): Promise<{
    consumo: Array<{ hora_utc: string; tnh: number }>;
    produccion: Array<{ hora_utc: string; tnh: number }>;
    por_sector: Array<{ hora_utc: string } & Record<string, number | string>>;
  }> {
    const safeHoras = Math.max(1, Math.min(168, Math.floor(horas)));
    const caudalVars = VAPOR_CAUDAL_DEFS.map((d) => `'${d.variable}'`).join(',');
    const prodVars = VAR_PRODUCCION.map((v) => `'${v}'`).join(',');

    // Caudales de consumo y presiones de colector viven en tablas Influx distintas.
    const sqlCaudalesHist = `
      SELECT
        date_bin(INTERVAL '1 hour', time, TIMESTAMP '1970-01-01T00:00:00Z') AS hora_utc,
        variable,
        AVG(value) AS m3h
      FROM "dashboard-vapor-caudales"
      WHERE time >= now() - INTERVAL '${safeHoras} hours'
        AND time < date_bin(INTERVAL '1 hour', now(), TIMESTAMP '1970-01-01T00:00:00Z')
        AND variable IN (${caudalVars})
      GROUP BY 1, variable
    `;
    const sqlPresionesHist = `
      SELECT
        date_bin(INTERVAL '1 hour', time, TIMESTAMP '1970-01-01T00:00:00Z') AS hora_utc,
        variable,
        AVG(value) AS m3h
      FROM "dashboard-general-energia"
      WHERE time >= now() - INTERVAL '${safeHoras} hours'
        AND time < date_bin(INTERVAL '1 hour', now(), TIMESTAMP '1970-01-01T00:00:00Z')
        AND variable IN ('${VAR_PRESION_ALTA}', '${VAR_PRESION_BAJA}')
      GROUP BY 1, variable
    `;

    const sqlProduccion = `
      SELECT
        date_bin(INTERVAL '1 hour', time, TIMESTAMP '1970-01-01T00:00:00Z') AS hora_utc,
        variable,
        AVG(value) AS m3h
      FROM "dashboard-general-energia"
      WHERE time >= now() - INTERVAL '${safeHoras} hours'
        AND time < date_bin(INTERVAL '1 hour', now(), TIMESTAMP '1970-01-01T00:00:00Z')
        AND variable IN (${prodVars})
      GROUP BY 1, variable
      ORDER BY 1
    `;

    const [rowsCaudalesHist, rowsPresionesHist, rowsProd] = await Promise.all([
      this.influx.query<VaporSerieRow>(sqlCaudalesHist),
      this.influx.query<VaporSerieRow>(sqlPresionesHist),
      this.influx.query<{ hora_utc: string; variable: string; m3h: number }>(sqlProduccion),
    ]);
    const rowsConsumo = [...rowsCaudalesHist, ...rowsPresionesHist];

    // Agregar consumo aplicando compensación por bucket
    const consumoPorHora = new Map<string, { caudales: Map<string, number>; pAlta?: number; pBaja?: number }>();
    for (const r of rowsConsumo) {
      if (r.m3h == null) continue;
      const key = r.hora_utc;
      if (!consumoPorHora.has(key)) {
        consumoPorHora.set(key, { caudales: new Map() });
      }
      const bucket = consumoPorHora.get(key)!;
      if (r.variable === VAR_PRESION_ALTA) {
        bucket.pAlta = Number(r.m3h);
      } else if (r.variable === VAR_PRESION_BAJA) {
        bucket.pBaja = Number(r.m3h);
      } else {
        bucket.caudales.set(r.variable, Number(r.m3h));
      }
    }

    const consumo: Array<{ hora_utc: string; tnh: number }> = [];
    const por_sector: Array<{ hora_utc: string } & Record<string, number | string>> = [];
    const sectoresUnicos = Array.from(new Set(VAPOR_CAUDAL_DEFS.map((d) => d.sector)));
    for (const [hora, bucket] of consumoPorHora) {
      const fAlta = this.factor(bucket.pAlta ?? null);
      const fBaja = this.factor(bucket.pBaja ?? null);
      let total = 0;
      const sectoresTotales: Record<string, number> = {};
      for (const s of sectoresUnicos) sectoresTotales[s] = 0;
      for (const def of VAPOR_CAUDAL_DEFS) {
        const crudo = bucket.caudales.get(def.variable) ?? 0;
        const crudoClamp = crudo > 0 ? crudo : 0;
        const f = def.presion === 'alta' ? fAlta : fBaja;
        const compensado = f != null ? crudoClamp * f : 0;
        total += compensado;
        sectoresTotales[def.sector] = (sectoresTotales[def.sector] ?? 0) + compensado;
      }
      consumo.push({ hora_utc: hora, tnh: Number(total.toFixed(2)) });
      const sectorRow: { hora_utc: string } & Record<string, number | string> = { hora_utc: hora };
      for (const s of sectoresUnicos) {
        sectorRow[s] = Number((sectoresTotales[s] ?? 0).toFixed(2));
      }
      por_sector.push(sectorRow);
    }
    consumo.sort((a, b) => a.hora_utc.localeCompare(b.hora_utc));
    por_sector.sort((a, b) => String(a.hora_utc).localeCompare(String(b.hora_utc)));

    // Producción: sumar las 3 calderas por bucket horario
    const prodMap = new Map<string, number>();
    for (const r of rowsProd) {
      if (r.m3h == null) continue;
      const v = Number(r.m3h);
      const prev = prodMap.get(r.hora_utc) ?? 0;
      prodMap.set(r.hora_utc, prev + (v > 0 ? v : 0));
    }
    const produccion = Array.from(prodMap.entries())
      .map(([hora_utc, tnh]) => ({ hora_utc, tnh: Number(tnh.toFixed(2)) }))
      .sort((a, b) => a.hora_utc.localeCompare(b.hora_utc));

    return { consumo, produccion, por_sector };
  }
}
