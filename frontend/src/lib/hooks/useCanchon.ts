'use client';
import { useQuery } from '@tanstack/react-query';

export type CanchonResumen = Record<string, number | string | null>;

export interface FincaAnalisRow { finca: string; camiones: number; ton_neta: number; rto: number; vs_avg: number }
export interface CañeroAnalisRow { cañero: string; camiones: number; ton_neta: number; rto: number }

export interface AnalisCanaData {
  zafras: Array<{ anio: number; label: string }>;
  stats: { camiones: number; ton_neta: number; rto_avg: number; fincas_count: number } | null;
  por_finca: FincaAnalisRow[];
  por_cañero: CañeroAnalisRow[];
  insight: { resumen: string; alertas: string[]; recomendaciones: string[] } | null;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

async function get<T>(p: string): Promise<T | null> {
  const r = await fetch(`${apiUrl}/molienda-cloud/${p}`);
  return r.ok ? r.json() : null;
}

export function useCanchon() {
  return useQuery({
    queryKey: ['mc', 'canchon'],
    queryFn: () => get<{ data: CanchonResumen | null }>('canchon'),
    refetchInterval: 30_000,
  });
}

export function useAnalisCana(zafra?: number) {
  const params = zafra ? `?zafra=${zafra}` : '';
  return useQuery({
    queryKey: ['mc', 'analis-cana', zafra],
    queryFn: () => get<AnalisCanaData>(`analisis-cana${params}`),
    staleTime: 60_000,
    refetchInterval: (query) => (!query.state.data?.insight ? 12_000 : 90_000),
  });
}
