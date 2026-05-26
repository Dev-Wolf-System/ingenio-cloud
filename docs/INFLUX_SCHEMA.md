# InfluxDB 3 — Schema y Conocimiento Operativo

> Documento de referencia para integración Ingenio Cloud ↔ InfluxDB 3.
> Última exploración: 2026-05-26.

---

## 1. Conexión

### Producción (backend NestJS — docker network interno)
```
INFLUX_URL      = http://influxdb3:8181
INFLUX_DATABASE = corona2026
INFLUX_TOKEN    = <admin token apiv3_...>
```

### Testing/exploración (Tailscale, solo dev)
```
TAILSCALE_VPS_IP = 100.114.203.70   (hostname: ingenio-vps)
INFLUX_URL       = http://100.114.203.70:18181
INFLUX_TOKEN     = apiv3_1jAxpOlBQME6vGkD-7D3KsHcTQ9EwO8MplogDVn43ZcjMOVi9rl2oH2qmQPy7rBMopPbVv0vUlcWZykTIODTKg
INFLUX_DATABASE  = corona2026
```

**Regla**: la app SIEMPRE usa la URL interna docker. Tailscale solo para queries de descubrimiento/comparación desde herramientas dev.

### Endpoint REST
```
POST {INFLUX_URL}/api/v3/query_sql
Headers:
  Authorization: Bearer {TOKEN}
  Content-Type: application/json
Body:
  { "q": "<SQL>", "db": "corona2026" }
```

Devuelve JSON array de filas.

---

## 2. Versión y sintaxis

- **InfluxDB 3.x** (token `apiv3_` prefix).
- Sintaxis: **SQL nativo** (DataFusion), no Flux ni InfluxQL.
- Soporta:
  - `now() - INTERVAL '5 minutes'`
  - `date_bin(INTERVAL '1 hour', time, TIMESTAMP '1970-01-01T00:00:00Z')`
  - `AVG`, `SUM`, `MAX`, `MIN`, `LAST_VALUE`, etc.
  - `information_schema.columns` para metadata.

---

## 3. Patrón schema — long format uniforme

Todas las tablas siguen el mismo patrón "tag + field":

| Columna | Tipo | Rol |
|---------|------|-----|
| `time` | Timestamp(ns) | timestamp |
| `area` | Dictionary | tag — área lógica (caldera, trapiche, fabricacion, electrica) |
| `sector` | Dictionary | tag — sub-área |
| `equipo` | Dictionary | tag — equipo/PLC |
| `variable` | Dictionary | tag — identificador único de la medición |
| `alias` | Dictionary | tag — nombre legible (opcional, solo en algunas tablas) |
| `unit` | Dictionary | tag — unidad (opcional, solo en algunas tablas) |
| `origen` | Dictionary | tag — fuente PLC/SCADA |
| `value` | Float64 | field — valor convertido |
| `raw` | Float64 | field — valor crudo PLC |
| `calidad` | Float64 | field — calidad del dato |

> Una fila = una medición de un sensor en un instante.
> `variable` es el identificador clave para queries.

---

## 4. Tablas (measurements)

```sql
SHOW TABLES;
```

### Tablas reales con datos vivos

| Tabla | Cols extra | Status | Descripción |
|-------|------------|--------|-------------|
| `calderas` | alias, unit | ✅ vivo | Calderas + sistema vapor |
| `trapiche` | alias, unit | ✅ vivo | Trapiche, molinos, cinta caña |
| `fabrica` | — | ✅ vivo | Fabricación, clarificación, condensados |
| `electrica` | — | ✅ vivo | Usina (Skoda/Siemens/WEG/EDET) |
| `molino1` | — | ⚠️ vacío 5min | Molino 1 (sin escritura reciente) |
| `dashboard-general-energia` | alias, unit | ❓ | Agregados energía |
| `dashboard-general-produccion` | alias, unit | ❓ | Agregados producción |
| `dashboard-general-trapiche` | alias, unit | ❓ | Agregados trapiche |

### Tablas sistema (ignorar)
`distinct_caches`, `influxdb_schema`, `last_caches`, `parquet_files`,
`processing_engine_*`, `queries`, + `information_schema.*`.

---

## 5. Variables vivas por tabla

### `calderas` — vapor y calderas (~19+ variables)

**Vapor** (`area=caldera`, `sector=claderas`, `equipo=vapor`):
- `vapor.vapor.vapor_alta_presion` (Bar)
- `vapor.vapor.vapor_baja_presion` (Bar)
- `vapor.vapor.vapor_auxilio_caudal` (Tn/H)
- `vapor.vapor.vapor_destileria_caudal` (Th/H)
- `vapor.vapor.vapor_destileria_presion` (Bar)
- `vapor.vapor.vapor_destileria_temp` (°C)
- `vapor.vapor.vapor_escape_aux_presion` (Bar)
- `vapor.vapor.vapor_reducido_caudal` (Tn/H)
- `vapor.vapor.vapor_tamiz_presion` (Bar)
- `vapor.vapor.vapor_termo_dest_caudal` (Tn/H)
- `vapor.vapor.vapor_trapiche_caudal` (Tn/H)
- `vapor.vapor.vapor_usina_alta_caudal` (Tn/H)
- `vapor.vapor.vapor_usina_baja_caudal` (Tn/H)

**PLC caldera** (`area=cladera`, `sector=calderas`, `equipo=plc_caldera`):
- `caldera.Caldera.cald_agua_aliment1_presion` (Bar)
- `caldera.Caldera.cald_agua_aliment2_presion` (Bar)
- `caldera.Caldera.cald_aire_presion` (Bar)
- `caldera.Caldera.cald_reserva_nivel` (%)
- `caldera.Caldera.cald_vapor_alta_presion` (Bar)
- `caldera.Caldera.cald_vapor_baja_presion` (Bar)

**Gas calderas individuales** (usado por `InfluxGasService`, en `dashboard-general-energia`):
- `caldera2.caldera2.cald2_gas_caudal`
- `caldera3.caldera3.cald3_gas_caudal`
- `caldera6.caldera6.cald6_gas_caudal`

### `trapiche` — molinos y mesas (~7 variables)

**Mesas** (`area=trapiche`, `sector=mesas`, `equipo=plc_cabina`):
- `trapiche_cabina.trapiche_cabina.trap_cinta` (raw)
- `trapiche_cabina.trapiche_cabina.trap_conductor` (raw)
- `trapiche_cabina.trapiche_cabina.trap_pateador` (raw)
- `trapiche_cabina.trapiche_cabina.trap_tambor` (raw)

**Molinos** (`area=trapiche`, `sector=molinos`, `equipo=1er_molino`):
- `trapiche_cabina.trapiche_cabina.trap_molino1_presion_este` (Kg/cm²)
- `trapiche_cabina.trapiche_cabina.trap_molino1_presion_oeste` (Kg/cm²)
- `trapiche_molino.trapiche_molino.trap_molino1_OUT` (rpm)

### `fabrica` — fabricación, clarificación (~18+ variables)

**Clarificación 3** (`sector=clarificacion`, `equipo=plc_clarificacion_1-2-3`):
- `Clarificacion3.Clarificacion3.clar3_calentador13_temp`
- `Clarificacion3.Clarificacion3.clar3_encalado_ph`
- `Clarificacion3.Clarificacion3.clar3_jugo_encalado_presion`
- `Clarificacion3.Clarificacion3.clar3_sulfitado_presion`
- `Clarificacion3.Clarificacion3.clar3_tanque_cal_nivel`

**Fábrica principal** (`sector=fabrica`, `equipo=plc_fabrica`):
- `fabrica.fabrica.Fab_cond_escape_arrastre`
- `fabrica.fabrica.Fab_cond_escape_nivel`
- `fabrica.fabrica.Fab_cond_vegetal_arrastre`
- `fabrica.fabrica.Fab_cond_vegetal_nivel`
- `fabrica.fabrica.Fab_jugo_clarificado_caudal`
- `fabrica.fabrica.Fab_jugo_clarificado_nivel`
- `fabrica.fabrica.Fab_jugo_clarificado_temp`
- `fabrica.fabrica.Tacho_melado_evaporacion_nivel1`
- `fabrica_bb.fabrica_bb.Fab_agua_condensadores_presion`
- `fabrica_bb.fabrica_bb.Fab_agua_industrial_nivel`
- `fabrica_bb.fabrica_bb.Fab_agua_industrial_norte_temp`
- `fabrica_bb.fabrica_bb.Fab_agua_industrial_presion`
- `fabrica_bb.fabrica_bb.Fab_agua_industrial_sur_temp`

### `electrica` — usina (~37 variables)

**EDET** (`sector=usina`, `equipo=edet`):
- `skoda.skoda.Factor_Potencia_Total_edet`
- `skoda.skoda.Frecuencia_edet`
- `skoda.skoda.Intensidad_Fase1_edet` / `_Fase2` / `_Fase3` / `_Media`
- `skoda.skoda.Potencia_Activa_Total_edet`
- `skoda.skoda.Potencia_Aparente_Total_edet`
- `skoda.skoda.Potencia_Reactiva_Total_edet`
- `skoda.skoda.Tension_Media_L_L_edet`
- `skoda.skoda.Tension_Media_L_N_edet`

**Generador Siemens** (`equipo=generador_siemens`):
- `siemens.siemens.siemens_Intensidad_fase1/2/3/media`
- `siemens.siemens.siemens_factor_potencia`
- `siemens.siemens.siemens_frecuencia`
- `siemens.siemens.siemens_potencia_activa/reactiva/aparente`
- `siemens.siemens.siemens_tension_LL` / `_LN`
- `siemens.siemens.siemens_vapor_directo_presion`
- `siemens.siemens.siemens_vapor_escape_presion`

**Generador WEG** (`equipo=generador_weg`):
- `weg.weg.WEG_Intensidad_fase1/2/3/media`
- `weg.weg.WEG_factor_potencia`
- `weg.weg.WEG_frecuencia`
- `weg.weg.WEG_potencia_activa/reactiva/aparente`
- `weg.weg.WEG_tension_LL` / `_LN`
- `weg.weg.WEG_velocidad`
- `skoda.skoda.Potencia_Activa_Total_AEG` (legacy mezclado)

---

## 6. Queries patrón

### Listar tablas
```sql
SHOW TABLES;
```

### Listar columnas de tabla
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'trapiche'
ORDER BY column_name;
```

### Descubrir variables vivas (últimos 5min)
```sql
SELECT DISTINCT area, sector, equipo, variable, alias, unit
FROM "calderas"
WHERE time >= now() - INTERVAL '5 minutes'
ORDER BY area, sector, equipo, variable;
```

> ⚠️ Las tablas sin `alias`/`unit` (fabrica, molino1, electrica) **rompen** este query — quitar esos campos del SELECT.

### Latest value de un sensor
```sql
SELECT time, value, unit, alias
FROM "calderas"
WHERE variable = 'vapor.vapor.vapor_alta_presion'
ORDER BY time DESC
LIMIT 1;
```

### Serie temporal agregada por minuto (última hora)
```sql
SELECT
  date_bin(INTERVAL '1 minute', time, TIMESTAMP '1970-01-01T00:00:00Z') AS bucket,
  AVG(value) AS v_avg,
  MAX(value) AS v_max,
  MIN(value) AS v_min
FROM "electrica"
WHERE variable = 'weg.weg.WEG_potencia_activa'
  AND time >= now() - INTERVAL '1 hour'
GROUP BY 1
ORDER BY 1;
```

### Múltiples variables en una query
```sql
SELECT time, variable, value
FROM "calderas"
WHERE variable IN (
  'vapor.vapor.vapor_alta_presion',
  'vapor.vapor.vapor_baja_presion',
  'vapor.vapor.vapor_trapiche_caudal'
)
AND time >= now() - INTERVAL '1 hour'
ORDER BY time;
```

### Suma de gas calderas (ejemplo InfluxGasService)
```sql
SELECT
  date_bin(INTERVAL '1 hour', time, TIMESTAMP '1970-01-01T00:00:00Z')
    + INTERVAL '1 hour' AS ts_hora_utc,
  AVG("caldera2.caldera2.cald2_gas_caudal")
    + AVG("caldera3.caldera3.cald3_gas_caudal")
    + AVG("caldera6.caldera6.cald6_gas_caudal") AS gas_total_m3h
FROM "dashboard-general-energia"
WHERE time >= now() - INTERVAL '20 hours'
GROUP BY 1
ORDER BY 1;
```

> Este pattern (`AVG("col")`) **trata la variable como columna**, lo cual funciona en
> `dashboard-general-*` (formato wide) pero NO en tablas long-format (`calderas`, `trapiche`, etc.).
> Para long format usar `WHERE variable = '...'` y luego `AVG(value)`.

---

## 7. Zona horaria

- Influx almacena timestamps en **UTC** (`Timestamp(ns)`).
- Hora local Ingenio: **ART (UTC-3)** sin DST.
- Conversión backend:
  ```ts
  const ART_OFFSET_MS = -3 * 60 * 60 * 1000;
  const utcToArt = (d: Date) => new Date(d.getTime() + ART_OFFSET_MS);
  ```
- Día industrial: comienza **07:00 ART** = **10:00 UTC** (ver `corona-dia-industrial.md`).

---

## 8. Integración actual

### Servicios existentes
- `backend/src/modules/influx/influx.module.ts` — módulo NestJS
- `backend/src/modules/influx/influx-gas.service.ts` — fetch gas calderas + upsert Supabase
- `scheduler.service.ts` — cron que llama `syncGasEstimado()`

### Pattern fetch (TypeScript)
```ts
const res = await fetch(`${host}/api/v3/query_sql`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify({ q: sql, db: database }),
  signal: AbortSignal.timeout(10_000),
});
const rows = await res.json();  // Array<row>
```

---

## 9. Caveats / gotchas

1. **`alias` y `unit`** NO existen en `fabrica`, `molino1`, `electrica`. Construir queries dinámicas o usar `SELECT *` con cuidado.
2. **`area`** está mal escrito en algunos lugares: `cladera` (sic) vs `caldera`. Filtrar con tolerancia.
3. **`molino1` table** vacía en últimos 5min — confirmar si dejó de escribir o tiene baja frecuencia.
4. **Variable names** llevan namespace doble (`namespace.namespace.var_name`) — copiar literal del descubrimiento.
5. **Filtrar SIEMPRE por `time >=`** — sin ese filtro Influx escanea todo y se cae.
6. **`dashboard-general-*`** parecen tener formato wide (columnas por variable) — confirmar antes de usar.
7. **Tokens `apiv3_`** son v3, no compatibles con SDK clásico `@influxdata/influxdb-client`. Usar fetch directo o cliente v3.

---

## 10. Arquitectura propuesta (pendiente confirmación)

### Backend
```
backend/src/modules/influx/
├── influx.module.ts                (existente)
├── influx-query.service.ts ← NEW   cliente genérico /api/v3/query_sql
├── influx-realtime.service.ts ← NEW cache + last-value por sensor
├── influx.controller.ts ← NEW      endpoints REST
├── influx.gateway.ts ← NEW (opt)   WS realtime
├── influx.types.ts
└── influx-gas.service.ts           (existente, refactor para usar query service)
```

### Endpoints REST propuestos
```
GET  /api/influx/schema                                ← measurements + columns
GET  /api/influx/variables?area=&sector=               ← variables filtradas
GET  /api/influx/latest?sensor=                        ← último valor
GET  /api/influx/series?sensor=&from=&to=&agg=1m       ← serie temporal
POST /api/influx/multi-series  body:{sensors[],range}  ← N sensores 1 request
WS   /ws/influx                                        ← stream realtime (opt)
```

### Config sensores (tabla Supabase propuesta)
```sql
CREATE TABLE production.sensores_dashboard (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variable      text NOT NULL UNIQUE,    -- ej: 'vapor.vapor.vapor_alta_presion'
  tabla         text NOT NULL,           -- ej: 'calderas'
  display_name  text NOT NULL,           -- ej: 'Vapor Alta Presión'
  unidad        text,                    -- 'Bar', 'Tn/H', '°C', etc.
  area          text,                    -- 'electrica', 'vapor', etc.
  grupo         text,                    -- agrupación visual
  min_alarma    numeric,
  max_alarma    numeric,
  decimales     int DEFAULT 2,
  orden         int DEFAULT 0,
  activo        bool DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
```

---

## 11. Deploy en VPS

### Estado infra actual
- Container Influx: `influxdb3` (hostname interno)
- Puerto interno: `8181`
- Network: debe estar en **`n8n_evoapi`** para que `http://influxdb3:8181` resuelva desde `ingenio-backend`
- Tailscale port (solo dev/exploración): `18181` (NO usar en backend)

### Pre-deploy checklist

```bash
# 1. Verificar que influxdb3 está en la network correcta
docker network inspect n8n_evoapi | grep -A 3 influxdb3
# si NO aparece → conectarlo:
docker network connect n8n_evoapi influxdb3

# 2. Verificar resolución DNS desde otro container de la network
docker exec ingenio-backend getent hosts influxdb3
# debe devolver IP interna

# 3. Verificar .env tiene INFLUX_TOKEN
grep INFLUX_TOKEN /opt/ingenio-cloud/.env
# si vacío → completar con token admin apiv3_...

# 4. Build + restart backend
cd /opt/ingenio-cloud/infra
docker compose --env-file ../.env build ingenio-backend
docker compose --env-file ../.env up -d ingenio-backend
```

### Verificación post-deploy

```bash
# Endpoint health Influx
curl -s https://ingcloud.srv878399.hstgr.cloud/api/health/influx | jq

# Respuesta esperada:
# {
#   "status": "ok",
#   "url": "http://influxdb3:8181",
#   "database": "corona2026",
#   "hasToken": true,
#   "reachable": true,
#   "latencyMs": <30,
#   "tables": ["calderas","dashboard-general-energia",...]
# }
```

### Diagnóstico fallas comunes

| Síntoma | Causa probable | Fix |
|---------|----------------|-----|
| `status: down`, `error: token no configurado` | `.env` sin `INFLUX_TOKEN` | completar `.env` + restart |
| `status: down`, `error: ping fallido` | DNS no resuelve `influxdb3` | conectar container a `n8n_evoapi` |
| `status: down`, latency `>5000` | Influx caído o network bloqueada | revisar `docker logs influxdb3` |
| `status: degraded`, `tables: []` | Conectó pero database vacío o name distinto | verificar `INFLUX_DATABASE=corona2026` |

### Logs backend Influx
```bash
docker logs ingenio-backend 2>&1 | grep -iE "influx" | tail -20
# al boot debe mostrar:
# [InfluxQueryService] Influx OK → http://influxdb3:8181 (db=corona2026)
```

---

## 12. Servicios backend NestJS

```
backend/src/modules/influx/
├── influx.module.ts                 — registra todo, expuesto via AppModule
├── influx-query.service.ts          — cliente genérico /api/v3/query_sql
├── influx-health.controller.ts      — endpoint GET /api/health/influx
└── influx-gas.service.ts            — caso uso específico gas calderas
```

### Uso del cliente genérico

```ts
import { InfluxQueryService } from '@/modules/influx/influx-query.service';

@Injectable()
export class MiServicio {
  constructor(private readonly influx: InfluxQueryService) {}

  async getCurrentLoad() {
    const rows = await this.influx.query<{ time: string; value: number }>(`
      SELECT time, value FROM "electrica"
      WHERE variable = 'weg.weg.WEG_potencia_activa'
        AND time >= now() - INTERVAL '1 minute'
      ORDER BY time DESC LIMIT 1
    `);
    return rows[0] ?? null;
  }
}
```

API del service:
- `query<T>(sql, opts?)` → `Promise<T[]>`
- `ping()` → `Promise<boolean>`
- `listTables()` → `Promise<string[]>`
- `listColumns(table)` → `Promise<Array<{column_name, data_type}>>`
- `getConnectionInfo()` → `{ url, database, hasToken, configured }`

Logs y errores capturados automáticamente. Timeouts: default 10s, override con `opts.timeoutMs`.

---

## 13. Histórico exploraciones

| Fecha | Hallazgo |
|-------|----------|
| 2026-05-26 | Descubrimiento inicial schema, listado completo variables vivas, confirmación versión v3. |
| 2026-05-26 | Creado `InfluxQueryService` genérico + `InfluxHealthController` + refactor `InfluxGasService` para usar cliente compartido. |
