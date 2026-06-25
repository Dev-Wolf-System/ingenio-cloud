/**
 * Cálculo de gas consumido durante paradas, prorrateando por solape horario.
 * Fuente: production.gas_hora_estimado (ts_cierre = hora ART local naive, m3_estimado = m³ de esa hora).
 * Compartido entre molienda-cloud (modal paradas) y guardia (resumen turno) para que el
 * número sea idéntico en ambas vistas y la lógica de TZ viva en un solo lugar.
 */

export interface GasHora {
  iniMs: number; // inicio del intervalo horario (UTC ms)
  finMs: number; // fin = ts_cierre (UTC ms)
  m3: number;    // m³ consumidos en esa hora
}

/** Convierte filas de gas_hora_estimado (ts_cierre ART naive) a intervalos en UTC ms. */
export function parseGasHoras(rows: Array<{ ts_cierre: string; m3_estimado: number }>): GasHora[] {
  return rows.map((h) => {
    const s = String(h.ts_cierre).trim().replace(/z$/i, '');
    const cierreMs = new Date(s + '-03:00').getTime(); // ts_cierre es hora ART → UTC
    return { iniMs: cierreMs - 3600_000, finMs: cierreMs, m3: Number(h.m3_estimado) || 0 };
  });
}

/** m³ de gas consumidos en [iniMs, finMs], prorrateando cada hora por su solape. */
export function gasEnIntervalo(horas: GasHora[], iniMs: number, finMs: number): number {
  let g = 0;
  for (const h of horas) {
    const overlap = Math.min(finMs, h.finMs) - Math.max(iniMs, h.iniMs);
    if (overlap > 0) g += h.m3 * (overlap / 3600_000);
  }
  return g;
}
