# Plan — Panel Principal Gerencial Ingenio Cloud

> **Primer entregable del producto Ingenio Cloud v3.0** — Dashboard gerencial principal de monitoreo en tiempo real para gerentes y jefaturas. Cara visible de la fábrica.
>
> Inicio prematuro pero estratégico: este panel es la **vidriera del producto** y la base estructural sobre la que crecerá el ERP completo.

---

## 🎯 Objetivo

Construir el **Panel de Monitoreo Principal** de Ingenio La Corona como **primera vista** de lo que será el ERP industrial impulsado por IA (Ingenio Cloud v3.0).

**Audiencia primaria:**
- Gerentes y jefes de turno (sala de control + oficina + planta)
- Jefaturas técnicas (energía, producción, destilería)

**Audiencia secundaria:**
- Operadores (acceso móvil con vista resumida)

**Pantallas target:**
- TV planta / sala de control (1920×1080, sin scroll, 24/7)
- PC oficina (1366–1920px)
- Móvil (operadores + jefaturas en planta)

---

## 📐 Estructura de la app — Monorepo split (backend + frontend)

Aunque este es **primer entregable**, la base se construye como **monorepo split alineado con stack VPS existente** (patrón AVAX: backend NestJS + frontend Next.js 14, Traefik labels, redes Docker compartidas).

```
ingenio-cloud/
├── backend/                       ← NestJS API (port 3001)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── webhooks/          ← /api/webhooks/n8n/* ingesta n8n
│   │   │   ├── guardia/           ← /api/guardia/* KPIs 1x turno
│   │   │   ├── metrics/           ← /api/metrics/snapshot
│   │   │   ├── alerts/            ← CRUD alertas
│   │   │   ├── mssql/             ← cliente MSSQL CORONA read-only
│   │   │   ├── supabase/          ← service role wrapper
│   │   │   └── health/
│   │   ├── common/                ← guards, interceptors, validators
│   │   ├── config/
│   │   └── main.ts
│   └── Dockerfile
│
├── frontend/                      ← Next.js 14 App Router (port 3000)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/       ← protegido auth
│   │   │   │   ├── page.tsx       ← Dashboard principal (este entregable)
│   │   │   │   └── ... (futuros módulos)
│   │   │   ├── (auth)/
│   │   │   ├── tv/                ← /tv modo ambient
│   │   │   └── globals.css        ← tokens INGENIO_CLOUD_DARK
│   │   ├── components/
│   │   │   ├── ui/                ← shadcn base
│   │   │   ├── layout/            ← Sidebar, TopBar
│   │   │   ├── charts/
│   │   │   ├── industrial/        ← MetricTile, LevelBar, AlertStrip, etc.
│   │   │   ├── ai/                ← CopilotBanner placeholder
│   │   │   └── domain/
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   ├── utils/
│   │   │   └── hooks/
│   │   ├── stores/
│   │   └── types/
│   └── Dockerfile
│
├── shared/                        ← tipos + schemas zod compartidos
│
├── infra/
│   ├── docker-compose.yml         ← stack producción VPS
│   └── scripts/                   ← deploy.sh, backup.sh
│
├── docs/                          ← links a /plan
├── .env.example                   ← template VPS (gitignored .env)
├── .env.dev.example               ← template dev local
├── .gitignore
└── README.md
```

**Razón split:** alineación con stack AVAX, escalabilidad, preparación Sprint 1+ donde se agrega tercer servicio `agent/` (FastAPI Python para Vigía Mesh) sin disrupción. Detalles completos: [`11_DEPLOY_VPS_DOCKER.md`](./11_DEPLOY_VPS_DOCKER.md).

---

## 🗂 Navegación del plan

| Doc | Contenido |
|---|---|
| [`01_ARQUITECTURA_Y_STACK.md`](./01_ARQUITECTURA_Y_STACK.md) | App Next.js 14 + estructura + stack técnico + decisiones |
| [`02_DESIGN_SYSTEM.md`](./02_DESIGN_SYSTEM.md) | Paleta INDUSTRIAL_DARK + tokens + tipografía + animaciones |
| [`03_LAYOUT_TV_Y_MOBILE.md`](./03_LAYOUT_TV_Y_MOBILE.md) | Wireframes TV sin scroll + mobile + tablet |
| [`04_COMPONENTES.md`](./04_COMPONENTES.md) | Catálogo componentes + props + variantes |
| [`05_VARIABLES_Y_DATOS.md`](./05_VARIABLES_Y_DATOS.md) | 32 variables mapeadas + sensor_id + fuente + setpoints |
| [`06_INTEGRACION_DATOS.md`](./06_INTEGRACION_DATOS.md) | Webhooks n8n + HTTP + MSSQL + Realtime + estrategia cache |
| [`07_HOOKS_Y_ESTADO.md`](./07_HOOKS_Y_ESTADO.md) | React hooks + Zustand stores + queries |
| [`08_TURNOS_Y_LOGICA_GUARDIA.md`](./08_TURNOS_Y_LOGICA_GUARDIA.md) | Turnos AR + cache 1x turno + invalidación |
| [`09_ROADMAP_EJECUCION.md`](./09_ROADMAP_EJECUCION.md) | 9-12 días + checklists DoD + prompts Claude Code |
| [`10_PENDIENTES_HUMANO.md`](./10_PENDIENTES_HUMANO.md) | Bloqueantes humano + decisiones requeridas |
| [`11_DEPLOY_VPS_DOCKER.md`](./11_DEPLOY_VPS_DOCKER.md) | docker-compose VPS + Traefik + estructura backend+frontend + `.env` template |
| [`12_MEJORAS_PREMIUM.md`](./12_MEJORAS_PREMIUM.md) | 18 mejoras adicionales P0/P1/P2 — sparkline inline, health score, predictive ghost, briefing, mini-mapa, etc. |

---

## 🚀 TL;DR — Resumen ejecutivo

### Qué se construye
Dashboard único `/dashboard` con 3 paneles principales (Energía + Producción + Resumen Guardia) + alerts strip + copilot banner inferior, todo sobre layout fixed-height para TV (sin scroll) y stack tabbed para mobile.

### Variables a exponer (32 totales)
- **Energía (10):** vapor + presiones + agua alimentación + generación eléctrica + gas (actual/acumulado/turno previo)
- **Producción (18):** extracción + clarificación + evaporación + cristalización + destilería + indicador molienda
- **Resumen guardia (4):** molienda promedio + gas turno previo + paradas + velocidad primer molino

### Fuentes de datos
- **Webhooks tiempo real** (n8n → POST /api/webhooks/n8n/*): energía + producción
- **HTTP directo** (proxy interno): molienda promedio actual
- **Consultas MSSQL CORONA**: gas turno previo + paradas (vía MCP `mssql` ya configurado)
- **Webhook 1x turno**: velocidad primer molino (futuro influx, hoy push manual)

### Refresh strategy
- Energía + producción: **realtime** (Supabase Realtime sobre `industrial.metrics_live`)
- Resumen guardia + velocidad molino: **1x por turno** (cache TanStack Query con TTL hasta cambio turno)
- Reloj + turno: client-side `useShift()` con tick segundos

### Estimación
**9-12 días-persona** para versión productiva en planta (incluye TV ambient + mobile + alertas + integración real).

### Stack
Next.js 14 App Router · TS estricto · Tailwind 4 · shadcn/ui · Drizzle ORM · Supabase (Auth + Realtime + Postgres) · TanStack Query · Recharts · ECharts (gauges) · Framer Motion · Geist + JetBrains Mono · @tabler/icons-react · next-intl es-AR · cmdk · Workbox PWA.

### Paleta
`INGENIO_CLOUD_DARK` derivada del logo (azules `#1E5A87` / `#2E7AB5` / `#4A9CD8` + accent cyan `#4FBFE5`). Modo TV ambient mantiene fondo `#0A0E12` + accent honey `#E6A817` para sala control.

### Branding
- **Nombre:** Ingenio Cloud
- **Logo:** [`Media/Logo - Ingenio Cloud.png`](../Media/Logo%20-%20Ingenio%20Cloud.png)
- **Portada:** [`Media/Portada Ingenio Cloud.png`](../Media/Portada%20Ingenio%20Cloud.png)
- **Tagline:** *"Plataforma Inteligente de Monitoreo, Producción y Asistencia Operativa Industrial"*

### Dominio (provisional)
Sin dominio propio aún. Se usa subdominio del servidor tipo `ingcloud.srv878399.hstgr.cloud` (a confirmar). Detalles en [`11_DEPLOY_VPS_DOCKER.md`](./11_DEPLOY_VPS_DOCKER.md).

---

## ✅ Criterio de éxito

- [ ] TV 1920×1080: panel renderiza sin scroll, 3 paneles + topbar + copilot visibles
- [ ] Mobile 375px: stack vertical con tabs, alerta crítica siempre arriba, copilot sticky bottom
- [ ] Datos energía + producción refrescan en tiempo real (latencia < 2s end-to-end)
- [ ] Resumen guardia se carga 1x por turno y persiste hasta cambio turno
- [ ] Fullscreen + wake lock en TV (24/7 sin sleep)
- [ ] Auto-reconexión Realtime con backoff exponencial
- [ ] Estado conexión visible (chip topbar)
- [ ] Setpoints automáticos ok/warn/alarm en cada métrica con borde lateral
- [ ] Flash animado en update de valor
- [ ] Pulse animado en alarma activa
- [ ] Lighthouse > 85 en todas las métricas
- [ ] Type-check + lint sin errores
- [ ] Tests Playwright para flujos críticos: cargar dashboard + cambio turno + alerta crítica + reconexión

---

## 🔄 Cómo continuar después de este entregable

Este panel es el **paso 1 de Sprint 0** del plan v3.0. Una vez productivo:

1. **Sprint 0 sem 2:** integrar Langfuse + observabilidad + backups
2. **Sprint 0 sem 3:** schema completo Supabase + CDC MSSQL CORONA
3. **Sprint 1:** Vigía Mesh v1 (Anomaly + Predictor MVP) → el copilot banner deja de ser placeholder
4. **Sprint 2:** módulos completos (Producción, Energía, Alertas, Zoe) sobre la misma estructura de app

**Decisión técnica clave:** el panel se construye con la **estructura completa de la app**, no como mockup standalone. Las carpetas, hooks, types, design system, routing, layouts y configuración Next.js sirven igual para los próximos 7 sprints. Cero código a tirar.

---

## 📋 Referencias

- [`Panel General/INGENIO_CLOUD_DASHBOARD.md`](../Panel%20General/Plataforma%20ERP%20(Ingenio%20Cloud%20v2.0)/INGENIO_CLOUD_DASHBOARD.md) — spec original dashboard
- [`Panel General/ingenio-cloud-dashboard.html`](../Panel%20General/Plataforma%20ERP%20(Ingenio%20Cloud%20v2.0)/ingenio-cloud-dashboard.html) — mockup HTML standalone (referencia visual)
- [`VariablesDashboardPrincipal.md`](../VariablesDashboardPrincipal.md) — variables a exponer agrupadas
- [`Ingenio Cloud v3.0 - Plan Maestro.md`](../Ingenio%20Cloud%20v3.0%20-%20Plan%20Maestro.md) — plan maestro completo
- [`CLAUDE.md`](../CLAUDE.md) — guía Dev-Wolf (paleta + stack + convenciones)
- [`BDs MMSQL/CORONA_DB_REFERENCE.md`](../BDs%20MMSQL/CORONA_DB_REFERENCE.md) — BD legacy MSSQL

---

**Fecha:** 2026-05-15
**Estado:** Plan listo para ejecución, pendiente aprobación
**Próximo paso:** revisar plan → aprobar → iniciar Día 1 según [09_ROADMAP_EJECUCION.md](./09_ROADMAP_EJECUCION.md)
