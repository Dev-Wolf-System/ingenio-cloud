// Tipo del comparativo de caña. La agregación se hace server-side en la vista
// production.v_mc_comparativa_cana (ver molienda-cloud.service.ts comparativaCana).
export interface CanaAgg {
  molienda_kg: number;
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
