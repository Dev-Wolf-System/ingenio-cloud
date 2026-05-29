'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AnalisisResponse, Periodo } from '../_types';

async function fetchAnalisis(periodo: Periodo, refresh = false): Promise<AnalisisResponse | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/alerts/analisis?periodo=${periodo}${refresh ? '&refresh=1' : ''}`);
  if (!res.ok) return null;
  return res.json();
}

export function useAnalisis() {
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const q = useQuery({
    queryKey: ['alerts', 'analisis', periodo],
    queryFn: () => fetchAnalisis(periodo),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const regenerar = () => fetchAnalisis(periodo, true).then(() => q.refetch());
  return { periodo, setPeriodo, data: q.data, loading: q.isLoading, regenerar };
}
