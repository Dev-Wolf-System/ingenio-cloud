'use client';

import { useEffect, useReducer, useId } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export interface DashboardItem {
  key: string;
  value: number;
  display: string | null;
  unit: string | null;
  raw: number | null;
  updated_at: string;
  /**
   * Epoch ms (reloj del cliente) de la última vez que ESTE cliente vio cambiar
   * el valor. Usado para detectar "sensor caído" sin comparar contra el reloj
   * del servidor — inmune a desincronización de hora entre cliente y servidor.
   */
  receivedAt: number;
}

type IncomingItem = Omit<DashboardItem, 'receivedAt'>;

type Action =
  | { type: 'init'; payload: IncomingItem[] }
  | { type: 'update'; payload: IncomingItem };

function reducer(state: Map<string, DashboardItem>, action: Action) {
  switch (action.type) {
    case 'init': {
      // Merge no destructivo: si llega vacío (snapshot fallido) mantiene cache.
      if (action.payload.length === 0) return state;
      // Detectar si hay cambios reales antes de crear nuevo Map
      // (evita re-renders innecesarios si snapshot trae los mismos updated_at)
      let changed = false;
      const next = new Map(state);
      for (const item of action.payload) {
        const prev = next.get(item.key);
        if (
          !prev ||
          prev.updated_at !== item.updated_at ||
          prev.value !== item.value
        ) {
          next.set(item.key, { ...item, receivedAt: Date.now() });
          changed = true;
        }
      }
      return changed ? next : state;
    }
    case 'update': {
      const next = new Map(state);
      next.set(action.payload.key, { ...action.payload, receivedAt: Date.now() });
      return next;
    }
  }
}

const POLL_INTERVAL_MS = 1000; // 1s — sensación fluida sin freezing

export function useDashboardData(area: 'energia' | 'produccion' | 'trapiche') {
  const [data, dispatch] = useReducer(reducer, new Map<string, DashboardItem>());
  const instanceId = useId();

  useEffect(() => {
    let mounted = true;
    let channelRef: ReturnType<ReturnType<typeof getSupabaseBrowser>['channel']> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api';

    async function loadSnapshot() {
      if (inFlight) return; // skip si request anterior aún corre (evita pileup)
      inFlight = true;
      try {
        const res = await fetch(`${apiUrl}/metrics/dashboard-snapshot?area=${area}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = (await res.json()) as { data: IncomingItem[] };
        if (!mounted) return;
        dispatch({ type: 'init', payload: json.data ?? [] });
      } catch (err) {
        console.warn('dashboard snapshot failed', err);
      } finally {
        inFlight = false;
      }
    }

    // 1. Snapshot inicial inmediato
    loadSnapshot();

    // 2. Polling siempre activo cada 1s (no solo fallback)
    pollInterval = setInterval(loadSnapshot, POLL_INTERVAL_MS);

    // 3. Realtime como complemento — eventos UPDATE/INSERT pushean delta inmediato
    const channelName = `dashboard_${area}_${instanceId.replace(/[^a-z0-9]/gi, '')}_${Date.now()}`;

    try {
      const supabase = getSupabaseBrowser();
      const ch = supabase.channel(channelName);

      ch.on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'industrial',
          table: 'dashboard_data',
          filter: `area=eq.${area}`,
        },
        (payload: { new: IncomingItem & { area: string } }) => {
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

      ch.subscribe();
      channelRef = ch;
    } catch (err) {
      console.warn('Realtime setup failed (polling 1s seguirá activo)', err);
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
  }, [area, instanceId]);

  return data;
}
