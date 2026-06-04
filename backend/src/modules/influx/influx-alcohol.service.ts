import { Injectable, Logger } from '@nestjs/common';
import { InfluxQueryService } from './influx-query.service';

function parseInfluxUtc(s: string): Date {
  return new Date(s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s) ? s : s + 'Z');
}

export interface AlcoholHoraRow {
  hora: string;       // "08:00" … "07:00" en ART (label = cierre del bucket)
  litros: number;
  caudal_avg: number; // m³/h promedio de la hora
}

export interface AlcoholDiaResult {
  horas: AlcoholHoraRow[];
  dia_litros: number;
  caudal_actual: number | null; // m³/h promedio últimos 2 min
  fecha: string;                // "YYYY-MM-DD" día industrial ART
}

const ART_OFFSET_MS = -3 * 60 * 60 * 1000; // UTC-3, sin DST

@Injectable()
export class InfluxAlcoholService {
  private readonly logger = new Logger(InfluxAlcoholService.name);
  private readonly VAR = 'Destileria.Destileria.dest_alcohol_caudal';
  private readonly TABLE = '"dashboard-general-produccion"';

  constructor(private readonly influx: InfluxQueryService) {}

  async alcoholDia(offset = 0): Promise<AlcoholDiaResult> {
    // Container TZ = ART → new Date().getHours() da hora local ART
    const now = new Date();
    const diaInd = new Date(now);
    if (now.getHours() < 7) diaInd.setDate(diaInd.getDate() - 1);
    if (offset > 0) diaInd.setDate(diaInd.getDate() - offset);

    const pad = (n: number) => String(n).padStart(2, '0');
    const diaYmd = `${diaInd.getFullYear()}-${pad(diaInd.getMonth() + 1)}-${pad(diaInd.getDate())}`;

    // 07:00 ART = 10:00 UTC
    const inicioUtc = `${diaYmd}T10:00:00Z`;
    const finUtc = new Date(new Date(inicioUtc).getTime() + 24 * 3600_000).toISOString();

    const esHoy = offset === 0;

    // Horas cerradas: hasta el inicio del bucket actual (hora en curso excluida)
    const sqlHoras = `
      SELECT
        date_bin(INTERVAL '1 hour', time, TIMESTAMP '1970-01-01T00:00:00Z') + INTERVAL '1 hour' AS hora_utc,
        AVG(value) AS caudal_avg,
        AVG(value) * 1000.0 AS litros
      FROM ${this.TABLE}
      WHERE variable = '${this.VAR}'
        AND time >= TIMESTAMP '${inicioUtc}'
        AND time < ${esHoy
          ? "date_bin(INTERVAL '1 hour', now(), TIMESTAMP '1970-01-01T00:00:00Z')"
          : `TIMESTAMP '${finUtc}'`}
      GROUP BY hora_utc
      ORDER BY hora_utc
    `;

    // Hora en curso: acumulado parcial desde el inicio del bucket actual
    const sqlHoraEnCurso = `
      SELECT
        date_bin(INTERVAL '1 hour', now(), TIMESTAMP '1970-01-01T00:00:00Z') + INTERVAL '1 hour' AS hora_utc,
        AVG(value) AS caudal_avg,
        AVG(value) * (CAST(extract(epoch FROM now() - date_bin(INTERVAL '1 hour', now(), TIMESTAMP '1970-01-01T00:00:00Z')) AS double) / 3600.0) * 1000.0 AS litros
      FROM ${this.TABLE}
      WHERE variable = '${this.VAR}'
        AND time >= date_bin(INTERVAL '1 hour', now(), TIMESTAMP '1970-01-01T00:00:00Z')
    `;

    // Caudal instantáneo
    const sqlActual = `
      SELECT AVG(value) AS caudal_actual
      FROM ${this.TABLE}
      WHERE variable = '${this.VAR}'
        AND time >= now() - INTERVAL '2 minutes'
    `;

    const [horasRows, horaEnCursoRows, actualRows] = await Promise.all([
      this.influx.query<{ hora_utc: string; caudal_avg: number; litros: number }>(sqlHoras),
      esHoy ? this.influx.query<{ hora_utc: string; caudal_avg: number; litros: number }>(sqlHoraEnCurso) : Promise.resolve([]),
      esHoy ? this.influx.query<{ caudal_actual: number }>(sqlActual) : Promise.resolve([]),
    ]);

    const toRow = (r: { hora_utc: string; caudal_avg: number; litros: number }): AlcoholHoraRow => {
      // utcToArt embeds ART hours in UTC bytes → use toISOString, not getHours (TZ=ART container)
      const art = new Date(parseInfluxUtc(r.hora_utc).getTime() + ART_OFFSET_MS);
      return {
        hora: `${art.toISOString().slice(11, 13)}:00`,
        litros: Math.round(r.litros ?? 0),
        caudal_avg: Math.round((r.caudal_avg ?? 0) * 100) / 100,
      };
    };

    const horas = [
      ...horasRows.map(toRow),
      ...(horaEnCursoRows.length ? [toRow(horaEnCursoRows[0])] : []),
    ];

    const dia_litros = horas.reduce((s, h) => s + h.litros, 0);
    const caudal_actual = actualRows[0]?.caudal_actual != null
      ? Math.round(actualRows[0].caudal_actual * 100) / 100
      : null;

    return { horas, dia_litros, caudal_actual, fecha: diaYmd };
  }
}
