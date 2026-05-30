'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AnalisisResponse, Periodo } from '../_types';

async function fetchAnalisis(
  periodo: Periodo,
  offset: number,
  refresh = false,
): Promise<AnalisisResponse | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(
    `${apiUrl}/alerts/analisis?periodo=${periodo}&offset=${offset}${refresh ? '&refresh=1' : ''}`,
  );
  if (!res.ok) return null;
  return res.json();
}

export function useAnalisis() {
  const [periodo, _setPeriodo] = useState<Periodo>('turno');
  const [offset, setOffset]   = useState(0);

  const q = useQuery({
    queryKey: ['alerts', 'analisis', periodo, offset],
    queryFn: () => fetchAnalisis(periodo, offset),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  function setPeriodo(p: Periodo) {
    setOffset(0);
    _setPeriodo(p);
  }

  function stepBack() {
    setOffset((prev) => Math.min(prev + 1, 30));
  }

  function stepForward() {
    setOffset((prev) => Math.max(prev - 1, 0));
  }

  function regenerar() {
    fetchAnalisis(periodo, offset, true).then(() => q.refetch());
  }

  return {
    periodo,
    setPeriodo,
    offset,
    stepBack,
    stepForward,
    regenerar,
    data: q.data,
    loading: q.isLoading,
  };
}
