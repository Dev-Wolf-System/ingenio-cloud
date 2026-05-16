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
    let channelRef: ReturnType<ReturnType<typeof getSupabaseBrowser>['channel']> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api';

    async function loadSnapshot() {
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
    loadSnapshot();

    // Realtime — orden correcto: definir channel + on() ANTES de subscribe()
    try {
      const supabase = getSupabaseBrowser();
      const ch = supabase.channel(`dashboard_data_${area}`);

      ch.on(
        'postgres_changes' as never,
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
      );

      ch.subscribe((status: string) => {
        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          if (!pollInterval && mounted) {
            console.warn(`Realtime ${area} ${status}, fallback polling 5s`);
            pollInterval = setInterval(loadSnapshot, 5000);
          }
        }
      });

      channelRef = ch;
    } catch (err) {
      console.warn('Realtime setup failed, fallback polling 5s', err);
      pollInterval = setInterval(loadSnapshot, 5000);
    }

    return () => {
      mounted = false;
      if (channelRef) {
        try {
          const supabase = getSupabaseBrowser();
          supabase.removeChannel(channelRef);
        } catch {
          // noop
        }
      }
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [area]);

  return data;
}
