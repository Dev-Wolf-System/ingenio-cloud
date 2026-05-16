# 01 — Arquitectura de la app + Stack técnico

## 1. Filosofía

Aunque entregamos primero **una sola vista (dashboard principal)**, construimos la **app completa Next.js 14** desde el día 1. La estructura, hooks, design system y routing sirven luego para Producción, Energía, Alertas, Zoe, Admin, etc.

**Cero código throwaway.** Cada decisión arquitectónica se justifica con su rol en el ERP final.

---

## 2. Stack técnico

### 2.1 Core

| Componente | Versión | Rol |
|---|---|---|
| **Next.js** | 14.2+ App Router | Framework full-stack |
| **TypeScript** | 5.5+ estricto | Tipado fuerte + branded types |
| **Node.js** | 20 LTS | Runtime |
| **pnpm** | 9+ | Package manager (lockfile más rápido) |

### 2.2 UI / Estilo

| Componente | Versión | Rol |
|---|---|---|
| **Tailwind CSS** | 4.x | Utility-first styling |
| **shadcn/ui** | latest | Base componentes (Card, Badge, Button, Dialog, Tabs) |
| **Radix UI primitives** | latest | A11y de base (vía shadcn) |
| **class-variance-authority** | latest | Variants tipados componentes |
| **clsx + tailwind-merge** | latest | Composición de clases |
| **Lucide React** + **@tabler/icons-react** | latest | Iconografía (tabler para industrial, lucide para resto) |
| **Geist Sans** + **Geist Mono** + **JetBrains Mono** | via next/font/google | Tipografía |
| **Framer Motion** | 11.x | Animaciones medidas |

### 2.3 Estado + datos

| Componente | Versión | Rol |
|---|---|---|
| **TanStack Query** | 5.x | Server state (KPI guardia + datos cacheables) |
| **Zustand** | 4.x | Estado UI cliente (sidebar, modales, copilot) |
| **@supabase/ssr** | latest | Cliente Supabase server + browser |
| **@supabase/supabase-js** | 2.x | Cliente JS |
| **react-hook-form** | latest | Formularios (futuro admin) |
| **zod** | 3.x | Validación schemas |

### 2.4 Gráficas

| Componente | Rol |
|---|---|
| **Recharts** | Sparklines + AreaChart + LineChart KPIs |
| **Apache ECharts** + **echarts-for-react** | Gauges presión + Sankey balance vapor (S2+) |

### 2.5 Backend (en el mismo monorepo Next.js)

| Componente | Versión | Rol |
|---|---|---|
| **Drizzle ORM** | latest | ORM tipado para Postgres Supabase |
| **drizzle-kit** | latest | Migrations |
| **@upstash/ratelimit** | latest | Rate limiting webhooks y APIs |
| **mssql** (node-mssql) | latest | Cliente SQL Server para CORONA legacy |
| **date-fns** + **date-fns-tz** | latest | Manipulación fechas con timezone AR |
| **pino** | latest | Logger estructurado |

### 2.6 IA (preparado, integración real en S1)

| Componente | Versión | Rol |
|---|---|---|
| **openai** | latest | Cliente OpenAI |
| **@anthropic-ai/sdk** | latest | Cliente Anthropic |
| **@google/generative-ai** | latest | Cliente Gemini |
| **Vercel AI SDK** | latest | Streaming respuestas (cuando Zoe se integre S2) |

### 2.7 Producción / Operación

| Componente | Rol |
|---|---|
| **Workbox** | Service worker PWA mobile |
| **next-intl** | i18n es-AR (default), pt-BR (futuro) |
| **cmdk** | Command palette Cmd+K |
| **next-themes** | Theme manager (dark default, light disponible salvo TV mode) |

### 2.8 Dev

| Componente | Rol |
|---|---|
| **ESLint** + **@typescript-eslint** | Lint |
| **Prettier** | Format |
| **Playwright** | E2E tests |
| **Vitest** | Unit tests |
| **Storybook** | Component library docs (Día 8+) |
| **Husky** + **lint-staged** | Git hooks |

---

## 3. Estructura de carpetas

```
ingenio-cloud-web/
├── public/
│   ├── favicon.ico
│   ├── logo-ingenio.svg
│   └── manifest.webmanifest        # PWA
├── src/
│   ├── app/
│   │   ├── (auth)/                 # FUTURO — login, signup
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # Sidebar + TopBar + provider Realtime
│   │   │   ├── page.tsx            # Dashboard principal (ENTREGABLE)
│   │   │   ├── produccion/         # FUTURO Sprint 2
│   │   │   ├── energia/            # FUTURO Sprint 2
│   │   │   ├── alertas/            # FUTURO Sprint 1
│   │   │   ├── zoe/                # FUTURO Sprint 3
│   │   │   ├── reportes/           # FUTURO Sprint 5
│   │   │   └── admin/              # FUTURO Sprint 6
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   └── n8n/
│   │   │   │       ├── metrics-energy/route.ts    # POST upsert energía
│   │   │   │       ├── metrics-production/route.ts # POST upsert producción
│   │   │   │       └── shift/mill-speed/route.ts  # POST velocidad molino (1x turno)
│   │   │   ├── guardia/
│   │   │   │   ├── molienda/route.ts              # GET molienda promedio (proxy)
│   │   │   │   ├── gas-previo/route.ts            # GET MSSQL gas turno anterior
│   │   │   │   └── paradas/route.ts               # GET MSSQL paradas
│   │   │   ├── metrics/
│   │   │   │   └── snapshot/route.ts              # GET snapshot inicial (fallback)
│   │   │   └── health/route.ts                    # GET healthcheck
│   │   ├── tv/                                    # /tv → modo TV ambient
│   │   │   └── page.tsx                           # variante sin sidebar
│   │   ├── layout.tsx                             # root layout + fonts + theme
│   │   ├── globals.css                            # CSS variables + Tailwind base
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   └── loading.tsx
│   ├── components/
│   │   ├── ui/                                    # shadcn customizado
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── toast.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx                        # colapsable + grupos
│   │   │   ├── TopBar.tsx                         # brand + turno + reloj + fullscreen
│   │   │   ├── PageWrapper.tsx
│   │   │   └── ConnectionStatus.tsx               # chip estado conexión
│   │   ├── charts/
│   │   │   ├── KpiCard.tsx
│   │   │   ├── Sparkline.tsx
│   │   │   ├── AreaChart.tsx
│   │   │   ├── LineChart.tsx
│   │   │   └── Gauge.tsx                          # ECharts gauge
│   │   ├── industrial/
│   │   │   ├── MetricTile.tsx                     # tile reutilizable
│   │   │   ├── LevelBar.tsx                       # barra horizontal nivel
│   │   │   ├── PanelHeader.tsx                    # header sección con badge
│   │   │   ├── AlertStrip.tsx                     # banda crítica
│   │   │   ├── AlertItem.tsx                      # item lista alertas
│   │   │   ├── KpiHero.tsx                        # 4 KPIs top
│   │   │   ├── EnergyPanel.tsx                    # sección energía
│   │   │   ├── ProductionPanel.tsx                # sección producción
│   │   │   ├── ShiftSummaryPanel.tsx              # resumen guardia
│   │   │   ├── ShiftKpi.tsx                       # mini KPI guardia
│   │   │   ├── K2Indicator.tsx                    # indicador K2 funcionando
│   │   │   └── CopilotBanner.tsx                  # banda inferior IA
│   │   ├── ai/
│   │   │   └── CopilotPlaceholder.tsx             # placeholder S1
│   │   └── domain/
│   │       ├── MoliendaCard.tsx
│   │       └── ShiftChip.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                          # browser client
│   │   │   ├── server.ts                          # server client (RSC)
│   │   │   ├── service.ts                         # service role (webhooks)
│   │   │   └── realtime.ts                        # helpers subscribe
│   │   ├── db/
│   │   │   ├── schema.ts                          # Drizzle schema
│   │   │   ├── client.ts                          # Drizzle instance
│   │   │   └── mssql.ts                           # cliente MSSQL CORONA
│   │   ├── utils/
│   │   │   ├── shift.ts                           # getCurrentShift, getPreviousShift
│   │   │   ├── status.ts                          # resolveStatus(value, setpoints)
│   │   │   ├── format.ts                          # números, fechas, unidades
│   │   │   ├── cn.ts                              # clsx + tailwind-merge
│   │   │   └── fullscreen.ts                      # wake lock + fullscreen API
│   │   ├── hooks/
│   │   │   ├── useShift.ts                        # turno actual + tick
│   │   │   ├── useClock.ts                        # reloj
│   │   │   ├── useRealtimeMetrics.ts              # subscribe metrics_live
│   │   │   ├── useShiftKPIs.ts                    # KPI guardia 1x turno
│   │   │   ├── useActiveAlerts.ts                 # subscribe alerts_active
│   │   │   ├── useConnectionStatus.ts             # Realtime status
│   │   │   ├── useFullscreen.ts
│   │   │   ├── useWakeLock.ts
│   │   │   └── useKeyboardShortcut.ts             # F, Cmd+K
│   │   ├── validations/
│   │   │   ├── webhooks.ts                        # zod schemas webhooks n8n
│   │   │   └── metrics.ts
│   │   ├── constants/
│   │   │   ├── variables.ts                       # catálogo 32 variables
│   │   │   ├── setpoints.ts                       # umbrales por sensor
│   │   │   └── shift.ts                           # turnos AR
│   │   └── llm/                                   # FUTURO Sprint 1
│   │       └── (placeholder)
│   ├── stores/
│   │   ├── ui.ts                                  # Zustand UI state
│   │   ├── alerts.ts                              # alertas locales
│   │   └── copilot.ts                             # estado copilot (placeholder)
│   ├── types/
│   │   ├── metrics.ts                             # MetricReading, LevelReading
│   │   ├── alerts.ts                              # ActiveAlert, AlertSeverity
│   │   ├── shift.ts                               # Shift, ShiftKPI
│   │   ├── webhooks.ts                            # tipos payloads
│   │   └── branded.ts                             # TenantId, SensorId, PlantId
│   ├── config/
│   │   ├── env.ts                                 # validación env vars (zod)
│   │   ├── supabase.ts
│   │   └── tenants.ts                             # default tenant config
│   └── styles/
│       └── tokens.css                             # CSS variables design system
├── drizzle.config.ts
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── playwright.config.ts
├── vitest.config.ts
├── .env.example
├── .env.local                                     # gitignored
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── README.md
└── CLAUDE.md                                      # extracto del CLAUDE.md raíz
```

---

## 4. Capas de la app

```
┌────────────────────────────────────────────────────────┐
│  PRESENTACIÓN (Server Components + Client Components)  │
│  app/(dashboard)/page.tsx                              │
│  components/industrial/* + charts/* + layout/*         │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│  ESTADO DEL CLIENTE                                    │
│  Zustand (UI) + TanStack Query (server state cache)    │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│  HOOKS (lógica reutilizable)                           │
│  useRealtimeMetrics, useShiftKPIs, useActiveAlerts     │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│  CAPA DATOS (cliente)                                  │
│  Supabase JS client + Realtime channels                │
│  fetch a /api/guardia/* (datos no realtime)            │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│  API ROUTES (servidor Next.js)                         │
│  /api/webhooks/n8n/* (ingesta n8n)                     │
│  /api/guardia/* (consulta directa MSSQL/HTTP)          │
│  /api/metrics/snapshot (fallback inicial)              │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│  DATA STORES                                           │
│  Supabase Postgres (industrial.metrics_live, alerts)   │
│  MSSQL CORONA (read-only, gas/paradas)                 │
│  InfluxDB (futuro Sprint 1 — Vigía-Anomaly)            │
└────────────────────────────────────────────────────────┘
```

---

## 5. Decisiones arquitectónicas clave

### 5.1 Por qué Next.js App Router (no Pages)

- **RSC** = bootstrap inicial del dashboard server-rendered (datos iniciales sin loading vacío)
- **Streaming + Suspense** = paneles cargan progresivo sin bloquear TV
- **Server Actions** = mutaciones tipadas (futuro: dismiss alerta, registrar observación)
- **Layouts nesting** = sidebar + topbar persisten al navegar entre módulos
- **Route groups** = `(dashboard)` separa rutas protegidas del resto sin afectar URL

### 5.2 Por qué Supabase + Realtime (no WebSocket custom)

- Multi-tenant nativo con RLS
- Realtime subscriptions sobre tablas Postgres = misma fuente de verdad
- Auth integrada para futuro
- Edge Functions para webhooks rápidos (no necesarios en S0 pero disponibles)
- Self-hosted desde día 1 (alineado plan v3.0)

### 5.3 Por qué Drizzle ORM (no Prisma)

- Más liviano (no requiere generación de cliente)
- TypeScript-first (mejor inferencia)
- SQL transparente (queries leíbles)
- Compatible con Supabase out-of-the-box
- Migrations explícitas

### 5.4 Por qué TanStack Query + Zustand (no Redux)

- TanStack Query maneja server state (cache, refetch, stale-while-revalidate)
- Zustand maneja solo UI state (no duplicar server state)
- Cero boilerplate
- Selectivo: solo lo que necesita re-render

### 5.5 Por qué Recharts + ECharts juntos

- Recharts = simple, declarativo, perfecto para sparklines + KPI charts
- ECharts = gauges industriales + Sankey + radar (Recharts no los hace bien)
- Coexisten: cada uno donde brilla. No usar ambos para lo mismo.

### 5.6 Por qué Webhooks n8n (no que app conecte directo a EMQX/MQTT)

- n8n ya está productivo
- Node-RED normaliza + valida + dedupea
- App recibe payloads ya tipados
- Latencia aceptable (< 2s end-to-end target)
- Desacopla pipeline industrial del producto

### 5.7 Por qué app única (no micro-frontends)

- Equipo: 1 humano + Claude. Micro-frontends = overengineering.
- Performance bundle aceptable hasta 50+ páginas con Next 14
- Migrar a monorepo nx/turbo si crece a 3+ apps independientes (no este caso)

---

## 6. Variables de entorno

> **Templates completos** (dev + producción VPS) en [`11_DEPLOY_VPS_DOCKER.md`](./11_DEPLOY_VPS_DOCKER.md) secciones 6 y 7. Aquí solo el resumen.

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000           # dev / o https://ingcloud.srv878399.hstgr.cloud en prod
NEXT_PUBLIC_APP_NAME=Ingenio Cloud
NEXT_PUBLIC_DEFAULT_TENANT_SLUG=lacorona
NEXT_PUBLIC_DEFAULT_PLANT_SLUG=planta-sur

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=                 # solo server-side, NUNCA exponer al cliente

# Database directa (Drizzle migrations)
DATABASE_URL=

# MSSQL CORONA legacy (read-only)
MSSQL_HOST=192.168.0.177
MSSQL_PORT=1433
MSSQL_DATABASE=CORONA
MSSQL_USER=fs1
MSSQL_PASSWORD=                            # nunca commitear
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true

# Webhooks n8n
N8N_WEBHOOK_SECRET=                        # x-webhook-secret header check

# HTTP endpoint molienda (externo)
MOLIENDA_HTTP_URL=
MOLIENDA_HTTP_AUTH=                        # si tiene auth

# Velocidad primer molino (webhook 1x turno)
MILL_SPEED_WEBHOOK_SECRET=

# Timezone
TZ=America/Argentina/Buenos_Aires

# Logging
LOG_LEVEL=info

# Feature flags
NEXT_PUBLIC_COPILOT_ENABLED=false          # S1 lo activa
NEXT_PUBLIC_TV_AUTO_FULLSCREEN=true
```

### 6.1 Estructura split deploy

Importante: el deploy a VPS **separa** la app en 2 servicios Docker (backend NestJS + frontend Next.js standalone) mirrorando patrón AVAX del stack existente. La estructura de carpetas del monorepo es:

```
ingenio-cloud/
├── backend/          # NestJS API (port 3001) — webhooks, MSSQL, Supabase service
├── frontend/         # Next.js 14 (port 3000) — UI dashboard
├── shared/           # tipos zod + interfaces comunes
├── infra/
│   └── docker-compose.yml
└── .env              # gitignored, copiar de .env.example
```

Detalles completos: [`11_DEPLOY_VPS_DOCKER.md`](./11_DEPLOY_VPS_DOCKER.md).

---

## 7. Scripts package.json

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx,md}\"",
    "test": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "storybook": "storybook dev -p 6006"
  }
}
```

---

## 8. Configuración Next.js

```typescript
// next.config.mjs
const config = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
    typedRoutes: true,
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'avatar.vercel.sh' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default config;
```

---

**Siguiente:** [`02_DESIGN_SYSTEM.md`](./02_DESIGN_SYSTEM.md)
