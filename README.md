# Ingenio Cloud

> Plataforma Inteligente de Monitoreo, Producción y Asistencia Operativa Industrial

Monorepo SaaS multi-tenant para ingenios azucareros. Combina monitoreo industrial tiempo real, agente IA conversacional (Zoe), agente proactivo (Vigía), y panel ERP modular.

**Cliente piloto:** Ingenio La Corona (Tucumán, AR).
**Estado:** Sprint 0 — Dashboard gerencial principal.

---

## Estructura

```
ingenio-cloud/
├── backend/           NestJS API (port 3001) — webhooks, MSSQL, Supabase service
├── frontend/          Next.js 14 App Router (port 3000) — UI dashboard
├── shared/            tipos zod + interfaces comunes
├── infra/
│   └── docker-compose.yml   stack producción VPS
├── docs/              referencias a /plan
├── .env.example       template VPS production
├── .env.dev.example   template dev local
└── README.md
```

## Stack

**Backend:** NestJS 10 · TypeScript · Drizzle ORM · Supabase JS · mssql · zod · pino · Celery (futuro Sprint 3+)

**Ingesta sensores:** Node-RED → POST `/api/webhooks/ingest/*` (origen real; agrupar MQTT EMQX antes de POST). Alias `n8n` y `node-red` mantenidos.

**Frontend:** Next.js 14 App Router · TypeScript estricto · Tailwind 4 · shadcn/ui · TanStack Query · Zustand · Recharts · ECharts · Framer Motion · Geist + JetBrains Mono · cmdk · next-intl es-AR · Workbox PWA

**Datos:** Supabase self-hosted (Postgres 15 + pgvector + Auth + RLS + Realtime + Storage) · MSSQL CORONA legacy (read-only) · InfluxDB 3 (existente v1)

**Deploy:** Docker Compose · Traefik v3 (red `n8n_evoapi` compartida) · Supabase (red `supabase_network`)

**Subdominio:** `ingcloud.srv878399.hstgr.cloud` (Hostinger srv878399)

## Quick start dev local

```bash
# Backend
cd backend
cp ../.env.dev.example .env.local
pnpm install
pnpm start:dev

# Frontend
cd frontend
cp ../.env.dev.example .env.local
pnpm install
pnpm dev
```

## Deploy VPS

```bash
cd /opt/ingenio-cloud
cp .env.example .env
nano .env                              # completar credenciales reales
cd infra
docker compose --env-file ../.env build
docker compose --env-file ../.env up -d
```

Ver detalles completos en [`docs/deploy.md`](./docs/deploy.md) (referencia a `../plan/11_DEPLOY_VPS_DOCKER.md` del root).

## Documentación de producto

Plan completo en `../plan/` del directorio padre:

| Doc | Tema |
|---|---|
| `00_README` | Index general |
| `01_ARQUITECTURA_Y_STACK` | App + stack |
| `02_DESIGN_SYSTEM` | Paleta INGENIO_CLOUD_DARK + tokens |
| `03_LAYOUT_TV_Y_MOBILE` | Wireframes |
| `04_COMPONENTES` | Catálogo 26 componentes |
| `05_VARIABLES_Y_DATOS` | 35 variables + tipos |
| `06_INTEGRACION_DATOS` | Webhooks + HTTP + MSSQL + Realtime |
| `07_HOOKS_Y_ESTADO` | React hooks + Zustand |
| `08_TURNOS_Y_LOGICA_GUARDIA` | Turnos AR + cache 1x |
| `09_ROADMAP_EJECUCION` | 9-12 días + checklists |
| `10_PENDIENTES_HUMANO` | Bloqueantes |
| `11_DEPLOY_VPS_DOCKER` | docker-compose + Traefik |
| `12_MEJORAS_PREMIUM` | 18 features extra |

## Branding

- Nombre: **Ingenio Cloud**
- Logo: `../Media/Logo - Ingenio Cloud.png`
- Portada: `../Media/Portada Ingenio Cloud.png`
- Paleta: `INGENIO_CLOUD_DARK` (azules logo `#1E5A87` / `#2E7AB5` / `#4A9CD8` + accent cyan `#4FBFE5`)
- Tagline: *"Plataforma Inteligente de Monitoreo, Producción y Asistencia Operativa Industrial"*
