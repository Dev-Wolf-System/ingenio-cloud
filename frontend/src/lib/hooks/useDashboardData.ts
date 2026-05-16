'use client';

import { useEffect, useReducer } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export interface DashboardItem {
  key: string;
  value: number;
  display: string | null;
  unit: string | null;
  raw: number | null;
  updated_at: string;
}

type Action =
  | { type: 'init'; payload: DashboardItem[] }
  | { type: 'update'; payload: DashboardItem };

function reducer(state: Map<string, DashboardItem>, action: Action) {
  switch (action.type) {
    case 'init': {
      const map = new Map<string, DashboardItem>();
      action.payload.forEach((item) => map.set(item.key, item));
      return map;
    }
    case 'update': {
      const next = new Map(state);
      next.set(action.payload.key, action.payload);
      return next;
    }
  }
}

export function useDashboardData(area: 'energia' | 'produccion') {
  const [data, dispatch] = useReducer(reducer, new Map<string, DashboardItem>());

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowser();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

    async function init() {
      try {
        const res = await fetch(`${apiUrl}/metrics/dashboard-snapshot?area=${area}`);
        if (!res.ok) return;
        const json = (await res.json()) as { data: DashboardItem[] };
        if (!mounted) return;
        dispatch({ type: 'init', payload: json.data ?? [] });
      } catch (err) {
        console.warn('dashboard snapshot failed', err);
      }
    }
    init();

    const channel = supabase
      .channel(`dashboard_data_${area}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'industrial',
          table: 'dashboard_data',
          filter: `area=eq.${area}`,
        },
        (payload: { new: DashboardItem & { area: string } }) => {
          if (!mounted) return;
          if (payload.new && payload.new.area === area) {
            dispatch({
              type: 'update',
              payload: {
                key: payload.new.key,
                value: Number(payload.new.value),
                display: payload.new.display,
                unit: payload.new.unit,
                raw: payload.new.raw,
                updated_at: payload.new.updated_at,
              },
            });
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [area]);

  return data;
}
