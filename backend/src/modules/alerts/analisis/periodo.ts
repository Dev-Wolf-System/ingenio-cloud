export type Periodo = 'turno' | 'dia' | 'zafra';

export interface Rango {
  desde: Date;
  hasta: Date;
  prevDesde: Date | null;
  prevHasta: Date | null;
  etiqueta: string;
}

function inicioTurno(d: Date): Date {
  const h = d.getHours();
  const base = new Date(d);
  base.setMinutes(0, 0, 0);
  if (h >= 5 && h < 13) base.setHours(5);
  else if (h >= 13 && h < 21) base.setHours(13);
  else if (h >= 21) base.setHours(21);
  else { base.setDate(base.getDate() - 1); base.setHours(21); }
  return base;
}

function inicioDiaIndustrial(d: Date): Date {
  // Día industrial abre y cierra a las 07:00 (convención del ingenio / dashboard).
  const base = new Date(d);
  base.setMinutes(0, 0, 0);
  if (d.getHours() < 7) base.setDate(base.getDate() - 1);
  base.setHours(7);
  return base;
}

/**
 * @param offset retrocede de a una unidad: 0 = actual, 1 = anterior, 2 = ante-anterior…
 *               (aplica a turno y día; ignorado en zafra).
 */
export function rangoPeriodo(periodo: Periodo, ref = new Date(), zafraInicio?: Date, offset = 0): Rango {
  if (periodo === 'turno') {
    const actual = inicioTurno(ref);
    const desde = new Date(actual.getTime() - offset * 8 * 3600_000);
    const hasta = new Date(desde.getTime() + 8 * 3600_000);
    const prevDesde = new Date(desde.getTime() - 8 * 3600_000);
    return { desde, hasta, prevDesde, prevHasta: desde, etiqueta: offset === 0 ? 'Turno actual' : offset === 1 ? 'Turno anterior' : `Turno −${offset}` };
  }
  if (periodo === 'dia') {
    const actual = inicioDiaIndustrial(ref);
    const desde = new Date(actual.getTime() - offset * 24 * 3600_000);
    const hasta = new Date(desde.getTime() + 24 * 3600_000);
    const prevDesde = new Date(desde.getTime() - 24 * 3600_000);
    return { desde, hasta, prevDesde, prevHasta: desde, etiqueta: offset === 0 ? 'Día actual' : offset === 1 ? 'Día anterior' : `Día −${offset}` };
  }
  const desde = zafraInicio ?? new Date(ref.getFullYear(), 0, 1);
  return { desde, hasta: ref, prevDesde: null, prevHasta: null, etiqueta: `Zafra ${ref.getFullYear()}` };
}
