# Ingenio Cloud — Guía Operativa

> Instructivo único: correr local + deploy producción + listado endpoints + troubleshooting.
> Versión: 0.1.0 · Fecha: 2026-05-15

---

## Índice

1. [Pre-requisitos](#1-pre-requisitos)
2. [Correr en local](#2-correr-en-local)
3. [Deploy a VPS Hostinger](#3-deploy-a-vps-hostinger)
4. [Endpoints API](#4-endpoints-api)
5. [Webhooks n8n — formato payloads](#5-webhooks-n8n--formato-payloads)
6. [Catálogo sensor_id válidos](#6-catálogo-sensor_id-válidos)
7. [Variables de entorno](#7-variables-de-entorno)
8. [Comandos útiles](#8-comandos-útiles)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Pre-requisitos

### Local
- **Node.js 20 LTS** (`node --version` → v20.x)
- **npm 10+** (incluido con Node 20)
- **Tailscale** activo (para acceder MSSQL CORONA en `192.168.0.177` — opcional, sin él endpoints MSSQL devuelven `error`)
- Conexión a Supabase production (`https://ingenio-supabase.srv878399.hstgr.cloud`)

### VPS Hostinger srv878399
- Docker + Docker Compose v2
- Traefik corriendo en red externa `n8n_evoapi` con certresolver `mytlschallenge`
- Supabase self-hosted corriendo en red externa `supabase_network`
- DNS subdominio `ingcloud.srv878399.hstgr.cloud` y `api.ingcloud.srv878399.hstgr.cloud` apuntando al VPS

---

## 2. Correr en local

### 2.1 Levantar backend

```bash
cd ingenio-cloud/backend
npm install            # primera vez (871 packages)
npm run start:dev
```

Resultado esperado:
```
[Nest] LOG [SupabaseService] Supabase client initialised → https://ingenio-supabase.srv878399.hstgr.cloud
[Nest] LOG [MssqlService] MSSQL connected → 192.168.0.177/CORONA   (si MSSQL_PASSWORD definido)
[Nest] LOG [Bootstrap] 🚀 Ingenio backend listening on :3001
```

Backend escucha en `http://localhost:3001/api`.

### 2.2 Levantar frontend

```bash
cd ingenio-cloud/frontend
npm install            # primera vez
npm run dev
```

Resultado:
```
▲ Next.js 14.2.x
- Local:    http://localhost:3000
✓ Ready in 2.3s
```

Abrir browser: <http://localhost:3000>

### 2.3 Levantar ambos en paralelo (recomendado)

Terminal 1 → backend
Terminal 2 → frontend
Terminal 3 → libre para curls de test

### 2.4 Test rápido — simular n8n

```bash
# Webhook secret dev: dev-n8n-webhook-secret-32chars
curl -X POST http://localhost:3001/api/webhooks/ingest/metrics-energy \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev-n8n-webhook-secret-32chars" \
  -d '{
    "metrics": [
      { "sensor_id": "caudal_caldera_2", "value": 62.3 },
      { "sensor_id": "caudal_caldera_3", "value": 58.1 },
      { "sensor_id": "caudal_caldera_6", "value": 65.0 },
      { "sensor_id": "potencia_weg", "value": 6.8 },
      { "sensor_id": "potencia_siemens", "value": 5.6 }
    ]
  }'
```

Esperado: `{ "ingested": 7, "timestamp": "..." }` (5 enviados + 2 calculados auto: `caudal_total_vapor`, `generacion_total`)

→ Panel browser actualiza en tiempo real vía Supabase Realtime.

### 2.5 Build local production

```bash
# Backend
cd ingenio-cloud/backend
npm run build
node dist/main.js

# Frontend
cd ingenio-cloud/frontend
npm run build
npm run start              # standalone build
```

### 2.6 Docker local (sin levantar stack completo)

```bash
cd ingenio-cloud

# Backend image
docker build -t ingenio-backend:local ./backend

# Frontend image
docker build -t ingenio-frontend:local \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001/api \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://ingenio-supabase.srv878399.hstgr.cloud \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  ./frontend

# Run
docker run --rm -p 3001:3001 --env-file ./backend/.env.local ingenio-backend:local
docker run --rm -p 3000:3000 ingenio-frontend:local
```

---

## 3. Deploy a VPS Hostinger

### 3.1 Primera vez (setup)

```bash
# 1. SSH al VPS
ssh root@srv878399.hstgr.cloud

# 2. Clonar repo (asumiendo repo privado configurado con SSH key)
mkdir -p /opt/ingenio-cloud
cd /opt
git clone <github-url> ingenio-cloud
cd ingenio-cloud

# 3. Crear .env producción
cp .env.example .env
nano .env
# → completar credenciales producción reales
# → ver sección "Variables de entorno" abajo

# 4. Verificar redes externas existen
docker network ls | grep -E "n8n_evoapi|supabase_network"
# Si no existen → ya deberían estar por stack n8n + supabase existente

# 5. Build + up
docker compose --env-file ./.env build
docker compose --env-file ./.env up -d

# 6. Logs
docker compose --env-file ./.env logs -f ingenio-backend
docker compose --env-file ./.env logs -f ingenio-frontend

# 7. Verificar SSL Traefik
curl -I https://api.ingcloud.srv878399.hstgr.cloud/api/health
curl -I https://ingcloud.srv878399.hstgr.cloud
```

### 3.2 Actualización (deploy nuevo código)

```bash
ssh root@srv878399.hstgr.cloud
cd /opt/ingenio-cloud

# Pull cambios
git fetch --all
git reset --hard origin/main

# Rebuild + restart
docker compose --env-file ./.env build --pull
docker compose --env-file ./.env up -d --remove-orphans

# Limpiar imágenes viejas
docker image prune -af
```

### 3.3 Script automatizado `scripts/deploy.sh`

```bash
#!/bin/bash
set -e
cd /opt/ingenio-cloud
git fetch --all
git reset --hard origin/main
docker compose --env-file ./.env build --pull
docker compose --env-file ./.env up -d --remove-orphans
docker image prune -af
echo "✓ Deploy completo"
```

### 3.4 CI/CD GitHub Actions (opcional)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/ingenio-cloud
            bash scripts/deploy.sh
```

---

## 4. Endpoints API

**Base URL:**
- Local: `http://localhost:3001/api`
- Producción: `https://api.ingcloud.srv878399.hstgr.cloud/api`

### 4.0 WebSocket ingesta (Node-RED → Backend) **principal**

**3 endpoints WS separados** (configurar en cada `websocket out` node de Node-RED):

| Flow Node-RED | URL dev | URL producción | Payload key |
|---|---|---|---|
| Producción | `ws://localhost:3001/ws/dashboard/produccion` | `wss://api.ingcloud.srv878399.hstgr.cloud/ws/dashboard/produccion` | `dashboard_produccion` |
| Energía | `ws://localhost:3001/ws/dashboard/energia` | `wss://api.ingcloud.srv878399.hstgr.cloud/ws/dashboard/energia` | `dashboard_energia` |
| Vel molino 1 | `ws://localhost:3001/ws/dashboard/molino` | `wss://api.ingcloud.srv878399.hstgr.cloud/ws/dashboard/molino` | `{turno, labels, valores, promedio, ...}` |

**Auth opcional:** `?secret=<N8N_WEBHOOK_SECRET>` en URL o header `x-webhook-secret`. Si `N8N_WEBHOOK_SECRET` está vacío en `.env`, WS sin auth.

**Configuración nodo Node-RED `websocket out`:**
- Type: `Connect to`
- URL: una de las de arriba
- Send: `entire message`
- Payload: tal cual lo arma tu function (`{ dashboard_produccion: {...} }` o `{ dashboard_energia: {...} }` o el objeto vel molino)

Backend almacena en `industrial.dashboard_data` (energía/producción) o `industrial.shift_kpis_cache` (molino). Frontend lee via Supabase Realtime sin pasar por backend.

### 4.1 Webhooks HTTP (POST, fallback alternativo)

**Origen real:** Node-RED (vive en stack `n8n_evoapi`, recibe MQTT EMQX y agrupa).

**Paths aceptados (alias, todos apuntan al mismo controller):**
- `/webhooks/ingest/*` (canónico, recomendado)
- `/webhooks/node-red/*` (alias)
- `/webhooks/n8n/*` (alias compatibilidad)

Header obligatorio: `x-webhook-secret: <secret>`

| Método | Path canónico | Secret env | Rate limit | Descripción |
|---|---|---|---|---|
| POST | `/webhooks/ingest/metrics-energy` | `N8N_WEBHOOK_SECRET` | 60/min | Sensores ENERGÍA (10 base, calcula 2 derivados) |
| POST | `/webhooks/ingest/metrics-production` | `N8N_WEBHOOK_SECRET` | 60/min | Sensores PRODUCCIÓN (21) |
| POST | `/webhooks/ingest/shift/mill-speed` | `MILL_SPEED_WEBHOOK_SECRET` | 12/min | Velocidad primer molino (1x cierre turno) |

### 4.2 Consulta guardia (GET)

| Método | Path | Fuente | Cache TTL |
|---|---|---|---|
| GET | `/guardia/molienda` | HTTP externo `MOLIENDA_HTTP_URL` | 5 min |
| GET | `/guardia/gas-previo` | MSSQL CORONA | Hasta cambio turno |
| GET | `/guardia/paradas` | MSSQL CORONA | Hasta cambio turno |
| GET | `/guardia/vel-molino` | Supabase cache | Hasta cambio turno |

### 4.3 Métricas (GET)

| Método | Path | Descripción |
|---|---|---|
| GET | `/metrics/dashboard-snapshot?area=energia` | **Snapshot keys Node-RED dashboard energía** |
| GET | `/metrics/dashboard-snapshot?area=produccion` | **Snapshot keys Node-RED dashboard producción** |
| GET | `/metrics/snapshot?area=energia` | (legacy) sensores estructurados sensor_mapping |
| GET | `/metrics/snapshot?area=produccion` | (legacy) |
| GET | `/metrics/catalog` | (legacy) catálogo 35 sensores estructurado |

### 4.4 Alertas (GET)

| Método | Path | Descripción |
|---|---|---|
| GET | `/alerts/active` | Alertas activas (no resueltas) DESC por `detected_at` |

### 4.5 Health (GET)

| Método | Path | Descripción |
|---|---|---|
| GET | `/health` | Estado servicio + checks Supabase + MSSQL |

### 4.6 Códigos de respuesta

| Status | Causa |
|---|---|
| 200 | OK |
| 400 | Payload zod inválido — ver `issues` en response |
| 401 | `x-webhook-secret` falta/incorrecto |
| 429 | Rate limit excedido |
| 500 | Error interno (Supabase, MSSQL) — ver logs |

---

## 5. Webhooks n8n — formato payloads

### 5.1 `POST /webhooks/ingest/metrics-energy`

```json
{
  "tenant_slug": "lacorona",
  "plant_slug": "planta-sur",
  "source": "n8n",
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

Campos:
- `tenant_slug` opcional, default `"lacorona"`
- `plant_slug` opcional, default `"planta-sur"`
- `source` opcional, default `"n8n"`
- `timestamp` opcional, default `server.now()` ISO 8601
- `metrics[]` array obligatorio (1-100 items)
- `metrics[].sensor_id` string obligatorio
- `metrics[].value` number obligatorio (valor escalado final)

**Calculados auto server:** `caudal_total_vapor` (suma calderas 2+3+6) + `generacion_total` (weg + siemens).

Response:
```json
{ "ingested": 14, "timestamp": "2026-05-15T14:32:17Z" }
```

### 5.2 `POST /webhooks/ingest/metrics-production`

Mismo formato. 21 sensores producción.

```json
{
  "metrics": [
    { "sensor_id": "nivel_jugo_pesado",       "value": 78 },
    { "sensor_id": "ph_jugo",                 "value": 6.5 },
    { "sensor_id": "sulfitado",               "value": 105 },
    { "sensor_id": "temp_ultimo_calentador",  "value": 104.2 },
    { "sensor_id": "pol_cachaza",             "value": 1.3 },
    { "sensor_id": "nivel_jugo_clarificado",  "value": 62 },
    { "sensor_id": "caudal_jugo_clarificado", "value": 285 },
    { "sensor_id": "caudal_jugo_destileria",  "value": 32 },
    { "sensor_id": "nivel_melado_tratado",    "value": 45 },
    { "sensor_id": "nivel_melado_1_2",        "value": 50 },
    { "sensor_id": "nivel_cristalizador_1ra", "value": 71 },
    { "sensor_id": "produccion_azucar_diaria","value": 9739 },
    { "sensor_id": "color_azucar_icumsa",     "value": 95 },
    { "sensor_id": "humedad_azucar",          "value": 0.05 },
    { "sensor_id": "caudal_alcohol",          "value": 2800 },
    { "sensor_id": "caudal_vino_destilado",   "value": 850 },
    { "sensor_id": "caudal_buen_gusto",       "value": 120 },
    { "sensor_id": "vapor_destileria_k2",     "value": 2.4 },
    { "sensor_id": "nivel_agua_foza",         "value": 55 },
    { "sensor_id": "aire_destileria",         "value": 6.2 },
    { "sensor_id": "promedio_molienda_actual","value": 6629 }
  ]
}
```

### 5.3 `POST /webhooks/ingest/shift/mill-speed` (1x turno)

```json
{
  "tenant_slug": "lacorona",
  "plant_slug": "planta-sur",
  "shift": "morning",
  "shift_date": "2026-05-15",
  "promedio_rpm": 4.8,
  "samples": [
    { "timestamp": "2026-05-15T05:01:00-03:00", "rpm": 4.7 },
    { "timestamp": "2026-05-15T06:00:00-03:00", "rpm": 4.9 },
    { "timestamp": "2026-05-15T07:00:00-03:00", "rpm": 4.8 }
  ]
}
```

Campos:
- `shift` enum: `morning` / `afternoon` / `night`
- `shift_date` formato `YYYY-MM-DD` (fecha inicio turno)
- `promedio_rpm` number
- `samples[]` array (≥1) para gráfica sparkline

### 5.4 Frecuencia recomendada Node-RED

| Endpoint | Frecuencia | Origen sugerido Node-RED |
|---|---|---|
| `metrics-energy` | cada 5 segundos | MQTT in (EMQX) → función agrupar → HTTP request |
| `metrics-production` | cada 5 segundos | Idem |
| `shift/mill-speed` | 1x al cierre turno (05:01 / 13:01 / 21:01 ART) | InfluxDB query histórica → HTTP request |

### 5.5 Configuración Node-RED sugerida

```
[MQTT in: EMQX broker]
   ↓
[Function node: parse + agrupar últimos N segundos]
   ↓
[Function node: build payload { tenant_slug, metrics: [...] }]
   ↓
[HTTP Request node]
   - Method: POST
   - URL: https://api.ingcloud.srv878399.hstgr.cloud/api/webhooks/ingest/metrics-energy
          (dev: http://localhost:3001/api/webhooks/ingest/metrics-energy)
   - Headers:
     - Content-Type: application/json
     - x-webhook-secret: ${N8N_WEBHOOK_SECRET}
   - Body: JSON desde flow
```

### 5.5 Errores comunes

```json
// 401
{ "statusCode": 401, "message": "Invalid webhook secret" }

// 400
{
  "error": "validation_failed",
  "issues": { "fieldErrors": { "metrics": ["Required"] } }
}

// 429
{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests" }
```

---

## 6. Catálogo sensor_id válidos

### ENERGÍA (10 base + 2 calculados = 14)

| sensor_id | unit | Notas |
|---|---|---|
| `caudal_caldera_2` | t/h | base |
| `caudal_caldera_3` | t/h | base |
| `caudal_caldera_6` | t/h | base |
| `caudal_total_vapor` | t/h | **calculado server** = c2+c3+c6 |
| `presion_alta_baja` | bar | |
| `presion_escape` | bar | |
| `presion_vg1` | bar | |
| `temp_agua_alimentacion` | °C | |
| `presion_agua_alimentacion` | bar | |
| `potencia_weg` | MW | base |
| `potencia_siemens` | MW | base |
| `generacion_total` | MW | **calculado server** = weg+siemens |
| `gas_actual` | m³/h | |
| `gas_acumulado_dia` | m³ | |

### PRODUCCIÓN (21)

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
| `caudal_vino_destilado` | L/h |
| `caudal_buen_gusto` | L/h |
| `vapor_destileria_k2` | bar |
| `nivel_agua_foza` | % |
| `aire_destileria` | bar |
| `promedio_molienda_actual` | t/h |

**Total expuesto:** 14 + 21 = 35 sensores
**Webhook envía:** 12 energía + 21 producción = 33 (server calcula 2 más)

---

## 7. Variables de entorno

### 7.1 Backend (`backend/.env.local` en dev / `.env` raíz en VPS)

```bash
# App
NODE_ENV=production
PORT=3001
TZ=America/Argentina/Buenos_Aires

# Supabase
SUPABASE_URL=https://ingenio-supabase.srv878399.hstgr.cloud
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=55f77ae3...
DATABASE_URL=postgresql://postgres.default:PASS@srv878399.hstgr.cloud:6545/postgres

# JWT app
JWT_SECRET=<openssl rand -hex 64>
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Webhooks
N8N_WEBHOOK_SECRET=<openssl rand -hex 32>
MILL_SPEED_WEBHOOK_SECRET=<openssl rand -hex 32>

# URLs
FRONTEND_URL=https://ingcloud.srv878399.hstgr.cloud
BACKEND_URL=https://api.ingcloud.srv878399.hstgr.cloud/api

# MSSQL CORONA
MSSQL_HOST=192.168.0.177
MSSQL_PORT=1433
MSSQL_DATABASE=CORONA
MSSQL_USER=fs1
MSSQL_PASSWORD=<pedir>
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true

# HTTP molienda
MOLIENDA_HTTP_URL=<URL real>
MOLIENDA_HTTP_AUTH=<si aplica>

# IA APIs (Sprint 1+)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=

# Comms
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=
RESEND_API_KEY=
MAIL_FROM=alertas@ingcloud.srv878399.hstgr.cloud
```

### 7.2 Frontend (`frontend/.env.local` dev / build-args VPS)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api          # local
# NEXT_PUBLIC_API_URL=https://api.ingcloud.srv878399.hstgr.cloud/api   # prod

NEXT_PUBLIC_SUPABASE_URL=https://ingenio-supabase.srv878399.hstgr.cloud
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

NEXT_PUBLIC_APP_NAME=Ingenio Cloud
NEXT_PUBLIC_APP_URL=http://localhost:3000              # local
NEXT_PUBLIC_DEFAULT_TENANT_SLUG=lacorona
NEXT_PUBLIC_DEFAULT_PLANT_SLUG=planta-sur

NEXT_PUBLIC_COPILOT_ENABLED=false
NEXT_PUBLIC_TV_AUTO_FULLSCREEN=true
```

### 7.3 Docker Compose VPS (`.env` raíz monorepo)

Combina backend + frontend + Traefik. Template completo en `.env.example`.

Variables clave a llenar:
- `DOMAIN_NAME=ingcloud.srv878399.hstgr.cloud`
- `DB_PASSWORD`, `SUPABASE_*`, `JWT_SECRET`, `N8N_WEBHOOK_SECRET`, `MILL_SPEED_WEBHOOK_SECRET`
- `MSSQL_PASSWORD`, `MOLIENDA_HTTP_URL`
- `OPENAI_API_KEY`, `EVOLUTION_API_KEY`

---

## 8. Comandos útiles

### 8.1 Generar secrets

```bash
# JWT secret
openssl rand -hex 64

# Webhook secrets
openssl rand -hex 32
```

### 8.2 Docker

```bash
# Ver logs en vivo
docker compose -f docker-compose.yml logs -f --tail=100 ingenio-backend
docker compose -f docker-compose.yml logs -f --tail=100 ingenio-frontend

# Restart un servicio
docker compose -f docker-compose.yml restart ingenio-backend

# Rebuild sin cache
docker compose -f docker-compose.yml build --no-cache ingenio-frontend
docker compose -f docker-compose.yml up -d --force-recreate ingenio-frontend

# Stats recursos
docker stats ingenio-backend ingenio-frontend

# Exec into container
docker exec -it ingenio-backend sh
docker exec -it ingenio-frontend sh

# Verificar networks
docker network ls
docker network inspect n8n_evoapi
docker network inspect supabase_network
```

### 8.3 Health checks rápidos

```bash
# Local
curl http://localhost:3001/api/health
curl http://localhost:3000

# Producción
curl https://api.ingcloud.srv878399.hstgr.cloud/api/health
curl -I https://ingcloud.srv878399.hstgr.cloud
```

### 8.4 Supabase via MCP

```bash
# Listar tablas
# (desde Claude Code con MCP supabase-self activo)
mcp__supabase-self__list_tables

# Ejecutar query
mcp__supabase-self__execute_sql "SELECT sensor_id, value, status FROM industrial.metrics_live"

# Ver migrations aplicadas
mcp__supabase-self__list_migrations
```

### 8.5 Verificación end-to-end local

```bash
# 1. Backend health
curl -s http://localhost:3001/api/health | jq

# 2. Catálogo sensores (35)
curl -s http://localhost:3001/api/metrics/catalog | jq '.sensors | length'
# → 35

# 3. Snapshot inicial (vacío hasta primer webhook)
curl -s http://localhost:3001/api/metrics/snapshot | jq

# 4. Disparar webhook
curl -X POST http://localhost:3001/api/webhooks/ingest/metrics-energy \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev-n8n-webhook-secret-32chars" \
  -d '{"metrics":[{"sensor_id":"caudal_caldera_2","value":62.3}]}'

# 5. Verificar BD se llenó
curl -s http://localhost:3001/api/metrics/snapshot | jq

# 6. Confirmar Realtime en frontend → http://localhost:3000
```

---

## 9. Troubleshooting

| Síntoma | Causa | Solución |
|---|---|---|
| Backend `Supabase client initialised` pero queries fallan | Tabla no existe / RLS bloquea | Verificar migrations aplicadas (`mcp__supabase-self__list_migrations`) |
| `MSSQL connect failed` | Sin Tailscale o password vacío | Activar Tailscale + completar `MSSQL_PASSWORD` |
| Frontend muestra todo `—` | Backend no responde o `metrics_live` vacío | Levantar backend + enviar webhook test |
| `401 unauthorized` en webhooks | Secret incorrecto | Verificar header exacto `x-webhook-secret` |
| Realtime no actualiza | Subscription cerrada o RLS bloquea | Network tab WS + verificar publication |
| `429 Too Many Requests` | Rate limit (60/min metrics) | Reducir frecuencia n8n o agrupar más por request |
| Traefik no resuelve SSL | DNS no apunta a VPS / Let's Encrypt rate limit | `dig +short api.ingcloud.srv878399.hstgr.cloud` |
| Container restart loop | Env var faltante | `docker compose logs ingenio-backend` ver error zod validation |
| Build frontend OOM | RAM VPS insuficiente | Build local + push imagen a GHCR, no build en VPS |
| `pg_cron` no ejecuta | Extensión no habilitada | `CREATE EXTENSION IF NOT EXISTS pg_cron` |

---

## 10. Próximos pasos

| Sprint | Objetivo |
|---|---|
| S0 (hoy) | Dashboard principal productivo + webhooks ingesta |
| S1 | Vigía Mesh v1 (Anomaly + Predictor) → CopilotBanner se activa |
| S2 | Módulos completos (Producción, Energía, Alertas) + Zoe chat |
| S3 | Tools tipadas + memoria larga + voz |
| S4 | Predictivo full + 2° cliente onboardeado |

Ver plan completo en `../plan/README.md`.

---

**Última actualización:** 2026-05-15
**Versión:** 0.1.0
**Stack:** Next.js 14 + NestJS 10 + Supabase self-hosted + Docker Compose + Traefik
