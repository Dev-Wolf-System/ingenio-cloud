'use client';
import { useQuery } from '@tanstack/react-query';
import type { CanchonResumen, BalanzaHoraRow, MovimientoRow, MoliendaBloque, LabRow } from '../_types';

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
export interface Comparativa { actual: CanaAgg | null; ult_cierre: CanaAgg | null; acumulado: CanaAgg | null }
export interface MovCanaRow {
  numero_pesada: number | null;
  grupo: string | null;
  razon_social: string | null;
  numero_analisis: number | null;
  peso_neto: number | null;
  trash: number | null;
  brix: number | null;
  pol: number | null;
  pureza: number | null;
  rendimiento: number | null;
  neto_cana: number | null;
  variedad: string | null;
  tipo_cana: string | null;
  salida_at: string | null;
  codigo_finca: string | null;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

async function get<T>(p: string): Promise<T | null> {
  const r = await fetch(`${apiUrl}/molienda-cloud/${p}`);
  return r.ok ? r.json() : null;
}

export function useCanchon() {
  return useQuery({ queryKey: ['mc', 'canchon'], queryFn: () => get<{ data: CanchonResumen | null }>('canchon'), refetchInterval: 30_000 });
}

export function useBalanzaHora() {
  return useQuery({ queryKey: ['mc', 'balanza-hora'], queryFn: () => get<{ data: BalanzaHoraRow[] }>('balanza-hora'), refetchInterval: 30_000 });
}

export function useMovimientosTipo() {
  return useQuery({ queryKey: ['mc', 'mov-tipo'], queryFn: () => get<{ data: MovimientoRow[] }>('movimientos-tipo'), refetchInterval: 30_000 });
}

export function useMoliendaBloques() {
  return useQuery({ queryKey: ['mc', 'mol-bloques'], queryFn: () => get<{ data: MoliendaBloque[] }>('molienda-bloques'), refetchInterval: 30_000 });
}

export function useComparativaCana() {
  return useQuery({ queryKey: ['mc', 'comparativa-cana'], queryFn: () => get<Comparativa & { stale?: boolean }>('comparativa-cana'), refetchInterval: 30_000 });
}

export function useMovimientosCana() {
  return useQuery({ queryKey: ['mc', 'mov-cana'], queryFn: () => get<{ data: MovCanaRow[] }>('movimientos-cana?limit=100'), refetchInterval: 30_000 });
}

export interface EspRow {
  proceso_codigo: string;
  fecha_industrial: string;
  hora_lectura: string | null;
  color_icumsa: number | null;
  turbidez: number | null;
  humedad: number | null;
  cenizas: number | null;
  sediment_test: number | null;
  so2_ppm: number | null;
  granulometria_20: number | null;
  granulometria_30: number | null;
  calidad: number | null;
  silo: string | null;
  destino: string | null;
}

export function useAzucar(offset = 0) {
  return useQuery({
    queryKey: ['mc', 'azucar', offset],
    queryFn: () => get<{ data: EspRow[]; fecha?: string }>(`azucar?offset=${offset}`),
    refetchInterval: 30_000,
  });
}

export interface FincaAnalisRow { finca: string; camiones: number; ton_neta: number; rto: number; vs_avg: number }
export interface CañeroAnalisRow { cañero: string; camiones: number; ton_neta: number; rto: number }
export interface AnalisCanaData {
  zafras: Array<{ anio: number; label: string }>;
  stats: { camiones: number; ton_neta: number; rto_avg: number; fincas_count: number } | null;
  por_finca: FincaAnalisRow[];
  por_cañero: CañeroAnalisRow[];
  insight: { resumen: string; alertas: string[]; recomendaciones: string[] } | null;
}

export function useAnalisCana(zafra?: number) {
  const params = zafra ? `?zafra=${zafra}` : '';
  return useQuery({
    queryKey: ['mc', 'analis-cana', zafra],
    queryFn: () => get<AnalisCanaData>(`analisis-cana${params}`),
    staleTime: 4 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useLab(procesos: string[], periodo: 'dia' | 'zafra' = 'dia', offset = 0) {
  const params = new URLSearchParams({ procesos: procesos.join(','), periodo, offset: String(offset) });
  return useQuery({
    queryKey: ['mc', 'lab', procesos, periodo, offset],
    queryFn: () => get<{ data: LabRow[]; fecha?: string }>(`lab?${params.toString()}`),
    refetchInterval: 30_000,
  });
}
