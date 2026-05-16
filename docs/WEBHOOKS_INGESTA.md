# Webhooks Ingesta — Especificación envío sensores desde Node-RED

> **Origen real:** Node-RED (corre en stack `n8n_evoapi`, recibe MQTT desde EMQX y agrupa lecturas).
>
> Endpoints operativos en `https://api.ingcloud.srv878399.hstgr.cloud/api/webhooks/ingest/*` post-deploy.
>
> **Paths alias aceptados** (todos apuntan al mismo controller):
> - `/webhooks/ingest/*` ← canónico recomendado
> - `/webhooks/node-red/*`
> - `/webhooks/n8n/*` ← compatibilidad
>
> **Valores enviados deben venir ya escalados** desde Node-RED. Backend no reescala (Sprint 2+ admin panel agregará scale_factor + offset editable por tenant).

---

## 1. Autenticación

Todos los webhooks requieren header:

```
x-webhook-secret: <N8N_WEBHOOK_SECRET>
```

Si falla → 401 Unauthorized.
Rate limit: 60 req/min por IP (metrics), 12 req/min (mill-speed).

---

## 2. `POST /api/webhooks/ingest/metrics-energy`

Recibe lecturas agrupadas de los **10 sensores base de energía**. El backend calcula automáticamente `caudal_total_vapor` y `generacion_total` (derivados).

### Payload

```json
{
  "tenant_slug": "lacorona",
  "plant_slug": "planta-sur",
  "source": "node-red",
  "timestamp": "2026-05-15T14:32:17Z",
  "metrics": [
    { "sensor_id": "caudal_caldera_2",          "value": 62.3 },
    { "sensor_id": "caudal_caldera_3",          "value": 58.1 },
    { "sensor_id": "caudal_caldera_6",          "value": 65.0 },
    { "sensor_id": "presion_alta_baja",         "value": 19.2 },
    { "sensor_id": "presion_escape",            "value": 2.1 },
    { "sensor_id": "presion_vg1",               "value": 8.4 },
    { "sensor_id": "temp_agua_alimentacion",    "value": 105.2 },
    { "sensor_id": "presion_agua_alimentacion", "value": 14.2 },
    { "sensor_id": "potencia_weg",              "value": 6.8 },
    { "sensor_id": "potencia_siemens",          "value": 5.6 },
    { "sensor_id": "gas_actual",                "value": 320 },
    { "sensor_id": "gas_acumulado_dia",         "value": 4820 }
  ]
}
```

### Campos

| Campo | Tipo | Obligatorio | Default | Descripción |
|---|---|---|---|---|
| `tenant_slug` | string | No | `lacorona` | Slug del tenant |
| `plant_slug` | string | No | `planta-sur` | Slug planta |
| `source` | string | No | `n8n` | Origen (auditoría) |
| `timestamp` | ISO 8601 | No | `now()` server | Timestamp lectura |
| `metrics[]` | array | Sí (≥1, ≤100) | — | Lecturas |
| `metrics[].sensor_id` | string | Sí | — | ID exacto del catálogo |
| `metrics[].value` | number/string | Sí | — | Valor escalado |

### Response 200 OK

```json
{ "ingested": 12, "timestamp": "2026-05-15T14:32:17Z" }
```

---

## 3. `POST /api/webhooks/ingest/metrics-production`

Recibe los **21 sensores de producción**.

### Payload (mismo formato)

```json
{
  "tenant_slug": "lacorona",
  "plant_slug": "planta-sur",
  "timestamp": "2026-05-15T14:32:17Z",
  "metrics": [
    { "sensor_id": "nivel_jugo_pesado",      "value": 78 },
    { "sensor_id": "ph_jugo",                "value": 6.5 },
    { "sensor_id": "sulfitado",              "value": 105 },
    { "sensor_id": "temp_ultimo_calentador", "value": 104.2 },
    { "sensor_id": "pol_cachaza",            "value": 1.3 },
    { "sensor_id": "nivel_jugo_clarificado", "value": 62 },
    { "sensor_id": "caudal_jugo_clarificado","value": 285 },
    { "sensor_id": "caudal_jugo_destileria", "value": 32 },
    { "sensor_id": "nivel_melado_tratado",   "value": 45 },
    { "sensor_id": "nivel_melado_1_2",       "value": 50 },
    { "sensor_id": "nivel_cristalizador_1ra","value": 71 },
    { "sensor_id": "produccion_azucar_diaria","value": 9739 },
    { "sensor_id": "color_azucar_icumsa",    "value": 95 },
    { "sensor_id": "humedad_azucar",         "value": 0.05 },
    { "sensor_id": "caudal_alcohol",         "value": 2800 },
    { "sensor_id": "caudal_vino_destilado",  "value": 850 },
    { "sensor_id": "caudal_buen_gusto",      "value": 120 },
    { "sensor_id": "vapor_destileria_k2",    "value": 2.4 },
    { "sensor_id": "nivel_agua_foza",        "value": 55 },
    { "sensor_id": "aire_destileria",        "value": 6.2 },
    { "sensor_id": "promedio_molienda_actual","value": 6629 }
  ]
}
```

---

## 4. `POST /api/webhooks/ingest/shift/mill-speed`

Velocidad del primer molino del turno previo. Se envía **1 vez al cierre de turno** (05:01 / 13:01 / 21:01 hora AR).

Header obligatorio:
```
x-webhook-secret: <MILL_SPEED_WEBHOOK_SECRET>
```

### Payload

```json
{
  "tenant_slug": "lacorona",
  "plant_slug": "planta-sur",
  "shift": "morning",
  "shift_date": "2026-05-15",
  "promedio_rpm": 4.8,
  "samples": [
    { "timestamp": "2026-05-15T05:01:00-03:00", "rpm": 4.7 },
    { "timestamp": "2026-05-15T05:02:00-03:00", "rpm": 4.8 },
    { "timestamp": "2026-05-15T05:03:00-03:00", "rpm": 4.9 }
  ]
}
```

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `shift` | enum | Sí | `morning`/`afternoon`/`night` |
| `shift_date` | YYYY-MM-DD | Sí | Fecha de inicio del turno previo |
| `promedio_rpm` | number | Sí | Promedio cierre |
| `samples[]` | array | Sí (≥1) | Serie tiempo para gráfica sparkline |

### Response 200 OK

```json
{ "ok": true }
```

---

## 5. Catálogo completo `sensor_id` válidos

### ENERGÍA (10 base + 2 derivados = 12 sensores expuestos)

| sensor_id | unit | Notas |
|---|---|---|
| `caudal_caldera_2` | t/h | |
| `caudal_caldera_3` | t/h | |
| `caudal_caldera_6` | t/h | |
| `caudal_total_vapor` | t/h | **Calculado server** = c2+c3+c6 |
| `presion_alta_baja` | bar | |
| `presion_escape` | bar | |
| `presion_vg1` | bar | |
| `temp_agua_alimentacion` | °C | |
| `presion_agua_alimentacion` | bar | |
| `potencia_weg` | MW | |
| `potencia_siemens` | MW | |
| `generacion_total` | MW | **Calculado server** = weg+siemens |
| `gas_actual` | m³/h | |
| `gas_acumulado_dia` | m³ | |

### PRODUCCIÓN (21 sensores)

| sensor_id | unit |
|---|---|
| `nivel_jugo_pesado` | % |
| `ph_jugo` | pH |
| `sulfitado` | ppm |
| `temp_ultimo_calentador` | °C |
| `pol_cachaza` | % |
| `nivel_jugo_clarificado` | % |
| `caudal_jugo_clarificado` | t/h |
| `caudal_jugo_destileria` | t/h |
| `nivel_melado_tratado` | % |
| `nivel_melado_1_2` | % |
| `nivel_cristalizador_1ra` | % |
| `produccion_azucar_diaria` | bolsas |
| `color_azucar_icumsa` | ICUMSA |
| `humedad_azucar` | % |
| `caudal_alcohol` | L/h |
| `caudal_vino_destilado` | m3/h |
| `caudal_buen_gusto` | m3/h |
| `vapor_destileria_k2` | kg |
| `nivel_agua_foza` | % |
| `aire_destileria` | bar |
| `promedio_molienda_actual` | t/h |

---

## 6. Errores comunes

| Status | Causa | Solución |
|---|---|---|
| 401 | Header `x-webhook-secret` falta o incorrecto | Verificar valor `N8N_WEBHOOK_SECRET` env |
| 400 | Payload no pasa schema zod | Ver `issues` en response, validar formato |
| 429 | Rate limit excedido | Reducir frecuencia, agrupar más sensores por request |
| 500 | Error interno (Supabase, etc.) | Ver logs container `ingenio-backend` |

---

## 7. Frecuencia recomendada

| Endpoint | Frecuencia Node-RED |
|---|---|
| `metrics-energy` | cada 5 segundos (agrupar batch MQTT) |
| `metrics-production` | cada 5 segundos |
| `shift/mill-speed` | 1x cada cierre de turno (05:01, 13:01, 21:01 ART) |

---

## 8. Estado actual

- **Backend código:** ✅ listo (NestJS, validación zod, upsert Supabase, history append)
- **Endpoints accesibles:** ⏸ esperando deploy a VPS
- **Secrets:** generar y compartir antes de deploy

```bash
# Generar secrets:
openssl rand -hex 32        # → N8N_WEBHOOK_SECRET
openssl rand -hex 32        # → MILL_SPEED_WEBHOOK_SECRET
```
