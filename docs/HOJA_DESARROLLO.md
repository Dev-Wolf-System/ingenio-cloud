# Ingenio Cloud — Hoja de Desarrollo

> Documento vivo. Estado real del proyecto + arquitectura + endpoints + roadmap.
> Última actualización: 2026-05-18 · Sprint 0 cerrado + Polish UX/UI

---

## 1. Estado actual (Sprint 0 — Dashboard Principal)

### Hecho ✅

#### Backend NestJS 10 (Node 22 alpine)
- Gateway WS ingesta Node-RED: `/ws/dashboard/{energia,produccion,trapiche,molino}`
- REST API resiliente: try/catch en services, devuelve `200 { stale: true }` en vez de 500
- Cron threshold evaluator cada 30s (TZ Buenos_Aires)
- Cron pull guardia 05:15/13:15/21:15 ART
- OpenAI gpt-4o-mini con diagnóstico detallado (raw content log, parse markdown tolerance)
- Endpoint manual POST `/api/guardia/analisis-ia/refresh` con error detallado
- WebSocket gateways con auth por query secret + clamp valores negativos
- Logger pino con contextos por service

#### Frontend Next.js 14 (App Router + motion/react)
- **Dashboard premium**: 5 KpiHero (Molienda kg, Bolsas, Gas total, Camiones canchón, Alertas)
- **4 paneles**: Energía (warn), Producción (accent), Trapiche (primary), Resumen Guardia
- **TrapichePanel**: whitelist 8 KPIs + EstadoBanner full-width + filtra rows huérfanas
- **Página `/alertas`** CRUD umbrales con tabla + filtros + severity + toggle
- **Tema dual** (ver sección 6): "Graphite Forge" dark + "Mist Atelier" light
  - Toggle Sun/Moon en TopBar + persistencia localStorage + respeta `prefers-color-scheme`
- **ShiftWelcomeBanner**: modal fullscreen al inicio de cada turno (primeros 30 min)
  - Saludo Buenos días/tardes/noches + 4 mini KPIs + análisis IA del turno previo
  - Dismissible 1 vez por turno (localStorage)
- **ConnectionBanner global**: detección offline navegador + health ping backend cada 10s
  - 3 estados: offline (rojo) / sensores warn (ámbar 15s) / sensores dead (rojo 30s)
- **PremiumTile staleness**: tiles muestran ámbar > 15s sin update, rojo > 30s
- **useDashboardData merge no destructivo**: cache último valor (no flashea empty)
- **AnimatedNumber** CountUp con motion + locale es-AR
- **Fuentes distintivas**: Familjen Grotesk display + Onest body + JetBrains mono
- **Logo plate blanco en dark mode** para mejor contraste

#### Supabase self-hosted stack
- PostgreSQL 15 + PostgREST v14.6 + Realtime + Kong gateway + Studio + Auth
- Schemas activos: `industrial`, `alerts`, `production`, `core`
- RLS habilitado: `dashboard_data`, `metrics_live`, `alerts.active`, `alert_thresholds`
- Realtime publication: `dashboard_data`, `metrics_live`, `shift_kpis_cache`, `alerts.active`, `alert_thresholds`
- REPLICA IDENTITY FULL en todas las hot tables
- Tabla `industrial.alert_thresholds` con CHECK + UNIQUE + defaults tenant/plant

#### Sistema alertas end-to-end
- Configurador UI con CRUD batch upsert
- Engine cron 30s: lee thresholds + snapshot, abre/cierra rows en `alerts.active`
- Visual instantáneo en tiles (border + valor + glow + pulse según severidad)
- KpiHero contador con refetch 30s

#### Traefik routing
- 1 dominio `ingcloud.srv878399.hstgr.cloud`
- 2 routers backend (`/api`, `/ws`) priority 200
- 1 router frontend catch-all priority 10
- SSL Let's Encrypt vía cert resolver

### En progreso 🟡

- OpenAI gpt-4o-mini análisis IA: diagnóstico expuesto, esperando ver raw response real
- Node-RED routing correcto (algunos sensores producción llegan bajo `area=trapiche`)
- Páginas adicionales (`/sensores`, `/historico`)

### Pendiente Sprint 1+ 🔵

- Vigía Mesh (agente IA proactivo monitoreo continuo)
- Notificaciones WhatsApp/Telegram al disparar alerta
- Histórico time-series (InfluxDB 3 o partitioned PG)
- Multi-tenant scale (Sprint 4+)
- Dominio propio `ingeniocloud.app`

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | Next.js | 14.2.35 App Router |
| UI library | React | 18.x |
| Styling | Tailwind CSS | 3.x |
| Animations | motion (ex framer-motion) | 12.38+ |
| Iconos | @tabler/icons-react | latest |
| State | Zustand + TanStack Query v5 | latest |
| Tipografía | Bricolage Grotesque + Geist + JetBrains Mono | Google Fonts + local |
| Backend | NestJS | 10.4.22 |
| Runtime | Node | 22-alpine |
| Package mgr | pnpm | 9 |
| Database | PostgreSQL 15 (Supabase) | self-hosted |
| Realtime | Supabase Realtime + WS Gateway custom | |
| AI | OpenAI gpt-4o-mini | response_format JSON |
| Scheduler | @nestjs/schedule (cron TZ America/Argentina/Buenos_Aires) | |
| Logging | pino + pino-http | |
| Reverse proxy | Traefik | v3 |
| Containerization | Docker Compose | |
| Networks | `n8n_evoapi` + `supabase_network` | externas compartidas |

---

## 3. Arquitectura monorepo

```
ingenio-cloud/
├── backend/
│   ├── Dockerfile               (Node 22 alpine, pnpm, healthcheck)
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── config/env.ts
│       ├── common/              (shift helpers, etc.)
│       └── modules/
│           ├── supabase/        (cliente service_role)
│           ├── webhooks/        (legacy endpoints n8n)
│           ├── guardia/         (resumen turno + IA)
│           ├── metrics/         (snapshot live + canchón)
│           ├── alerts/
│           │   ├── alerts.service.ts          (listActive resiliente)
│           │   ├── thresholds.service.ts      (CRUD umbrales)
│           │   ├── thresholds.controller.ts
│           │   └── threshold-evaluator.service.ts  (cron 30s engine)
│           ├── ai/              (OpenAI client)
│           ├── realtime/
│           │   ├── realtime.gateway.ts   (Energia/Produccion/Trapiche/Molino WS)
│           │   └── realtime.service.ts   (ingest + normalize)
│           ├── scheduler/       (cron guardia pull)
│           └── health/          (status checks)
├── frontend/
│   ├── Dockerfile               (Node 20 alpine, Next standalone)
│   └── src/
│       ├── app/
│       │   ├── layout.tsx       (fonts + html lang)
│       │   ├── providers.tsx    (QueryClient + LazyMotion + MotionConfig)
│       │   ├── template.tsx     (page transition fade-up)
│       │   ├── globals.css      (dual theme: Dark Cosmos + Light Blueprint)
│       │   ├── page.tsx         (Dashboard principal)
│       │   ├── alertas/page.tsx (Configurador umbrales)
│       │   └── error.tsx        (boundary global)
│       ├── components/
│       │   ├── layout/
│       │   │   ├── TopBar.tsx
│       │   │   ├── ConnectionBanner.tsx  (offline + sensores caídos)
│       │   │   └── ThemeToggle.tsx
│       │   └── industrial/
│       │       ├── PremiumPanel.tsx      (shell compartido)
│       │       ├── PremiumTile.tsx       (tile c/ alert visual + staleness)
│       │       ├── KpiHero.tsx           (5 KPIs principales)
│       │       ├── KpiCard.tsx           (card con AnimatedNumber)
│       │       ├── AnimatedNumber.tsx    (CountUp motion)
│       │       ├── EnergyPanel.tsx
│       │       ├── ProductionPanel.tsx
│       │       ├── TrapichePanel.tsx     (whitelist slots + EstadoBanner)
│       │       ├── ShiftSummaryPanel.tsx (resumen turno previo)
│       │       ├── MillSpeedChart.tsx
│       │       ├── AnalisisIA.tsx
│       │       └── CopilotBanner.tsx
│       ├── lib/
│       │   ├── hooks/
│       │   │   ├── useDashboardData.ts   (Realtime + polling fallback)
│       │   │   ├── useThresholds.ts      (cache 60s + evaluateValue)
│       │   │   ├── useClock.ts           (SSR safe)
│       │   │   ├── useShift.ts
│       │   │   └── useTheme.ts           (localStorage + prefers-color-scheme)
│       │   ├── supabase/client.ts        (anon key browser)
│       │   ├── utils/
│       │   └── constants/
│       └── types/
├── docker-compose.yml           (backend + frontend con Traefik labels)
├── .env.example                 (template)
├── docs/
│   ├── HOJA_DESARROLLO.md       (este documento)
│   ├── DEV_LOCAL.md
│   ├── STORAGE_HYBRID.md
│   └── WEBHOOKS_INGESTA.md
└── plan/                        (planes Sprint 0 originales)
```

---

## 4. Endpoints REST/WS

### REST `/api/*`

| Método | Path | Descripción |
|---|---|---|
| GET | `/api/health` | Status backend + Supabase check |
| GET | `/api/metrics/snapshot?area=` | Metrics live (legacy, opcional) |
| GET | `/api/metrics/dashboard-snapshot?area=` | Snapshot dashboard_data por area |
| GET | `/api/metrics/catalog` | Catálogo sensor_mapping activos |
| GET | `/api/metrics/canchon` | Total camiones canchón (production.v_canchon_resumen) |
| GET | `/api/alerts/active` | Alertas abiertas (resolved_at IS NULL) |
| GET | `/api/alerts/thresholds?area=` | Listar umbrales configurados |
| POST | `/api/alerts/thresholds` | Batch upsert umbrales |
| DELETE | `/api/alerts/thresholds/:id` | Eliminar umbral |
| GET | `/api/guardia/resumen` | Resumen completo turno previo |
| GET | `/api/guardia/molienda` | Molienda promedio turno actual |
| GET | `/api/guardia/molienda-previo` | Molienda promedio turno previo |
| GET | `/api/guardia/gas-previo` | Consumo gas turno previo |
| GET | `/api/guardia/paradas` | Paradas turno previo |
| GET | `/api/guardia/vel-molino` | Velocidad molino turno previo |
| GET | `/api/guardia/analisis-ia` | Análisis IA del turno previo (con flag `ia_available`) |
| POST | `/api/guardia/analisis-ia/refresh` | Disparar análisis IA manual ahora (sincrónico, retorna error detallado) |

**Patrón resiliente**: todos los GET devuelven `{ data: [...], stale?: true }` con HTTP 200 incluso cuando Supabase rechaza (en lugar de propagar 500).

### WebSocket `/ws/dashboard/*`

| Path | Áreas | Auth |
|---|---|---|
| `/ws/dashboard/energia` | sensores caldera/vapor | `?secret=<N8N_WEBHOOK_SECRET>` |
| `/ws/dashboard/produccion` | sensores clarificación/destilería | idem |
| `/ws/dashboard/trapiche` | sensores molino | idem |
| `/ws/dashboard/molino` | mill speed cada cambio de turno | `?secret=<MILL_SPEED_WEBHOOK_SECRET>` |

**Payload esperado** (array):
```json
[
  {"alias": "Nombre_Sensor", "value": 12.34, "unit": "%", "time": "2026-05-18T..."},
  ...
]
```

Backend `normalizeDashboard()`:
- `value < 0` → clamp a 0 (`raw` conserva original)
- `display` se autogenera si solo viene `value + unit`

---

## 5. Sistema de alertas (engine completo)

### Tabla `industrial.alert_thresholds`

```sql
id          UUID PK
area        TEXT  CHECK IN (energia, produccion, trapiche)
key         TEXT  -- nombre sensor exacto (Temperatura_Calentador, etc.)
min_value   NUMERIC NULL
max_value   NUMERIC NULL
enabled     BOOLEAN DEFAULT true
severity    TEXT  CHECK IN (info, warn, critical) DEFAULT 'warn'
notes       TEXT
tenant_id   UUID DEFAULT lacorona
plant_id    UUID DEFAULT planta-sur
UNIQUE(area, key, tenant_id, plant_id)
```

### Flujo evaluación

```
Operador (/alertas)
  ↓ POST /api/alerts/thresholds
INSERT industrial.alert_thresholds
  ↓
Backend cron @Cron(EVERY_30_SECONDS) ART
  ThresholdEvaluatorService.evaluate()
    1. Load thresholds enabled
    2. Load snapshot dashboard_data
    3. Load alerts.active (resolved_at IS NULL)
    4. Por cada threshold:
       - Si value fuera rango + sin alerta abierta → INSERT alerts.active
       - Si value en rango + alerta abierta → UPDATE resolved_at = now()
  ↓
Frontend useThresholds (cache 60s)
  evaluateValue(thresholds, area, key, value) en cada PremiumTile
    → border severidad + bg tinted + valor color + animate-pulse si critical
  ↓
KpiHero "Alertas activas" (refetchInterval 30s)
  GET /api/alerts/active → count + criticalCount → status badge
```

### Severidades

| Nivel | Color CSS | Estilo Tile |
|---|---|---|
| `info` | `var(--info)` azul | Border + bg + valor |
| `warn` | `var(--warn)` ámbar/cobre | Border + bg + valor |
| `critical` | `var(--danger)` rojo | Border + bg + valor + animate-pulse |

---

## 6. Sistema de temas dual

### Concepto

| Modo | Concepto | Paleta clave |
|---|---|---|
| **Dark** | "Graphite Forge" — sala control nocturna, grafito neutro cómodo | bg `#14181f` grafito, primary `#5e94c4` azul acero, accent `#5cb5b8` teal industrial |
| **Light** | "Mist Atelier" — neblina cálida nórdica (NO blanco genérico) | bg `#eef1f5` neblina, primary `#3a6996` azul profundo, accent `#5a9685` verde cobre suave |

### Tipografía distintiva

- **Display**: `Familjen Grotesk` (geométrica nórdica, alto carácter industrial)
- **Body**: `Onest` (humanista moderna, excelente legibilidad pantalla)
- **Mono**: `JetBrains Mono` (tabular nums)

### Hook + UI

- `useTheme()` lee `localStorage['ingcloud:theme']` o `prefers-color-scheme`
- `ThemeToggle` componente con animación Sun↔Moon (motion AnimatePresence)
- `data-theme` en `<html>` switching reactivo

### Reglas para componentes

**NO hardcodear** colores rgba/hex en `style={}`. Usar SIEMPRE CSS vars:

```tsx
// ❌ MAL — rompe light mode
style={{ background: 'rgba(15,24,37,0.95)' }}

// ✅ BIEN — adapta dual mode
style={{ background: 'var(--bg-surface)' }}
```

Variables expuestas en `globals.css`:
- `--bg-base`, `--bg-surface`, `--bg-card`, `--bg-card-2`, `--bg-hover`, `--bg-inset`
- `--border-subtle`, `--border-strong`, `--border-focus`
- `--text-primary`, `--text-secondary`, `--text-muted`, `--text-disabled`
- `--primary`, `--primary-light`, `--primary-dark`, `--primary-soft`, `--primary-glow`
- `--accent`, `--accent-soft`, `--accent-glow`
- `--ok`, `--warn`, `--danger`, `--info` + `*-soft` variants
- `--surface-panel-from/to`, `--surface-tile-from/to/primary-from/accent-from/...`
- `--panel-mesh-1`, `--panel-mesh-2`, `--panel-accent-line`, `--panel-shadow`
- `--icon-box-bg`, `--header-bg`, `--logo-plate-bg`, `--logo-plate-ring`
- `--ambient`, `--grain-opacity`, `--grain-blend`

### Hooks + UI

- `useTheme()`: lee `localStorage['ingcloud:theme']` o `prefers-color-scheme`
- `ThemeToggle`: ícono Sun ↔ Moon en TopBar con AnimatePresence
- Aplica `document.documentElement.dataset.theme` reactivo

---

## 7. Database schema (`industrial`)

### Tablas

| Tabla | Filas típicas | RLS | Realtime |
|---|---|---|---|
| `dashboard_data` | 30-50 (1 por sensor) | ✅ | ✅ |
| `metrics_live` | 1 por sensor_id | ✅ | ✅ |
| `sensor_mapping` | catálogo sensores | ❌ | ❌ |
| `shift_kpis_cache` | 4 KPIs × 3 turnos × días | ❌ | ✅ |
| `metrics_history_2026_MM` | particionado por mes | ❌ | ❌ |
| `alert_thresholds` | 1 por regla configurada | ✅ | ✅ |
| `alerts.active` | abiertas + resueltas | ✅ | ✅ |

### Defaults críticos

```sql
-- Single tenant MVP
ALTER TABLE industrial.dashboard_data
  ALTER COLUMN tenant_id SET DEFAULT 'ac154845-105e-408c-9650-58b8146d129a',
  ALTER COLUMN plant_id  SET DEFAULT '5aaaeb76-a290-4502-9048-c42faa4d3eef';
-- Idem en shift_kpis_cache, metrics_live, metrics_history, sensor_mapping
```

### REPLICA IDENTITY FULL

Para que Realtime UPDATE incluya TODAS las columnas (no solo PK):

```sql
ALTER TABLE industrial.dashboard_data    REPLICA IDENTITY FULL;
ALTER TABLE industrial.metrics_live      REPLICA IDENTITY FULL;
ALTER TABLE industrial.shift_kpis_cache  REPLICA IDENTITY FULL;
ALTER TABLE industrial.alert_thresholds  REPLICA IDENTITY FULL;
ALTER TABLE alerts.active                REPLICA IDENTITY FULL;
```

### PGRST_DB_SCHEMAS (Supabase .env)

```
PGRST_DB_SCHEMAS=public,storage,graphql_public,industrial,alerts,production
```

Sin `production` → endpoint `/api/metrics/canchon` rompe (no expone schema).

---

## 8. Deploy VPS

### Pre-requisitos

- VPS Hostinger `srv878399` Ubuntu
- Docker + Docker Compose
- Networks externas: `n8n_evoapi`, `supabase_network`
- Stack Supabase corriendo en `~/ingenio-corona/ingenio-cloud-v2/supabase`
- Stack app en `~/ingenio-corona/ingenio-cloud-v2/app-ingenio-cloud`

### Deploy rápido (cambios normales)

```bash
cd ~/ingenio-corona/ingenio-cloud-v2/app-ingenio-cloud
git pull
docker compose --env-file ./.env build
docker compose --env-file ./.env up -d
sleep 30
curl -s "https://ingcloud.srv878399.hstgr.cloud/api/health" | jq
```

### Deploy completo sin cache (tras cambios Dockerfile/deps)

```bash
cd ~/ingenio-corona/ingenio-cloud-v2/app-ingenio-cloud
git pull
docker compose --env-file ./.env build --no-cache --pull
docker compose --env-file ./.env up -d --force-recreate
sleep 40
docker ps | grep ingenio
```

### Solo backend / solo frontend

```bash
docker compose --env-file ./.env build ingenio-backend
docker compose --env-file ./.env up -d ingenio-backend
# o ingenio-frontend
```

### Restart PostgREST cache (cuando 500 intermitentes)

```bash
cd ~/ingenio-corona/ingenio-cloud-v2/supabase
docker compose stop rest && docker compose rm -f rest && docker compose up -d rest
sleep 15
docker exec ingenio-db psql -U postgres -c "NOTIFY pgrst, 'reload schema'; NOTIFY pgrst, 'reload config';"
```

---

## 9. Variables `.env`

### App `.env` (~/.../app-ingenio-cloud/.env)

```bash
DOMAIN_NAME=ingcloud.srv878399.hstgr.cloud

# Supabase
SUPABASE_URL=http://ingenio-kong:8000
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # del stack Supabase, ¡debe matchear!
SUPABASE_JWT_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=https://ingenio-supabase.srv878399.hstgr.cloud
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# DB
DB_HOST=supabase-db
DB_USERNAME=postgres
DB_PASSWORD=...
DB_DATABASE=postgres
DATABASE_URL=postgresql://postgres:...@supabase-db:5432/postgres

# JWT
JWT_SECRET=...

# WS auth
N8N_WEBHOOK_SECRET=...
MILL_SPEED_WEBHOOK_SECRET=...

# MSSQL legacy (via Tailscale)
MSSQL_HOST=192.168.0.177
MSSQL_USER=fs1
MSSQL_PASSWORD=...

# Node-RED
NODERED_GUARDIA_URL=https://nodered.srv878399.hstgr.cloud/api/resumen-guardia/
NODERED_AUTH=...

# AI
OPENAI_API_KEY=sk-...

# Comms (opcional)
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=...
RESEND_API_KEY=...
MAIL_FROM=alerts@ingenio.com
```

### Supabase stack `.env`

```bash
PGRST_DB_SCHEMAS=public,storage,graphql_public,industrial,alerts,production
JWT_SECRET=...                          # debe matchear con backend
SERVICE_ROLE_KEY=eyJ...                 # debe matchear con backend SUPABASE_SERVICE_ROLE_KEY
ANON_KEY=eyJ...
# ... resto config standard Supabase
```

---

## 10. Comandos útiles

### Verificación health

```bash
curl -s "https://ingcloud.srv878399.hstgr.cloud/api/health" | jq
curl -s "https://ingcloud.srv878399.hstgr.cloud/api/metrics/dashboard-snapshot?area=trapiche" | jq '.data | length'
curl -s "https://ingcloud.srv878399.hstgr.cloud/api/alerts/thresholds" | jq '.thresholds | length'
```

### Logs

```bash
docker logs ingenio-backend --tail 50
docker logs ingenio-frontend --tail 30
docker logs ingenio-rest --tail 30 2>&1 | grep -i error
docker logs traefik --tail 100 2>&1 | grep -i ingenio
```

### SQL diagnóstico común

```sql
-- Datos llegando por área
SELECT area, count(*), max(updated_at) FROM industrial.dashboard_data GROUP BY area;

-- Alertas abiertas
SELECT severity, title, detected_at FROM alerts.active WHERE resolved_at IS NULL;

-- Thresholds configurados
SELECT area, key, min_value, max_value, severity, enabled FROM industrial.alert_thresholds;

-- Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
```

### Limpieza rows huérfanos trapiche (Node-RED mal ruteo)

```sql
DELETE FROM industrial.dashboard_data
WHERE area='trapiche'
  AND key NOT IN (
    '6to_Molino_Presion_Este','6to_Molino_Presion_Oeste',
    'Bagazo_Humedad','Bagazo_Pol%',
    'Bb_Imbibicion_Caudal','Bb_Imbibicion_Nivel','Bb_Imbibicion_Temp',
    'Molienda_Kilos','Trapiche_Estado'
  );
```

---

## 11. Issues conocidos + mitigaciones

| Issue | Síntoma | Mitigación actual | Fix definitivo |
|---|---|---|---|
| ✅ RESUELTO: PostgREST 401 intermitente | 500 cascada en backend | Backend tolerante + fix DNS Kong | Ver sección "DNS Kong colisión" abajo |
| ✅ RESUELTO: PGRST_DB_SCHEMAS sin `production` | `/api/metrics/canchon` daba `stale:true` | Editar `.env` Supabase + recreate REST | Verificar `docker exec ingenio-rest env` |
| ✅ RESUELTO: SUPABASE_SERVICE_ROLE_KEY duplicada/truncada | 401 intermitente | sed -i para deduplicar línea | Validación de schema .env al boot |
| ✅ RESUELTO: useDashboardData borraba cache si snapshot vacío | Tiles flasheaban "—" cuando 500 transitorio | Reducer `init` merge no destructivo | Mantener última data en cache |
| ⚠️ AI análisis IA vacío/JSON inválido | Banner muestra "no disponible" | Diagnóstico expuesto en logs + botón Generar manual con error detallado | Esperando ver raw response real OpenAI |
| Node-RED ruteo confuso | Datos producción llegan bajo `area=trapiche` | Whitelist frontend + DELETE limpieza SQL | Corregir flow Node-RED |
| Cert `api.ingcloud.*` no emitió | (resuelto) | Routing por path `/api` y `/ws` bajo mismo host | Dominio propio + wildcard cert (S6+) |
| Hydration flash dark→light | Pequeño parpadeo en load | Hook lee localStorage post-mount | Inline script en `<head>` que setea data-theme antes hydrate |
| Sin notificación push | Alertas solo en panel UI | KpiHero pulse | Integrar Evolution API WhatsApp (S1+) |

### DNS Kong colisión (caso resuelto, documentar para futuro)

**Síntoma:** PostgREST devolvía `401 Unauthorized` aleatorio (~66% queries) aunque la SERVICE_ROLE_KEY y JWT_SECRET estaban correctos.

**Causa raíz:** El VPS tiene 3 stacks Supabase (`ingenio`, `svi`, `supabase`) que comparten la red Docker `n8n_evoapi`. Los 3 containers Kong tenían el mismo alias DNS genérico (`kong`) en esa red. Docker DNS hacía **round-robin** entre los 3 → backend `ingenio-backend` llegaba al Kong equivocado mayoría del tiempo, cuyo PostgREST usaba un JWT_SECRET diferente al que firmó nuestra SERVICE_ROLE_KEY.

**Fix:** Usar el `container_name` explícito en lugar del alias genérico.

```diff
# .env del backend
- SUPABASE_URL=http://kong:8000
+ SUPABASE_URL=http://ingenio-kong:8000
```

**Lección:** En VPS multi-stack, NUNCA confiar en aliases genéricos cross-network. Usar siempre el container_name único.

---

## 12. Roadmap

### Sprint 1 — Vigía + Notificaciones (próximo)
- Engine "Vigía Mesh" agente IA que vigila tendencias y anticipa fallas (no solo umbrales fijos)
- Notificación WhatsApp via Evolution API cuando dispara critical
- Email diario resumen via Resend
- Histórico Realtime con InfluxDB 3 o particiones PG agresivas
- Mini-charts inline en tiles (sparkline 1h trailing)

### Sprint 2 — Admin
- Panel `/admin/sensores` con CRUD `sensor_mapping`
- `/admin/tenants` para multi-planta
- Roles + JWT auth con Supabase Auth
- Audit log

### Sprint 3 — Analista IA
- Asistente conversacional embebido (chat)
- Reportes PDF generados con datos + análisis
- Forecast molienda + producción

### Sprint 4 — Multi-tenant
- Subdomain por cliente
- RLS estricta por tenant_id
- Onboarding flow

### Sprint 5 — IoT extension
- Soporte directo MQTT (sin Node-RED middleware)
- OPC-UA bridge para PLCs

### Sprint 6 — Dominio propio
- Migración a `ingeniocloud.app`
- Wildcard cert LE
- Split `api.*` / `app.*` profesional

### Sprint 7 — Marketplace
- Módulos opcionales por planta (mantenimiento, calidad, RRHH)
- Sistema de licencias

---

## 13. Convenciones código

### Commits (español)
- Subject + body en español
- Conventional keywords en inglés (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`)
- Footer `Co-Authored-By` cuando aplique

Ejemplo:
```
feat(alertas): engine completo umbrales — visual frontend + cron backend

- Implementa ThresholdEvaluatorService con @Cron(EVERY_30_SECONDS)
- ...
```

### Backend
- Services con try/catch + log warn en lugar de throw cuando vienen de DB externa
- Devolver `{ data, stale?: true }` antes que propagar 500
- Cron jobs con `timeZone: 'America/Argentina/Buenos_Aires'` explícito
- Logger por contexto (`new Logger('NombreService')`)
- En multi-stack VPS: usar `container_name` EXPLÍCITO en hostnames (ej. `ingenio-kong`, NO `kong`) — ver issue DNS Kong sección 11

### Frontend
- `'use client'` solo cuando necesita hooks/browser API
- Hooks `useXxx` en `lib/hooks/`
- Componentes industriales en `components/industrial/`
- **NUNCA hardcodear colores** — siempre CSS vars del `globals.css`
- Motion con `m.*` + `LazyMotion features={domAnimation}` (bundle minimal)
- TanStack Query con `refetchInterval` para polling, evitar `setInterval` manual
- Componentes que dependen del tiempo (clock, shift) deben ser SSR-safe con `mounted` gate
- Reducers que merge data realtime: NO destructivos (mantener cache si payload vacío)

---

## 14. Changelog reciente (commits clave)

| Commit | Feature |
|---|---|
| `c865437` | Fix DNS Kong colisión documentado |
| `1392e57` | AI service: diagnóstico raw content + tolerancia parsing markdown |
| `8aacd13` | Endpoint POST `/analisis-ia/refresh` + botón manual UX |
| `606a0b5` | ShiftWelcomeBanner sync con flag `ia_available` |
| `c04582a` | ShiftWelcomeBanner nuevo + logging runAnalisisIA |
| `8879e11` | Staleness agresivo 15s/30s + eval cada 5s |
| `348911a` | ConnectionBanner health ping cada 10s |
| `46258c1` | Empty trapiche + staleness + offline banner |
| `15f4d6b` | Dual mode distintivo + backend resilient |
| `9ea4ebe` | Alert colors theme-aware |
| `260dcf5` | Theme toggle Sun/Moon persistencia |
| `9464edf` | Redesign Graphite/Mist + Familjen + Onest + grid energy |
| `7fe7a46` | Canchón KPI con refresh 60s |
| `70e0752` | Engine alertas A+B (frontend + backend) |
| `52f8b2a` | Motion integration (LazyMotion + spring/stagger) |
| `01a18df` | Diseño premium unificado PremiumPanel + PremiumTile |
| `da395ef` | Whitelist KPIs Trapiche + EstadoBanner XL |

---

*Documento mantenido manualmente al cerrar cada feature significativo.*
