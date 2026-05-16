'use client';

import { useEffect, useReducer } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { MetricArea, MetricReading, MetricStatus } from '@/types/metrics';

type Action =
  | { type: 'init'; payload: MetricReading[] }
  | { type: 'update'; payload: MetricReading };

function reducer(state: Map<string, MetricReading>, action: Action) {
  switch (action.type) {
    case 'init': {
      const map = new Map<string, MetricReading>();
      action.payload.forEach((m) => map.set(m.sensor_id, m));
      return map;
    }
    case 'update': {
      const next = new Map(state);
      next.set(action.payload.sensor_id, action.payload);
      return next;
    }
  }
}

export function useRealtimeMetrics(areas: MetricArea[]) {
  const [metrics, dispatch] = useReducer(reducer, new Map<string, MetricReading>());

  const areasKey = areas.join(',');

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowser();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

    async function init() {
      try {
        const res = await fetch(`${apiUrl}/metrics/snapshot?area=${areasKey}`);
        if (!res.ok) return;
        const json = (await res.json()) as { metrics: MetricReading[] };
        if (!mounted) return;
        dispatch({ type: 'init', payload: json.metrics ?? [] });
      } catch (err) {
        // silent
        console.warn('snapshot failed', err);
      }
    }
    init();

    const channel = supabase
      .channel(`metrics_live_${areasKey.replace(/,/g, '_')}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'industrial', table: 'metrics_live' },
        (payload: { new: { sensor_id: string; value: number; status: MetricStatus; updated_at: string } }) => {
          if (!mounted) return;
          const row = payload.new as {
            sensor_id: string;
            value: number;
            status: MetricStatus;
            updated_at: string;
          };
          dispatch({
            type: 'update',
            payload: {
              sensor_id: row.sensor_id,
              value: Number(row.value),
              status: row.status,
              updated_at: row.updated_at,
            },
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [areasKey]);

  return metrics;
}
