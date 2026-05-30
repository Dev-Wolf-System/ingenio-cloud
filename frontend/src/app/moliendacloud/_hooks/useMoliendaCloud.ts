'use client';
import { useQuery } from '@tanstack/react-query';
import type { CanchonResumen, BalanzaHoraRow, MovimientoRow, MoliendaBloque } from '../_types';

const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

async function get<T>(p: string): Promise<T | null> {
  const r = await fetch(`${apiUrl}/molienda-cloud/${p}`);
  return r.ok ? r.json() : null;
}

export function useCanchon() {
  return useQuery({ queryKey: ['mc', 'canchon'], queryFn: () => get<{ data: CanchonResumen | null }>('canchon'), refetchInterval: 30_000 });
}

export function useBalanzaHora() {
  return useQuery({ queryKey: ['mc', 'balanza-hora'], queryFn: () => get<{ data: BalanzaHoraRow[] }>('balanza-hora'), refetchInterval: 60_000 });
}

export function useMovimientosTipo() {
  return useQuery({ queryKey: ['mc', 'mov-tipo'], queryFn: () => get<{ data: MovimientoRow[] }>('movimientos-tipo'), refetchInterval: 30_000 });
}

export function useMoliendaBloques() {
  return useQuery({ queryKey: ['mc', 'mol-bloques'], queryFn: () => get<{ data: MoliendaBloque[] }>('molienda-bloques'), refetchInterval: 60_000 });
}
