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
  const base = new Date(d);
  base.setMinutes(0, 0, 0);
  if (d.getHours() < 5) base.setDate(base.getDate() - 1);
  base.setHours(5);
  return base;
}

export function rangoPeriodo(periodo: Periodo, ref = new Date(), zafraInicio?: Date): Rango {
  if (periodo === 'turno') {
    const desde = inicioTurno(ref);
    const hasta = new Date(desde.getTime() + 8 * 3600_000);
    const prevDesde = new Date(desde.getTime() - 8 * 3600_000);
    return { desde, hasta, prevDesde, prevHasta: desde, etiqueta: 'Turno actual' };
  }
  if (periodo === 'dia') {
    const desde = inicioDiaIndustrial(ref);
    const hasta = new Date(desde.getTime() + 24 * 3600_000);
    const prevDesde = new Date(desde.getTime() - 24 * 3600_000);
    return { desde, hasta, prevDesde, prevHasta: desde, etiqueta: 'Día industrial' };
  }
  const desde = zafraInicio ?? new Date(ref.getFullYear(), 0, 1);
  return { desde, hasta: ref, prevDesde: null, prevHasta: null, etiqueta: 'Zafra' };
}
