# Estrategia de almacenamiento — Patrón híbrido Postgres + InfluxDB

> **Decisión:** Opción C híbrida. Confirmado 2026-05-15.

---

## TL;DR

| Dato | Destino | Quién escribe | Quién lee |
|---|---|---|---|
| Último valor (snapshot) | Postgres `industrial.dashboard_data` | Backend WS gateway | Frontend (Realtime) + endpoints REST |
| Histórico raw (1Hz, 35 sensores) | **InfluxDB** | Node-RED (`influxdb3 out` extra en flow) | Vigía-Anomaly S1+, Grafana técnico, ML training, sparklines (endpoint history S1+) |
| KPIs guardia (1x turno) | Postgres `industrial.shift_kpis_cache` | Backend WS molino + endpoints guardia | Frontend (ShiftSummaryPanel) |
| Alertas | Postgres `alerts.active` | Backend (Vigía S1+) | Frontend (Realtime) |

**Reglas oro:**
- Frontend NUNCA lee Influx directo
- Backend NUNCA escribe Influx (en Sprint 0 — Sprint 1+ Vigía sí leerá)
- Node-RED es ÚNICO ingreso a Influx + Postgres

---

## Por qué híbrido

| Aspecto | Postgres `dashboard_data` | InfluxDB |
|---|---|---|
| Compresión series tiempo | 1x | 10-20x |
| Tamaño 35 sensores × 1Hz × 1 año | ~30 GB | ~1 GB |
| Latencia query histórica | segundos | ms |
| RLS multi-tenant | ✅ nativo | ❌ no tiene |
| Realtime WebSocket | ✅ Supabase | ❌ no |
| Cardinalidad alta tags | aceptable | nativo |
| Retention policies | manual (pg_partman) | nativo (CREATE RETENTION POLICY) |
| ML training (millones filas) | lento | rápido |

**Conclusión:** cada uno donde brilla. Postgres = "vista actual + multi-tenant". Influx = "archivo histórico + analítica".

---

## Configuración Node-RED (agregar a tu flow actual)

### Schema InfluxDB sugerido

```
Database:     corona2026 (ya existe en tu stack)
Measurement:  dashboard_signals
Tags:
  - area      (energia | produccion)
  - key       (alias Node-RED, ej. "Potencia_WEG")
Fields:
  - value     (numeric escalado)
  - raw       (numeric crudo, opcional)
Timestamp:    now()
```

### Nodo `influxdb3 out` JSON template

Agregar después de cada función "Normalización y Formato" en tu flow, en paralelo al `websocket out`:

```json
{
  "id": "influxdb3-out-energia",
  "type": "influxdb3-out",
  "z": "4874f57ef714a0ef",
  "g": "f2ccadb7086f9a93",
  "name": "→ Influx dashboard_signals",
  "host": "http://influxdb3:8181",
  "token": "<TU_INFLUX_TOKEN>",
  "database": "corona2026",
  "measurement": "dashboard_signals",
  "useTags": true,
  "x": 710,
  "y": 95,
  "wires": []
}
```

### Transformación payload antes del nodo Influx

Después del Function "Normalizacion y Formato" agregar otro Function que convierta:

```javascript
// Function "to influx points" — split objeto a points
const data = msg.payload.dashboard_energia || msg.payload.dashboard_produccion || {};
const area = msg.payload.dashboard_energia ? 'energia' : 'produccion';
const points = [];

for (const [key, item] of Object.entries(data)) {
  if (typeof item.value === 'number' && Number.isFinite(item.value)) {
    points.push({
      measurement: 'dashboard_signals',
      tags: { area, key },
      fields: {
        value: item.value,
        raw: typeof item.raw === 'number' ? item.raw : null,
      },
      // timestamp opcional, InfluxDB usa now() si omit
    });
  }
}

msg.payload = points;
return msg;
```

### Flow final por área

```
[MQTT in: corona_kep2025/panel/energia]
   ↓
[Function: normalizacion + escalado]   ← ya existe
   ↓
   ├─→ [websocket out → backend Ingenio Cloud]   ← snapshot tiempo real
   │
   └─→ [Function: build influx points]
          ↓
       [influxdb3 out: dashboard_signals]   ← histórico
```

---

## Retention policies InfluxDB (a configurar)

```sql
-- En InfluxDB 3 / Influx Cloud Serverless (CLI o UI)

-- Raw 90 días (alta resolución)
CREATE RETENTION POLICY "raw_90d" ON "corona2026" DURATION 90d REPLICATION 1 DEFAULT;

-- Downsample 5min agregado, retention 1 año
-- Crear task de continuous query (Influx 3 usa SQL task scheduler):
CREATE TASK downsample_5m EVERY 5 MINUTES AS
INSERT INTO dashboard_signals_5m
SELECT
  DATE_BIN(INTERVAL '5 minutes', time) AS time,
  area, key,
  AVG(value) AS value_avg,
  MIN(value) AS value_min,
  MAX(value) AS value_max,
  COUNT(*) AS samples
FROM dashboard_signals
WHERE time >= NOW() - INTERVAL '5 minutes'
GROUP BY 1, area, key;

-- Downsample 1h agregado, retention 5 años
-- (similar para 1h)
```

**Pendiente humano (cuando arrancamos histórico):** habilitar estos tasks Influx.

---

## Endpoint `/api/metrics/history` (Sprint 1+)

Cuando frontend necesite sparklines o tendencias, backend expondrá:

```
GET /api/metrics/history?area=energia&key=Potencia_WEG&from=2026-05-15T10:00:00Z&to=2026-05-15T16:00:00Z&granularity=5m

Response:
{
  "area": "energia",
  "key": "Potencia_WEG",
  "points": [
    { "time": "2026-05-15T10:00:00Z", "value": 6.7, "min": 6.5, "max": 6.9 },
    { "time": "2026-05-15T10:05:00Z", "value": 6.8, ... }
  ]
}
```

Backend hace:
1. Validate auth (JWT user) + RLS (tenant_id de JWT vs metadata key)
2. Query InfluxDB SQL/Flux
3. Cache 60s memoria
4. Return points

---

## Tamaño estimado

```
35 sensores × 1 punto/segundo = 35 puntos/s
35 × 86400 = ~3M puntos/día
3M × 365 = ~1.1B puntos/año

InfluxDB compresión: ~1-2 GB/año (35 sensores)
Downsample 5min: ~200 MB/año
Downsample 1h:   ~20 MB/año
```

VPS 250 GB → cómodamente 10+ años raw + 30 años downsamples.

---

## Diagrama final

```
┌─────────────────────────────────────────────────────────────────┐
│ Stack VPS srv878399                                             │
│                                                                 │
│  ┌──────────────────────┐                                       │
│  │ EMQX (MQTT broker)   │ ← KEPServerEX / PLCs (ya existente)   │
│  └─────────┬────────────┘                                       │
│            │                                                    │
│  ┌─────────▼────────────┐                                       │
│  │ Node-RED             │  Flow "Datos Para Dashboard General" │
│  │  ├─ MQTT in panel/*  │                                       │
│  │  ├─ Function normaliza│                                      │
│  │  ├─→ WebSocket out ───┼──→ Ingenio Backend WS gateway        │
│  │  └─→ InfluxDB3 out ───┼──→ InfluxDB (NUEVO en flow)          │
│  └──────────────────────┘                                       │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │ InfluxDB 3           │  │ Supabase Postgres    │             │
│  │ corona2026.          │  │  industrial.         │             │
│  │   dashboard_signals  │  │    dashboard_data    │             │
│  │   (raw + downsamples)│  │    (snapshot UPSERT) │             │
│  └──────────┬───────────┘  └──────────┬───────────┘             │
│             │                         │                          │
│             │                         │ Realtime publish         │
│             │                         ▼                          │
│  ┌──────────▼───────────┐  ┌──────────────────────┐             │
│  │ Backend NestJS       │  │ Frontend Next.js     │             │
│  │ /api/metrics/history │◄─┤  Hook useDashboardData│             │
│  │ (S1+)                │  │  + sparklines (S1+)  │             │
│  │ Vigía-Anomaly (S1)   │  │                      │             │
│  └──────────────────────┘  └──────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Checklist Sprint 0 (estado actual)

- [x] Postgres `dashboard_data` creado + RLS + Realtime
- [x] WS gateway recibe + upsert snapshot
- [x] Frontend muestra snapshot tiempo real
- [ ] **Node-RED agrega `influxdb3 out` al flow** ← acción tuya
- [ ] Retention policy Influx (90d raw + downsamples) ← cuando confirme funciona escritura

## Pendiente Sprint 1+

- [ ] Endpoint `/api/metrics/history` lee Influx
- [ ] Hook frontend `useMetricHistory(key, from, to)` para sparklines
- [ ] Vigía-Anomaly lee Influx raw 15min ventana
- [ ] Continuous query Influx para downsamples

---

**Última actualización:** 2026-05-15
