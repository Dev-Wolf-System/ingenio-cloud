# 07 — Hooks y estado

## 1. Filosofía

- **Server state** → TanStack Query (cache + refetch + stale-while-revalidate)
- **UI state** → Zustand (modales, sidebar, copilot, preferencias)
- **Realtime state** → suscripciones Supabase + reducer local
- **Sin Context API custom** — Zustand cubre todo
- **Cero prop drilling** — hooks consumen stores directamente

---

## 2. Hooks principales

### 2.1 `useShift()`

Calcula turno actual + tick segundos.

```typescript
// src/lib/hooks/useShift.ts
'use client';
import { useEffect, useState } from 'react';
import { getCurrentShift, type Shift } from '@/lib/utils/shift';

export function useShift(): Shift {
  const [shift, setShift] = useState<Shift>(() => getCurrentShift());

  useEffect(() => {
    const tick = () => setShift(getCurrentShift());

    // Tick cada segundo para `elapsedMinutes`
    const id = setInterval(tick, 1000);

    // Detect crossing shift boundary y forzar full refresh
    const checkBoundary = () => {
      const newShift = getCurrentShift();
      if (newShift.name !== shift.name) {
        // Cambio de turno detectado — invalidar TanStack Query
        window.dispatchEvent(new CustomEvent('shift-changed', { detail: newShift }));
      }
      setShift(newShift);
    };
    const idBoundary = setInterval(checkBoundary, 60000);

    return () => {
      clearInterval(id);
      clearInterval(idBoundary);
    };
  }, [shift.name]);

  return shift;
}
```

### 2.2 `useClock()`

Reloj live para topbar.

```typescript
// src/lib/hooks/useClock.ts
'use client';
import { useEffect, useState } from 'react';

export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
```

### 2.3 `useRealtimeMetrics(areas)`

```typescript
// src/lib/hooks/useRealtimeMetrics.ts
'use client';
import { useEffect, useReducer } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { MetricArea, MetricReading } from '@/types/metrics';

type Action =
  | { type: 'init'; payload: MetricReading[] }
  | { type: 'update'; payload: MetricReading };

function reducer(state: Map<string, MetricReading>, action: Action) {
  switch (action.type) {
    case 'init': {
      const map = new Map<string, MetricReading>();
      action.payload.forEach(m => map.set(m.id, m));
      return map;
    }
    case 'update': {
      const next = new Map(state);
      next.set(action.payload.id, action.payload);
      return next;
    }
  }
}

export function useRealtimeMetrics(areas: MetricArea[]) {
  const [metrics, dispatch] = useReducer(reducer, new Map<string, MetricReading>());
  const supabase = createBrowserClient();

  useEffect(() => {
    let mounted = true;

    async function init() {
      // 1. Snapshot inicial (fallback rápido vía /api/metrics/snapshot)
      const res = await fetch(`/api/metrics/snapshot?area=${areas.join(',')}`);
      if (!mounted) return;
      const { metrics: rows } = await res.json();
      dispatch({
        type: 'init',
        payload: rows.map(rowToMetric),
      });
    }
    init();

    // 2. Subscribe a updates
    const channel = supabase
      .channel(`metrics_live_${areas.join('_')}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'industrial',
          table: 'metrics_live',
        },
        (payload) => {
          if (!mounted) return;
          const row = payload.new as any;
          if (!areas.includes(row.area)) return;
          dispatch({ type: 'update', payload: rowToMetric(row) });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [areas.join(',')]);

  return metrics;
}

function rowToMetric(row: any): MetricReading {
  return {
    id: row.sensor_id,
    area: row.area,
    label: row.label,
    value: Number(row.value),
    unit: row.unit,
    status: row.status,
    timestamp: row.updated_at,
    setpoints: {
      min: row.setpoint_min,
      max: row.setpoint_max,
      warnMin: row.setpoint_warn_min,
      warnMax: row.setpoint_warn_max,
    },
  };
}
```

### 2.4 `useShiftKPIs()`

Ya documentado en `06_INTEGRACION_DATOS.md` sec 6.3. Devuelve 4 queries TanStack.

### 2.5 `useActiveAlerts()`

```typescript
// src/lib/hooks/useActiveAlerts.ts
'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { ActiveAlert } from '@/types/alerts';

export function useActiveAlerts() {
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const supabase = createBrowserClient();

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase
        .from('alerts.active')
        .select('*')
        .is('resolved_at', null)
        .order('detected_at', { ascending: false });
      if (!mounted) return;
      setAlerts(data ?? []);
    }
    init();

    const channel = supabase
      .channel('alerts_active')
      .on(
        'postgres_changes',
        { event: '*', schema: 'alerts', table: 'active' },
        (payload) => {
          if (!mounted) return;
          if (payload.eventType === 'INSERT') {
            setAlerts(prev => [payload.new as ActiveAlert, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setAlerts(prev => {
              const u = payload.new as ActiveAlert;
              if (u.resolved_at) {
                return prev.filter(a => a.id !== u.id);
              }
              return prev.map(a => (a.id === u.id ? u : a));
            });
          } else if (payload.eventType === 'DELETE') {
            setAlerts(prev => prev.filter(a => a.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return alerts;
}
```

### 2.6 `useConnectionStatus()`

```typescript
// src/lib/hooks/useConnectionStatus.ts
'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

type Status = 'connected' | 'reconnecting' | 'offline';

export function useConnectionStatus(): Status {
  const [status, setStatus] = useState<Status>('reconnecting');
  const supabase = createBrowserClient();

  useEffect(() => {
    const channel = supabase
      .channel('connection_status_probe')
      .on('system', { event: '*' }, () => {
        setStatus('connected');
      })
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') setStatus('connected');
        else if (s === 'CLOSED' || s === 'CHANNEL_ERROR') setStatus('offline');
        else setStatus('reconnecting');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return status;
}
```

### 2.7 `useFullscreen()`

```typescript
// src/lib/hooks/useFullscreen.ts
'use client';
import { useCallback, useEffect, useState } from 'react';

export function useFullscreen() {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const handler = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const enter = useCallback(async () => {
    await document.documentElement.requestFullscreen();
  }, []);

  const exit = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }, []);

  const toggle = useCallback(async () => {
    if (isFs) await exit();
    else await enter();
  }, [isFs, enter, exit]);

  return { isFullscreen: isFs, enter, exit, toggle };
}
```

### 2.8 `useWakeLock()`

```typescript
// src/lib/hooks/useWakeLock.ts
'use client';
import { useEffect } from 'react';

export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;

    let wakeLock: any = null;

    async function acquire() {
      try {
        wakeLock = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake lock denied', err);
      }
    }

    acquire();

    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      wakeLock?.release();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}
```

### 2.9 `useKeyboardShortcut(keys, handler)`

```typescript
// src/lib/hooks/useKeyboardShortcut.ts
'use client';
import { useEffect } from 'react';

export function useKeyboardShortcut(
  keys: string | string[],
  handler: (e: KeyboardEvent) => void
) {
  useEffect(() => {
    const target = Array.isArray(keys) ? keys : [keys];
    const fn = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const combo = [
        e.metaKey && 'meta',
        e.ctrlKey && 'ctrl',
        e.shiftKey && 'shift',
        e.altKey && 'alt',
        key,
      ].filter(Boolean).join('+');
      if (target.includes(key) || target.includes(combo)) {
        handler(e);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [keys, handler]);
}
```

### 2.10 `useFlash(value)` — trigger flash al cambiar

```typescript
// src/lib/hooks/useFlash.ts
'use client';
import { useEffect, useRef, useState } from 'react';

export function useFlash(value: unknown, duration = 400): boolean {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value && prevRef.current !== undefined) {
      setFlash(true);
      const id = setTimeout(() => setFlash(false), duration);
      return () => clearTimeout(id);
    }
    prevRef.current = value;
  }, [value, duration]);

  return flash;
}
```

### 2.11 `useCountUp(value, duration)`

```typescript
// src/lib/hooks/useCountUp.ts
'use client';
import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(target);
  const prevTarget = useRef(target);
  const startTime = useRef<number | null>(null);
  const startValue = useRef(target);
  const rafId = useRef<number>();

  useEffect(() => {
    if (target === prevTarget.current) return;
    startValue.current = value;
    startTime.current = performance.now();
    prevTarget.current = target;

    const step = (now: number) => {
      const elapsed = now - (startTime.current ?? now);
      const t = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = startValue.current + (target - startValue.current) * eased;
      setValue(v);
      if (t < 1) rafId.current = requestAnimationFrame(step);
    };

    rafId.current = requestAnimationFrame(step);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [target, duration]);

  return value;
}
```

---

## 3. Zustand stores

### 3.1 `stores/ui.ts`

```typescript
// src/stores/ui.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;

  density: 'compact' | 'comfortable' | 'spacious';
  setDensity: (d: 'compact' | 'comfortable' | 'spacious') => void;

  mobileTab: 'energia' | 'produccion' | 'guardia';
  setMobileTab: (t: 'energia' | 'produccion' | 'guardia') => void;

  cmdkOpen: boolean;
  setCmdkOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      theme: 'dark',
      setTheme: (theme) => set({ theme }),

      density: 'comfortable',
      setDensity: (density) => set({ density }),

      mobileTab: 'energia',
      setMobileTab: (mobileTab) => set({ mobileTab }),

      cmdkOpen: false,
      setCmdkOpen: (cmdkOpen) => set({ cmdkOpen }),
    }),
    {
      name: 'ingenio-cloud-ui',
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        theme: s.theme,
        density: s.density,
      }),
    }
  )
);
```

### 3.2 `stores/alerts.ts`

```typescript
// src/stores/alerts.ts
import { create } from 'zustand';
import type { ActiveAlert } from '@/types/alerts';

interface AlertsState {
  dismissedIds: Set<string>;          // local dismiss para mobile/PC
  dismiss: (id: string) => void;
  reset: () => void;
}

export const useAlertsStore = create<AlertsState>((set) => ({
  dismissedIds: new Set(),
  dismiss: (id) => set((s) => {
    const next = new Set(s.dismissedIds);
    next.add(id);
    return { dismissedIds: next };
  }),
  reset: () => set({ dismissedIds: new Set() }),
}));

export function useCriticalAlert(alerts: ActiveAlert[]): ActiveAlert | null {
  const dismissed = useAlertsStore((s) => s.dismissedIds);
  return alerts.find(a => a.severity === 'critical' && !dismissed.has(a.id)) ?? null;
}
```

### 3.3 `stores/copilot.ts`

```typescript
// src/stores/copilot.ts (placeholder S0, activo S1)
import { create } from 'zustand';

interface CopilotSuggestion {
  id: string;
  label: string;
  text: string;
  primaryAction: string;
  secondaryActions: string[];
  confidence?: number;
}

interface CopilotState {
  active: boolean;
  suggestion: CopilotSuggestion | null;
  setSuggestion: (s: CopilotSuggestion | null) => void;
}

export const useCopilotStore = create<CopilotState>((set) => ({
  active: false,                       // S1 lo activa
  suggestion: null,
  setSuggestion: (suggestion) => set({ suggestion }),
}));
```

---

## 4. Composición: page.tsx Dashboard

```typescript
// src/app/(dashboard)/page.tsx
'use client';

import { useShift } from '@/lib/hooks/useShift';
import { useRealtimeMetrics } from '@/lib/hooks/useRealtimeMetrics';
import { useActiveAlerts } from '@/lib/hooks/useActiveAlerts';
import { useShiftKPIs } from '@/lib/hooks/useShiftKPIs';
import { useUIStore } from '@/stores/ui';
import { useCriticalAlert } from '@/stores/alerts';

import { TopBar } from '@/components/layout/TopBar';
import { AlertStrip } from '@/components/industrial/AlertStrip';
import { KpiHero } from '@/components/industrial/KpiHero';
import { EnergyPanel } from '@/components/industrial/EnergyPanel';
import { ProductionPanel } from '@/components/industrial/ProductionPanel';
import { ShiftSummaryPanel } from '@/components/industrial/ShiftSummaryPanel';
import { CopilotBanner } from '@/components/industrial/CopilotBanner';

export default function DashboardPage() {
  const shift = useShift();
  const energyMetrics = useRealtimeMetrics(['energia']);
  const productionMetrics = useRealtimeMetrics(['produccion']);
  const alerts = useActiveAlerts();
  const shiftKpis = useShiftKPIs();
  const critical = useCriticalAlert(alerts);

  return (
    <div className="tv-shell" data-alert-active={critical !== null}>
      <TopBar plant="Planta Sur" />
      {critical && <AlertStrip alert={critical} />}
      <KpiHero kpis={buildHeroKpis(energyMetrics, productionMetrics, alerts, shiftKpis)} />
      <div className="body-grid">
        <EnergyPanel metrics={energyMetrics} />
        <ProductionPanel metrics={productionMetrics} />
        <ShiftSummaryPanel
          shiftKpis={shiftKpis}
          activeAlerts={alerts}
          recentActivity={[]}
        />
      </div>
      <CopilotBanner />
    </div>
  );
}

function buildHeroKpis(
  energy: Map<string, MetricReading>,
  production: Map<string, MetricReading>,
  alerts: ActiveAlert[],
  kpis: ReturnType<typeof useShiftKPIs>
) {
  // ... map a 4 KPI hero cards
}
```

---

## 5. Providers root layout

```typescript
// src/app/layout.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { Toaster } from '@/components/ui/toaster';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body className="font-body antialiased">
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster />
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

---

## 6. Performance considerations

### 6.1 Re-renders

- Cada `MetricTile` recibe solo su `MetricReading` (no la Map entera)
- Selectores con shallow equality donde aplica
- `React.memo` en `MetricTile`, `LevelBar`, `KpiCard` con custom comparator (compara `value`, `status`, `timestamp`)

### 6.2 Map vs Object

- `Map<sensor_id, MetricReading>` permite mutación O(1) sin clonar todo el state
- Pasar al hijo solo `metrics.get(sensor_id)` evita renders innecesarios

### 6.3 Throttling Realtime

- Si llegan muchas updates < 100ms entre sí, batch en un solo render con `unstable_batchedUpdates` (React 18 lo hace auto)
- Si una variable cambia > 5 veces/seg, considerar throttle en server (n8n agrupa)

### 6.4 Cleanup

- Todos los hooks limpian listeners/intervals/channels
- `mounted` flag pattern para evitar setState post-unmount

---

**Siguiente:** [`08_TURNOS_Y_LOGICA_GUARDIA.md`](./08_TURNOS_Y_LOGICA_GUARDIA.md)
