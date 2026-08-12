'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

export interface ParadasResp {
  periodo: string;
  rango: { desde: string; hasta: string; etiqueta: string };
  reliabilidad: {
    paradas_n: number;
    span_min: number;
    downtime_total_min: number;
    operating_min: number;
    mtbf_min: number | null;
    mttr_min: number | null;
    mttf_min: number | null;
    mtta_min: number | null;
  };
  paradas: Array<{
    inicio: string;
    fin: string | null;
    minutos: number | null;
    motivo: string;
    maquina: string | null;
    origen: string | null;
    gas_m3?: number | null;
  }>;
  por_area: Array<{ area: string; n: number; minutos_total: number }>;
  por_motivo: Array<{ motivo: string; n: number; minutos_total: number }>;
  series_dia: Array<{ dia: string; n: number; minutos: number }>;
  por_categoria: Array<{ categoria: string; n: number; minutos_total: number }>;
  impacto: { prom_t_h: number | null; toneladas_no_molidas: number | null } | null;
  gas_en_paradas_m3: number | null;
  insight: {
    resumen: string;
    patrones: string[];
    recomendaciones: string[];
    cached: boolean;
  } | null;
}

export function useParadasMC() {
  const [periodo, setPeriodoInternal] = useState<'turno' | 'dia' | 'zafra'>('dia');
  const [offset, setOffset] = useState(0);

  const q = useQuery({
    queryKey: ['mc', 'paradas', periodo, offset],
    queryFn: async () => {
      const r = await fetch(`${apiUrl}/molienda-cloud/paradas?periodo=${periodo}&offset=${offset}`);
      return r.ok ? (r.json() as Promise<ParadasResp>) : null;
    },
    refetchInterval: 60_000,
  });

  function setPeriodo(p: 'turno' | 'dia' | 'zafra') {
    setOffset(0);
    setPeriodoInternal(p);
  }

  return {
    periodo,
    setPeriodo,
    offset,
    stepBack: () => setOffset((o) => Math.min(o + 1, 60)),
    stepForward: () => setOffset((o) => Math.max(o - 1, 0)),
    data: q.data,
    loading: q.isLoading,
  };
}
