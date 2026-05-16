# 08 — Turnos y lógica de Resumen de Guardia

## 1. Definición de turnos (Argentina)

| Turno | Inicio | Fin | Duración |
|---|---|---|---|
| **Mañana** | 05:00 ART | 13:00 ART | 8 hs |
| **Tarde** | 13:00 ART | 21:00 ART | 8 hs |
| **Noche** | 21:00 ART | 05:00 ART (día sig.) | 8 hs |

**Timezone:** `America/Argentina/Buenos_Aires` (UTC-3, sin DST).

---

## 2. Implementación `getCurrentShift()`

```typescript
// src/lib/utils/shift.ts
import { utcToZonedTime, zonedTimeToUtc, format } from 'date-fns-tz';
import { startOfDay, addDays, addHours, differenceInMinutes } from 'date-fns';
import type { Shift, ShiftName } from '@/types/shift';

const TZ = 'America/Argentina/Buenos_Aires';

function getShiftBoundaries(now: Date): {
  name: ShiftName;
  displayName: string;
  start: Date;
  end: Date;
} {
  const nowAR = utcToZonedTime(now, TZ);
  const hour = nowAR.getHours();
  const todayAR = startOfDay(nowAR);

  if (hour >= 5 && hour < 13) {
    return {
      name: 'morning',
      displayName: 'Turno Mañana',
      start: zonedTimeToUtc(addHours(todayAR, 5), TZ),
      end:   zonedTimeToUtc(addHours(todayAR, 13), TZ),
    };
  }
  if (hour >= 13 && hour < 21) {
    return {
      name: 'afternoon',
      displayName: 'Turno Tarde',
      start: zonedTimeToUtc(addHours(todayAR, 13), TZ),
      end:   zonedTimeToUtc(addHours(todayAR, 21), TZ),
    };
  }
  // Noche cruza el día
  if (hour >= 21) {
    return {
      name: 'night',
      displayName: 'Turno Noche',
      start: zonedTimeToUtc(addHours(todayAR, 21), TZ),
      end:   zonedTimeToUtc(addHours(addDays(todayAR, 1), 5), TZ),
    };
  }
  // hour < 5 → noche que empezó ayer
  return {
    name: 'night',
    displayName: 'Turno Noche',
    start: zonedTimeToUtc(addHours(addDays(todayAR, -1), 21), TZ),
    end:   zonedTimeToUtc(addHours(todayAR, 5), TZ),
  };
}

export function getCurrentShift(now = new Date()): Shift {
  const { name, displayName, start, end } = getShiftBoundaries(now);
  const elapsedMinutes = differenceInMinutes(now, start);
  const totalMinutes = differenceInMinutes(end, start);
  const remainingMinutes = totalMinutes - elapsedMinutes;
  const progress = elapsedMinutes / totalMinutes;
  return { name, displayName, start, end, elapsedMinutes, remainingMinutes, progress };
}

export function getPreviousShift(now = new Date()): Shift {
  const current = getCurrentShift(now);
  const prevEnd = current.start;
  const prevStart = addHours(prevEnd, -8);
  const elapsedMinutes = 480;
  let prevName: ShiftName;
  let displayName: string;
  if (current.name === 'morning') {
    prevName = 'night';
    displayName = 'Turno Noche';
  } else if (current.name === 'afternoon') {
    prevName = 'morning';
    displayName = 'Turno Mañana';
  } else {
    prevName = 'afternoon';
    displayName = 'Turno Tarde';
  }
  return {
    name: prevName,
    displayName,
    start: prevStart,
    end: prevEnd,
    elapsedMinutes,
    remainingMinutes: 0,
    progress: 1,
  };
}

export function shiftDateKey(shift: Shift): string {
  // YYYY-MM-DD del DÍA OPERATIVO. Para noche que cruza día, usar fecha de inicio.
  return format(utcToZonedTime(shift.start, TZ), 'yyyy-MM-dd', { timeZone: TZ });
}
```

### Tests unitarios obligatorios

```typescript
// __tests__/shift.test.ts
import { getCurrentShift, getPreviousShift } from '@/lib/utils/shift';

describe('getCurrentShift', () => {
  test('05:00 AR → morning recién empezado', () => {
    const t = new Date('2026-05-15T08:00:00Z');           // 05:00 ART
    const s = getCurrentShift(t);
    expect(s.name).toBe('morning');
    expect(s.elapsedMinutes).toBe(0);
  });

  test('13:00 AR → afternoon recién empezado, previo es morning', () => {
    const t = new Date('2026-05-15T16:00:00Z');           // 13:00 ART
    const s = getCurrentShift(t);
    const p = getPreviousShift(t);
    expect(s.name).toBe('afternoon');
    expect(p.name).toBe('morning');
  });

  test('21:00 AR → night recién empezado', () => {
    const t = new Date('2026-05-15T24:00:00Z');           // 21:00 ART
    const s = getCurrentShift(t);
    expect(s.name).toBe('night');
  });

  test('03:00 AR del día siguiente → noche que cruza', () => {
    const t = new Date('2026-05-16T06:00:00Z');           // 03:00 ART del 16
    const s = getCurrentShift(t);
    expect(s.name).toBe('night');
    expect(s.start.toISOString()).toBe('2026-05-16T00:00:00Z'); // 21:00 ART del 15
    expect(s.elapsedMinutes).toBe(360);                       // 6 horas
  });

  test('04:59 AR → último minuto de noche', () => {
    const t = new Date('2026-05-16T07:59:00Z');           // 04:59 ART
    const s = getCurrentShift(t);
    expect(s.name).toBe('night');
    expect(s.remainingMinutes).toBe(1);
  });

  test('05:00 AR exacto → morning empieza, previo es noche', () => {
    const t = new Date('2026-05-16T08:00:00Z');
    const s = getCurrentShift(t);
    const p = getPreviousShift(t);
    expect(s.name).toBe('morning');
    expect(p.name).toBe('night');
  });
});
```

---

## 3. Estrategia de cache KPIs guardia

### 3.1 Comportamiento esperado

- KPI guardia se carga **1 vez al iniciar el dashboard** (al montar).
- Se mantiene en cache hasta **cambio de turno** o **refresh manual**.
- Al cambiar turno, **invalidar automático** + refetch.
- Si llega webhook `mill-speed` mientras el panel está abierto → invalidate solo ese KPI.

### 3.2 Implementación TanStack Query

```typescript
// src/lib/hooks/useShiftKPIs.ts
'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useShift } from './useShift';
import { shiftDateKey } from '@/lib/utils/shift';

export function useShiftKPIs() {
  const queryClient = useQueryClient();
  const shift = useShift();
  const shiftKey = shiftDateKey(shift) + '-' + shift.name;

  // Listener cambio turno → invalidar
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['guardia'] });
    };
    window.addEventListener('shift-changed', handler);
    return () => window.removeEventListener('shift-changed', handler);
  }, [queryClient]);

  const molienda = useQuery({
    queryKey: ['guardia', 'molienda', shiftKey],
    queryFn: () => fetch('/api/guardia/molienda').then(r => r.json()),
    staleTime: Infinity,                  // hasta invalidación manual
    gcTime: 1000 * 60 * 60 * 24,
  });

  const gasPrev = useQuery({
    queryKey: ['guardia', 'gas-previo', shiftKey],
    queryFn: () => fetch('/api/guardia/gas-previo').then(r => r.json()),
    staleTime: Infinity,
  });

  const paradas = useQuery({
    queryKey: ['guardia', 'paradas', shiftKey],
    queryFn: () => fetch('/api/guardia/paradas').then(r => r.json()),
    staleTime: Infinity,
  });

  const velMolino = useQuery({
    queryKey: ['guardia', 'vel-molino', shiftKey],
    queryFn: () => fetch('/api/guardia/vel-molino').then(r => r.json()),
    staleTime: Infinity,
  });

  return {
    molienda,
    gasPrev,
    paradas,
    velMolino,
    isLoading: molienda.isLoading || gasPrev.isLoading || paradas.isLoading || velMolino.isLoading,
    refetchAll: () => queryClient.invalidateQueries({ queryKey: ['guardia'] }),
  };
}
```

### 3.3 Cache persistente Supabase

Aunque el cliente cachea con TanStack Query, el server cachea en `industrial.shift_kpis_cache` para:
- No reconsultar MSSQL cada vez que un usuario nuevo abre el dashboard
- Servir mismo valor a múltiples usuarios mismo tenant
- Resilencia ante reinicios servidor

```typescript
// src/lib/utils/shift-cache.ts
import { createServiceClient } from '@/lib/supabase/service';
import type { ShiftKPI } from '@/types/shift';

export async function getCachedShiftKpi(
  kpiId: string,
  shift: Shift,
  tenantId: string,
  plantId: string,
): Promise<ShiftKPI | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('industrial.shift_kpis_cache')
    .select('*')
    .eq('kpi_id', kpiId)
    .eq('shift_date', shiftDateKey(shift))
    .eq('shift_name', shift.name)
    .eq('tenant_id', tenantId)
    .eq('plant_id', plantId)
    .maybeSingle();
  return data;
}

export async function setCachedShiftKpi(
  kpiId: string,
  shift: Shift,
  payload: unknown,
  tenantId: string,
  plantId: string,
  validUntil: Date,
) {
  const supabase = createServiceClient();
  await supabase
    .from('industrial.shift_kpis_cache')
    .upsert({
      kpi_id: kpiId,
      shift_date: shiftDateKey(shift),
      shift_name: shift.name,
      shift_ref: 'previous',                   // siempre del previo, salvo molienda actual
      payload,
      tenant_id: tenantId,
      plant_id: plantId,
      valid_until: validUntil.toISOString(),
      fetched_at: new Date().toISOString(),
    }, {
      onConflict: 'kpi_id,shift_date,shift_name,tenant_id,plant_id',
    });
}
```

### 3.4 Flow consulta gas turno previo

```
GET /api/guardia/gas-previo
  ↓
getPreviousShift(now)
  ↓
getCachedShiftKpi('gas_previo', prevShift, ...)
  ↓
[hit?] → return payload directo
[miss] → 
  query MSSQL
  ↓
  parse + compute promedio/total
  ↓
  setCachedShiftKpi(...)
  ↓
  return payload
```

---

## 4. Eventos de cambio de turno

### 4.1 Server-side cron

```typescript
// scripts/shift-cron.ts (futuro Sprint 1 — manejado por Celery beat o n8n cron)
// Cada turno (05:01, 13:01, 21:01) hace:

1. Cierra estadísticas del turno anterior (calcula molienda promedio cerrada, etc.)
2. Calcula KPIs guardia y los guarda en shift_kpis_cache
3. Publica evento Supabase Realtime canal `shift-events`
4. Limpia metrics_history mayor a N días (housekeeping)
```

### 4.2 Client-side

`useShift()` detecta cambio cada minuto. Cuando cambia el `name`:
- Dispara `window.dispatchEvent('shift-changed')`
- `useShiftKPIs()` invalida sus queries
- Refetch automático

### 4.3 Tolerancia datos faltantes

Si al cargar el dashboard NO existe cache para el turno previo (ej. acabamos de migrar y no hay histórico), mostrar:
- KPI con estado `loading` durante 5s
- Luego: chip "Datos turno previo no disponibles" + botón "Reintentar"

---

## 5. Casos especiales

### 5.1 Reinicio de zafra
Al iniciar zafra (start of season) no hay datos del "turno previo" real. Mostrar mensaje informativo en bloque guardia.

### 5.2 Paradas largas que cruzan turnos
La parada cuenta para el turno donde ocurrió **el inicio** del evento (decisión a confirmar con cliente).

### 5.3 DST / cambio horario
Argentina no tiene DST. Sin caso.

### 5.4 Hora del cliente vs servidor
Todo cálculo se hace **server-side** con timezone forzado `America/Argentina/Buenos_Aires`. Cliente solo muestra. Nunca confiar en `new Date()` cliente para calcular bounds.

### 5.5 Webhook mill-speed llega antes del cron de cierre
No problema: webhook sobreescribe cache con `valid_until` = inicio del próximo turno. Cron solo lo regenera si no existe.

### 5.6 Múltiples plantas
Cada planta puede tener distintos horarios. Esquema preparado: `industrial.plant_shift_config` (futuro v3.1). En v3.0 todas las plantas comparten horarios AR.

---

## 6. Resumen visual estado bloque Guardia

```
ESTADO INICIAL (carga primera vez):
  [Molienda]   loading skeleton
  [Gas prev]   loading skeleton
  [Paradas]    loading skeleton
  [Vel molino] loading skeleton

ESTADO NORMAL (datos cacheados):
  [Molienda]   6.642 t/h · "Turno actual"  · timestamp pequeño
  [Gas prev]   380 m³/h · "Turno mañana"   · 3.040 m³ total
  [Paradas]    2 paradas · "Turno mañana"  · 47 min total
  [Vel molino] 4.8 rpm · gráfica spark      · "Turno mañana"

ESTADO REFRESCANDO (cambio turno):
  Banner toast: "Datos del nuevo turno disponibles" (3s)
  KPIs actualizan sin perder los valores previos visibles

ESTADO ERROR:
  [KPI] gris · chip "Sin datos" · botón retry
```

---

## 7. Checklist desarrollo turnos

- [ ] `getCurrentShift()` con 8 casos test unitarios
- [ ] `getPreviousShift()` con tests cross-day
- [ ] `useShift()` tick segundos sin memory leak
- [ ] `useShiftKPIs()` invalida en evento `shift-changed`
- [ ] Cache server `industrial.shift_kpis_cache` con upsert
- [ ] Endpoint `/api/guardia/molienda` proxy HTTP
- [ ] Endpoint `/api/guardia/gas-previo` consulta MSSQL
- [ ] Endpoint `/api/guardia/paradas` consulta MSSQL
- [ ] Endpoint `/api/webhooks/n8n/shift/mill-speed` recibe push
- [ ] `<ShiftKpi />` con loading/error/data states
- [ ] Banner toast notificación cambio turno
- [ ] Documentado en CLAUDE.md interno del repo

---

**Siguiente:** [`09_ROADMAP_EJECUCION.md`](./09_ROADMAP_EJECUCION.md)
