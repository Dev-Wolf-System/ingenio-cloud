# 06 — Integración de datos

## 1. Mapa general de flujos

```
┌───────────────────────────────────────────────────────────────────────┐
│ FUENTE              │ TRANSPORTE         │ DESTINO            │ FREQ │
├───────────────────────────────────────────────────────────────────────┤
│ PLCs/sensores       │ KEPServerEX→EMQX→  │ InfluxDB (raw)     │ 1Hz  │
│ industriales        │ Node-RED           │ + Supabase via     │      │
│                     │                    │ webhook agrupado   │      │
├───────────────────────────────────────────────────────────────────────┤
│ Webhook ENERGÍA     │ n8n → POST         │ Supabase           │ ~5s  │
│ (10 vars)           │ /api/webhooks/n8n/ │ industrial.        │      │
│                     │ metrics-energy     │ metrics_live       │      │
├───────────────────────────────────────────────────────────────────────┤
│ Webhook PRODUCCIÓN  │ n8n → POST         │ Supabase           │ ~5s  │
│ (18 vars)           │ /api/webhooks/n8n/ │ industrial.        │      │
│                     │ metrics-production │ metrics_live       │      │
├───────────────────────────────────────────────────────────────────────┤
│ HTTP Molienda       │ GET interno        │ Cache (memo + cron │ 1x   │
│ promedio externo    │ → /api/guardia/    │ refresh c/5min)    │ turno│
│                     │ molienda           │                    │      │
├───────────────────────────────────────────────────────────────────────┤
│ MSSQL CORONA        │ Server query       │ Cache Supabase     │ 1x   │
│ gas turno previo    │ → /api/guardia/    │ shift_kpis_cache   │ turno│
│                     │ gas-previo         │                    │      │
├───────────────────────────────────────────────────────────────────────┤
│ MSSQL CORONA        │ Server query       │ Cache Supabase     │ 1x   │
│ paradas turno prev  │ → /api/guardia/    │ shift_kpis_cache   │ turno│
│                     │ paradas            │                    │      │
├───────────────────────────────────────────────────────────────────────┤
│ Webhook velocidad   │ n8n cierre turno   │ Cache Supabase     │ 1x   │
│ primer molino       │ → POST /api/       │ shift_kpis_cache   │ turno│
│                     │ webhooks/n8n/      │                    │      │
│                     │ shift/mill-speed   │                    │      │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 2. Webhooks de ingesta — endpoints app

### 2.1 `/api/webhooks/n8n/metrics-energy`

**Método:** POST
**Auth:** Header `x-webhook-secret: ${N8N_WEBHOOK_SECRET}`
**Rate limit:** 60 req/min por IP

**Payload (validado con zod):**

```typescript
{
  tenant_id?: "lacorona",                  // default
  plant_id?: "planta-sur",                 // default
  source: "n8n",
  timestamp?: "2026-05-15T14:32:17Z",      // ISO, server.now() si omit
  metrics: [
    { sensor_id: "caudal_caldera_2", value: 62.3 },
    { sensor_id: "caudal_caldera_3", value: 58.1 },
    { sensor_id: "caudal_caldera_6", value: 65.0 },
    { sensor_id: "presion_alta_baja", value: 19.2 },
    { sensor_id: "presion_escape", value: 2.1 },
    { sensor_id: "presion_vg1", value: 8.4 },
    { sensor_id: "temp_agua_alimentacion", value: 105.2 },
    { sensor_id: "presion_agua_alimentacion", value: 14.2 },
    { sensor_id: "potencia_weg", value: 6.8 },
    { sensor_id: "potencia_siemens", value: 5.6 },
    { sensor_id: "gas_actual", value: 320 },
    { sensor_id: "gas_acumulado_dia", value: 4820 }
  ]
}
```

**Lógica server:**

```typescript
// src/app/api/webhooks/n8n/metrics-energy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ratelimit } from '@/lib/ratelimit';
import { createServiceClient } from '@/lib/supabase/service';
import { MetricsWebhookSchema } from '@/types/webhooks';
import { resolveStatus } from '@/lib/utils/status';
import { VARIABLE_BY_ID } from '@/lib/constants/variables';
import { caudalTotalVapor, generacionTotal } from '@/lib/utils/calculations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // 1. Auth
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2. Rate limit
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
  }

  // 3. Validar payload
  const body = await req.json();
  const parsed = MetricsWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { metrics, timestamp, tenant_id, plant_id } = parsed.data;
  const ts = timestamp ?? new Date().toISOString();
  const supabase = createServiceClient();

  // 4. Enriquecer con setpoints + calcular status + agregar calculados
  const enrichedMetrics = metrics.map(m => {
    const def = VARIABLE_BY_ID[m.sensor_id];
    if (!def) return null;
    const value = typeof m.value === 'string' ? parseFloat(m.value) : m.value;
    const status = def.setpoints ? resolveStatus(value, def.setpoints) : 'unknown';
    return {
      sensor_id: m.sensor_id,
      value,
      status,
      tenant_id,
      plant_id,
      updated_at: ts,
    };
  }).filter(Boolean);

  // 5. Agregar calculados (caudal_total_vapor, generacion_total)
  const c2 = metrics.find(m => m.sensor_id === 'caudal_caldera_2')?.value;
  const c3 = metrics.find(m => m.sensor_id === 'caudal_caldera_3')?.value;
  const c6 = metrics.find(m => m.sensor_id === 'caudal_caldera_6')?.value;
  if (c2 != null && c3 != null && c6 != null) {
    const total = caudalTotalVapor(+c2, +c3, +c6);
    enrichedMetrics.push({
      sensor_id: 'caudal_total_vapor',
      value: total,
      status: resolveStatus(total, VARIABLE_BY_ID['caudal_total_vapor'].setpoints),
      tenant_id,
      plant_id,
      updated_at: ts,
    });
  }

  const weg = metrics.find(m => m.sensor_id === 'potencia_weg')?.value;
  const siemens = metrics.find(m => m.sensor_id === 'potencia_siemens')?.value;
  if (weg != null && siemens != null) {
    const total = generacionTotal(+weg, +siemens);
    enrichedMetrics.push({
      sensor_id: 'generacion_total',
      value: total,
      status: resolveStatus(total, VARIABLE_BY_ID['generacion_total'].setpoints),
      tenant_id,
      plant_id,
      updated_at: ts,
    });
  }

  // 6. Upsert atómico
  const { error } = await supabase
    .from('industrial.metrics_live')
    .upsert(enrichedMetrics, { onConflict: 'sensor_id' });

  if (error) {
    console.error('upsert error', error);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  // 7. Append history (async, no await)
  supabase.from('industrial.metrics_history').insert(
    enrichedMetrics.map(m => ({ ...m, recorded_at: ts }))
  ).then(() => {});

  return NextResponse.json({
    ok: true,
    count: enrichedMetrics.length,
    timestamp: ts,
  });
}
```

### 2.2 `/api/webhooks/n8n/metrics-production`

Mismo patrón, payload con 18 sensores de producción + cálculo de `promedio_molienda_turno_actual` (requiere `molienda_acumulada_turno` viniendo en payload o consulta adicional).

### 2.3 `/api/webhooks/n8n/shift/mill-speed`

**Payload:**

```typescript
{
  tenant_id?: "lacorona",
  shift: "morning" | "afternoon" | "night",
  shift_date: "2026-05-15",
  promedio_rpm: 4.8,
  samples: [
    { timestamp: "2026-05-15T05:01:00Z", rpm: 4.7 },
    // ...
  ]
}
```

Guarda en `industrial.shift_kpis_cache` con `kpi_id = 'vel_primer_molino'`, `shift_ref = 'previous'` (porque al recibirlo ya terminó el turno).

---

## 3. Endpoints consulta (KPIs guardia)

### 3.1 `GET /api/guardia/molienda`

Proxy hacia HTTP endpoint externo.

```typescript
// src/app/api/guardia/molienda/route.ts
export async function GET() {
  const cached = await getCached('molienda_promedio', { ttl: 60 });
  if (cached) return NextResponse.json(cached);

  const res = await fetch(process.env.MOLIENDA_HTTP_URL!, {
    headers: process.env.MOLIENDA_HTTP_AUTH
      ? { Authorization: process.env.MOLIENDA_HTTP_AUTH }
      : {},
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
  }

  const data = await res.json();
  await setCached('molienda_promedio', data, { ttl: 60 });
  return NextResponse.json(data);
}
```

### 3.2 `GET /api/guardia/gas-previo`

Consulta MSSQL CORONA.

```typescript
// src/app/api/guardia/gas-previo/route.ts
import { getMssqlPool } from '@/lib/db/mssql';
import { getPreviousShiftBounds } from '@/lib/utils/shift';

export async function GET() {
  const { start, end, name, date } = getPreviousShiftBounds();
  const cacheKey = `gas_previo_${date}_${name}`;

  // Check cache first
  const cached = await getCachedShiftKpi(cacheKey);
  if (cached) return NextResponse.json(cached);

  const pool = await getMssqlPool();
  const result = await pool.request()
    .input('start', sql.DateTime, start)
    .input('end', sql.DateTime, end)
    .query(`
      SELECT
        SUM(CAST(valor AS FLOAT)) AS total_m3,
        COUNT(*) AS samples,
        AVG(CAST(valor AS FLOAT)) AS promedio
      FROM pr_ezi_laboratorio_gral
      WHERE codigoproceso = 'Gas'
        AND fecha_hora BETWEEN @start AND @end
    `);

  const row = result.recordset[0];
  const horasturno = (end.getTime() - start.getTime()) / 3600000;
  const payload = {
    promedio_m3_h: row.total_m3 / horasturno,
    total_m3: row.total_m3,
    horas_turno: horasturno,
    samples: row.samples,
    shift: name,
    shift_date: date,
  };

  await setCachedShiftKpi(cacheKey, payload);
  return NextResponse.json(payload);
}
```

**Nota:** la query exacta depende del schema real de CORONA. Validar con `CORONA_DB_REFERENCE.md` y vía MCP.

### 3.3 `GET /api/guardia/paradas`

Similar a `gas-previo` pero query distinta sobre `codigoproceso = 'Paradas'`. Devuelve objeto `ParadasKPI`.

### 3.4 `GET /api/metrics/snapshot`

Fallback inicial cuando carga el dashboard (antes que Realtime subscribe). Devuelve el último estado de `industrial.metrics_live`.

```typescript
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const tenant_id = req.nextUrl.searchParams.get('tenant_id') ?? 'default';
  const plant_id = req.nextUrl.searchParams.get('plant_id') ?? 'default';
  const area = req.nextUrl.searchParams.get('area');

  let query = supabase
    .from('industrial.metrics_live')
    .select('*, sensor_mapping(label, unit, area)')
    .eq('tenant_id', tenant_id)
    .eq('plant_id', plant_id);

  if (area) {
    query = query.eq('sensor_mapping.area', area);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ metrics: data });
}
```

### 3.5 `GET /api/health`

```typescript
export async function GET() {
  const checks = await Promise.allSettled([
    checkSupabase(),
    checkMssql(),
    checkRealtimeChannel(),
  ]);
  return NextResponse.json({ status: 'ok', checks });
}
```

---

## 4. Realtime con Supabase

### 4.1 Setup channel

```typescript
// src/lib/supabase/realtime.ts
import { createBrowserClient } from './client';

export function subscribeToMetrics(
  area: MetricArea[],
  onUpdate: (m: MetricReading) => void
) {
  const supabase = createBrowserClient();
  const channel = supabase
    .channel(`metrics:${area.join(',')}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'industrial',
        table: 'metrics_live',
      },
      (payload) => {
        const row = payload.new as any;
        // filtrar por area (RLS ya filtra tenant/plant)
        if (!area.includes(row.area)) return;
        onUpdate(rowToMetric(row));
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeToAlerts(
  onChange: (alert: ActiveAlert, event: 'INSERT' | 'UPDATE' | 'DELETE') => void
) {
  const supabase = createBrowserClient();
  const channel = supabase
    .channel('alerts_active')
    .on(
      'postgres_changes',
      { event: '*', schema: 'alerts', table: 'active' },
      (payload) => {
        onChange(payload.new as ActiveAlert, payload.eventType);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
```

### 4.2 Reconexión + backoff

Supabase Realtime maneja reconexión exponencial automática. La app debe:
- Mostrar `<ConnectionStatus />` reflejando estado del channel
- Toast persistente "Reconectando..." si > 10s sin conexión
- Refetch snapshot vía `/api/metrics/snapshot` al reconectar

---

## 5. Cliente MSSQL (CORONA legacy)

```typescript
// src/lib/db/mssql.ts
import sql, { ConnectionPool } from 'mssql';

let pool: ConnectionPool | null = null;

export async function getMssqlPool(): Promise<ConnectionPool> {
  if (pool && pool.connected) return pool;

  pool = await sql.connect({
    server: process.env.MSSQL_HOST!,
    port: parseInt(process.env.MSSQL_PORT ?? '1433'),
    database: process.env.MSSQL_DATABASE!,
    user: process.env.MSSQL_USER!,
    password: process.env.MSSQL_PASSWORD!,
    options: {
      encrypt: process.env.MSSQL_ENCRYPT === 'true',
      trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === 'true',
      enableArithAbort: true,
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    requestTimeout: 10000,
  });

  return pool;
}

export async function closeMssqlPool() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
```

**Seguridad:** SOLO `SELECT`. Code-review humano antes de cualquier query nueva. CLAUDE.md de `BDs MMSQL/` aplica.

---

## 6. Cache strategy

### 6.1 Niveles de cache

```
┌──────────────────────────────────────────────────────┐
│ Nivel 1: TanStack Query client (memoria browser)     │
│   ── ShiftKPIs: staleTime hasta próximo cambio turno │
│   ── Metrics snapshot inicial: 30s                   │
├──────────────────────────────────────────────────────┤
│ Nivel 2: Realtime subscription (live updates)        │
│   ── Reemplaza cache TanStack en cuanto recibe       │
├──────────────────────────────────────────────────────┤
│ Nivel 3: Supabase shift_kpis_cache (persistente)     │
│   ── KPIs guardia con valid_until = próximo turno    │
├──────────────────────────────────────────────────────┤
│ Nivel 4: Upstash Redis (opcional S2+)                │
│   ── Compartido entre instancias para rate limit     │
└──────────────────────────────────────────────────────┘
```

### 6.2 TanStack Query setup

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,        // 30s
      gcTime: 1000 * 60 * 60,      // 1h cache
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        if (error?.status === 401) return false;
        return failureCount < 3;
      },
    },
  },
});
```

### 6.3 Invalidación al cambio turno

```typescript
// src/lib/hooks/useShiftKPIs.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useShift } from './useShift';
import { useEffect } from 'react';

export function useShiftKPIs() {
  const queryClient = useQueryClient();
  const shift = useShift();

  // Trigger invalidación al cambiar turno
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['guardia'] });
  }, [shift.name, shift.start.toISOString()]);

  const molienda = useQuery({
    queryKey: ['guardia', 'molienda', shift.start.toISOString()],
    queryFn: () => fetch('/api/guardia/molienda').then(r => r.json()),
    staleTime: 1000 * 60 * 60 * 8,    // turno completo
  });

  const gasPrev = useQuery({
    queryKey: ['guardia', 'gas-previo', shift.start.toISOString()],
    queryFn: () => fetch('/api/guardia/gas-previo').then(r => r.json()),
    staleTime: 1000 * 60 * 60 * 8,
  });

  const paradas = useQuery({
    queryKey: ['guardia', 'paradas', shift.start.toISOString()],
    queryFn: () => fetch('/api/guardia/paradas').then(r => r.json()),
    staleTime: 1000 * 60 * 60 * 8,
  });

  const velMolino = useQuery({
    queryKey: ['guardia', 'vel-molino', shift.start.toISOString()],
    queryFn: () => fetch('/api/guardia/vel-molino').then(r => r.json()),
    staleTime: 1000 * 60 * 60 * 8,
  });

  return { molienda, gasPrev, paradas, velMolino };
}
```

---

## 7. Validación y seguridad

### 7.1 Webhooks

- Header secret obligatorio
- Rate limit por IP + por tenant
- Validación zod
- Idempotencia: si recibimos mismo timestamp + sensor, no duplicar history (UNIQUE constraint)
- Logs estructurados en Pino para auditoría

### 7.2 Server queries

- MSSQL: solo SELECT, jamás dynamic SQL
- Supabase: usar service role solo en `/api/webhooks/*`, no en endpoints expuestos directo
- Validación request input con zod siempre

### 7.3 Cliente

- No exponer service role key al cliente
- Browser usa anon key + JWT user (cuando auth esté activa S1)
- RLS hace el resto

---

## 8. Configuración n8n (lado externo)

Aunque no es código de la app, documentamos el formato esperado para que se configuren los flows correctos:

### 8.1 Flow ENERGÍA

```
Trigger: MQTT subscribe (EMQX) cada N segundos
  → Function node: agrupar lecturas últimos 5s
  → HTTP Request POST /api/webhooks/n8n/metrics-energy
    Headers: x-webhook-secret = N8N_WEBHOOK_SECRET
    Body: { source: "n8n", timestamp: <iso>, metrics: [...] }
```

### 8.2 Flow PRODUCCIÓN

Idéntico pero a `/api/webhooks/n8n/metrics-production`.

### 8.3 Flow VELOCIDAD MOLINO (1x turno)

```
Trigger: cron al cierre de cada turno (05:01, 13:01, 21:01)
  → InfluxDB Query: SELECT rpm FROM mill WHERE time >= shift_start AND time < shift_end
  → Function: calcular promedio + samples
  → HTTP Request POST /api/webhooks/n8n/shift/mill-speed
```

---

**Siguiente:** [`07_HOOKS_Y_ESTADO.md`](./07_HOOKS_Y_ESTADO.md)
