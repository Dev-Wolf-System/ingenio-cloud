export interface CanaRow {
  peso_bruto: number | null;
  neto_cana: number | null;
  trash: number | null;
  pol: number | null;
  brix: number | null;
  pureza: number | null;
  rendimiento: number | null;
}

export interface CanaAgg {
  cana_bruta_kg: number;
  cana_neta_kg: number;
  trash_kg: number;
  trash_pond: number | null;
  rto_pond: number | null;
  brix_pond: number | null;
  pol_pond: number | null;
  pureza_pond: number | null;
  n: number;
}

function pond(rows: CanaRow[], getter: (r: CanaRow) => number | null): number | null {
  let sumNum = 0;
  let sumW = 0;
  for (const r of rows) {
    const v = getter(r);
    const w = r.neto_cana;
    if (v != null && w != null && w > 0) {
      sumNum += v * w;
      sumW += w;
    }
  }
  if (sumW === 0) return null;
  return Math.round((sumNum / sumW) * 100) / 100;
}

export function agregarCana(rows: CanaRow[]): CanaAgg {
  let cana_bruta_kg = 0;
  let cana_neta_kg = 0;
  let trash_kg = 0;

  for (const r of rows) {
    cana_bruta_kg += r.peso_bruto ?? 0;
    cana_neta_kg += r.neto_cana ?? 0;
    trash_kg += (r.peso_bruto ?? 0) * ((r.trash ?? 0) / 100);
  }

  return {
    cana_bruta_kg: Math.round(cana_bruta_kg),
    cana_neta_kg: Math.round(cana_neta_kg),
    trash_kg: Math.round(trash_kg),
    trash_pond: pond(rows, (r) => r.trash),
    rto_pond: pond(rows, (r) => r.rendimiento),
    brix_pond: pond(rows, (r) => r.brix),
    pol_pond: pond(rows, (r) => r.pol),
    pureza_pond: pond(rows, (r) => r.pureza),
    n: rows.length,
  };
}
