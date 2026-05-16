# 09 — Roadmap de ejecución

## Filosofía

Construir el panel **prematuro pero estructurado como app completa**. No es un mockup desechable: es la base del ERP. Cada día tiene **entregable demostrable** y DoD claro.

---

## Estimación general

**9-12 días-persona** según pendientes externos. Trabajaremos en paralelo:
- **Claude Code**: setup, código, schemas, integración, tests
- **Humano**: dominio, VPS, validación visual, info pendiente cliente, deploy producción

---

## Día por día

### 📅 Día 1 — Setup base + diseño tokens (1 día)

**Claude Code:**
- [ ] `pnpm create next-app@latest ingenio-cloud-web` con TypeScript + App Router + Tailwind 4
- [ ] Instalar deps: shadcn/ui CLI, tailwindcss-animate, lucide-react, @tabler/icons-react, framer-motion, zustand, @tanstack/react-query, @tanstack/react-query-devtools, recharts, echarts + echarts-for-react, zod, react-hook-form, @hookform/resolvers, drizzle-orm, drizzle-kit, postgres, mssql, @supabase/ssr, @supabase/supabase-js, @upstash/ratelimit, @upstash/redis, date-fns, date-fns-tz, pino, sonner, cmdk, next-intl, next-themes, class-variance-authority, clsx, tailwind-merge, @types/mssql
- [ ] Dev deps: prettier, eslint-config-next, @typescript-eslint/*, husky, lint-staged, vitest, @testing-library/react, playwright
- [ ] Configurar `tsconfig.json` strict + paths
- [ ] Configurar `tailwind.config.ts` con design tokens INDUSTRIAL_DARK
- [ ] Configurar `next.config.mjs` con headers de seguridad + typedRoutes
- [ ] Crear `src/app/globals.css` con CSS variables (modo dark + TV + light)
- [ ] Cargar fuentes Geist + JetBrains Mono via `next/font/google`
- [ ] `pnpm dlx shadcn@latest init` y agregar componentes base: card, badge, button, tabs, tooltip, skeleton, dialog
- [ ] Estructura carpetas según `01_ARQUITECTURA_Y_STACK.md`
- [ ] `.env.example` completo + `.env.local` con valores dev
- [ ] `README.md` interno del repo con quick start
- [ ] `CLAUDE.md` interno extracto del raíz
- [ ] Configurar Husky + lint-staged + prettier

**Humano:**
- [ ] Confirmar specs VPS (si vamos a usar VPS dev o solo local primero)
- [ ] Aprobar paleta INDUSTRIAL_DARK + decisión sobre TV honey
- [ ] Aprobar nombre del repo + dominio para deploy

**Entregable:** repo inicializado, `pnpm dev` levanta app vacía con tokens cargados.
**DoD:**
- [x] `pnpm typecheck` sin errores
- [x] `pnpm lint` sin warnings
- [x] Página `/` muestra "Ingenio Cloud" con tipografía Geist y paleta dark

---

### 📅 Día 2 — Tipos + utilidades + componentes atómicos (1 día)

**Claude Code:**
- [ ] `src/types/*.ts`: metrics, alerts, shift, webhooks, branded
- [ ] `src/lib/utils/`: cn, format, status, shift (con 8 tests unitarios), calculations
- [ ] `src/lib/constants/variables.ts` con 32 variables completas
- [ ] `src/lib/hooks/`: useClock, useShift, useFlash, useCountUp
- [ ] Componentes atómicos:
  - `<MetricTile />` con variantes status (ok/warn/alarm/unknown) + flash
  - `<LevelBar />` con barra animada
  - `<KpiCard />` con delta + sparkline + counter
  - `<AlertItem />` compact + full
  - `<Sparkline />` Recharts minimal
  - `<PanelHeader />`
  - `<ShiftChip />`
  - `<K2Indicator />`
- [ ] Stories Storybook básicas de cada componente (`Default`, `Alarm`, `Loading`)
- [ ] Tests Vitest de `resolveStatus`, `getCurrentShift`, `getPreviousShift`

**Humano:**
- [ ] Validar visualmente componentes en Storybook
- [ ] Pasar setpoints reales por sensor (sino seguimos con placeholders)

**Entregable:** Storybook con todos los átomos visibles + tests verdes.
**DoD:**
- [x] `pnpm test` todos verde
- [x] Storybook levanta y muestra 8 componentes
- [x] Cada componente tipado completamente

---

### 📅 Día 3 — Layout principal + paneles con mock (1 día)

**Claude Code:**
- [ ] `src/components/layout/TopBar.tsx`
- [ ] `src/components/layout/PageWrapper.tsx`
- [ ] `src/components/layout/ConnectionStatus.tsx`
- [ ] `src/components/industrial/AlertStrip.tsx`
- [ ] `src/components/industrial/KpiHero.tsx`
- [ ] `src/components/industrial/EnergyPanel.tsx` con grid 2×5 + mock data 10 vars
- [ ] `src/components/industrial/ProductionPanel.tsx` con 4 sub-secciones + mock 18 vars
- [ ] `src/components/industrial/ShiftSummaryPanel.tsx` con KPIs 2×2 + alertas + actividad + mock
- [ ] `src/components/industrial/CopilotBanner.tsx` placeholder texto fijo
- [ ] `src/components/domain/MoliendaCard.tsx`
- [ ] `src/lib/mock/data.ts` con datos plausibles para los 32 sensores
- [ ] `src/app/(dashboard)/page.tsx` ensamblado completo con grid 3 columnas
- [ ] CSS module `page.module.css` con `.tv-shell` grid-rows fijos
- [ ] Tabs mobile (`<Tabs />` shadcn) entre Energía/Producción/Guardia

**Humano:**
- [ ] Revisar en pantalla TV real (si es posible) la composición sin scroll
- [ ] Feedback visual densidad/espaciado

**Entregable:** dashboard funcional con datos mockeados, fluye TV + mobile.
**DoD:**
- [x] En 1920×1080 no hay scroll
- [x] En 375px mobile el contenido fluye con tabs
- [x] Stagger animation visible al cargar
- [x] Status borders visibles en sensores con warn/alarm mock

---

### 📅 Día 4 — Supabase setup + schema + cliente (1 día)

**Claude Code:**
- [ ] Configurar Supabase self-hosted local (Docker Compose) o cloud staging
- [ ] Drizzle schema (`src/lib/db/schema.ts`):
  - `industrial.sensor_mapping`
  - `industrial.metrics_live`
  - `industrial.metrics_history` (particionada por mes — pg_partman)
  - `industrial.shift_kpis_cache`
  - `alerts.active`
- [ ] Migrations iniciales (`drizzle-kit generate`)
- [ ] Aplicar RLS policies (multi-tenant futuro, hoy `tenant_id default lacorona`)
- [ ] Seed inicial:
  - 32 filas en `sensor_mapping`
  - Datos iniciales en `metrics_live` plausibles
  - 2-3 alertas warn mock
- [ ] Habilitar Realtime publication en `metrics_live` + `alerts.active`
- [ ] `src/lib/supabase/{client,server,service,realtime}.ts`
- [ ] `src/lib/db/client.ts` Drizzle instance + `src/lib/db/mssql.ts` pool
- [ ] Conectar `<Sidebar />` (versión simplificada) + reservar slots futuros módulos

**Humano:**
- [ ] Confirmar credenciales Supabase + MSSQL CORONA
- [ ] Confirmar `N8N_WEBHOOK_SECRET` para webhooks

**Entregable:** schema aplicado + seed cargado + Studio admin accesible.
**DoD:**
- [x] `drizzle-kit migrate` aplica limpio
- [x] Supabase Studio muestra tablas y datos seed
- [x] Realtime test con `psql UPDATE metrics_live SET value=99 WHERE sensor_id='x'` se ve en canal

---

### 📅 Día 5 — Hooks Realtime + integración panel (1 día)

**Claude Code:**
- [ ] `src/lib/hooks/useRealtimeMetrics.ts` snapshot + subscribe
- [ ] `src/lib/hooks/useActiveAlerts.ts` snapshot + subscribe
- [ ] `src/lib/hooks/useConnectionStatus.ts`
- [ ] `src/lib/hooks/useFullscreen.ts` + `useWakeLock.ts` + `useKeyboardShortcut.ts`
- [ ] `src/app/api/metrics/snapshot/route.ts` GET snapshot inicial
- [ ] Reemplazar mock data en paneles con hooks reales
- [ ] Test manual: edit `metrics_live` desde Studio → panel actualiza realtime
- [ ] Implement `<ConnectionStatus />` con estado live
- [ ] Toast persistente "Reconectando..." con sonner

**Humano:**
- [ ] Test visual updates Realtime
- [ ] Confirmar latencia aceptable (< 2s)

**Entregable:** dashboard reacciona en tiempo real a cambios en BD.
**DoD:**
- [x] Cambio en BD aparece en panel < 2s
- [x] Reconnect tras desconectar/reconectar internet
- [x] Status connection chip refleja estado real
- [x] Flash animado en cada update visible

---

### 📅 Día 6 — Webhooks ingesta + endpoint MSSQL (1 día)

**Claude Code:**
- [ ] `src/lib/validations/webhooks.ts` zod schemas
- [ ] `src/lib/ratelimit.ts` Upstash o in-memory fallback
- [ ] `src/app/api/webhooks/n8n/metrics-energy/route.ts` POST con auth + validación + upsert + history append + cálculo `caudal_total_vapor` + `generacion_total`
- [ ] `src/app/api/webhooks/n8n/metrics-production/route.ts` idem con cálculo `promedio_molienda_turno_actual` + `k2_funcionando` derivado
- [ ] `src/app/api/webhooks/n8n/shift/mill-speed/route.ts` POST 1x turno
- [ ] `src/app/api/guardia/molienda/route.ts` proxy HTTP externo con cache
- [ ] `src/app/api/guardia/gas-previo/route.ts` consulta MSSQL + cache `shift_kpis_cache`
- [ ] `src/app/api/guardia/paradas/route.ts` consulta MSSQL + cache
- [ ] `src/app/api/guardia/vel-molino/route.ts` GET desde cache
- [ ] `src/app/api/health/route.ts`
- [ ] Tests Playwright e2e:
  - Disparar webhook → panel actualiza
  - Cambiar turno → KPIs guardia se invalidan
  - Desconectar → toast aparece

**Humano:**
- [ ] Configurar flow n8n para enviar test payloads
- [ ] Pasar URL real HTTP molienda + auth
- [ ] Validar queries MSSQL exactas (tablas + columnas reales)

**Entregable:** flujo completo end-to-end con datos reales.
**DoD:**
- [x] Webhook n8n con payload real → panel actualiza
- [x] Cambio turno → ShiftKPIs refrescan
- [x] MSSQL gas + paradas devuelven datos válidos
- [x] Rate limit + auth funcionan (test con secret incorrecto = 401)

---

### 📅 Día 7 — Modo TV + PWA mobile (1 día)

**Claude Code:**
- [ ] Ruta `/tv` variante sin sidebar + fullscreen auto
- [ ] Botón fullscreen TopBar + tecla `F`
- [ ] Wake lock activo en TV mode
- [ ] `pointer-events: none` en `?mode=tv` para hover/click
- [ ] Auto-rotación atención: cada 90s zoom 5s a sección con alerta crítica (Framer Motion)
- [ ] Workbox service worker setup PWA
- [ ] `manifest.webmanifest` con icons + colors
- [ ] Mobile tabs energía/producción/guardia funcional
- [ ] AlertStrip persistente arriba mobile
- [ ] CopilotBanner sticky bottom mobile
- [ ] Touch targets ≥ 48px verificado
- [ ] "Add to home screen" prompt mobile

**Humano:**
- [ ] Test en TV real 1920×1080 + tablet + mobile real
- [ ] Aprobar comportamiento auto-rotación (puede molestar — ajustar tiempos)

**Entregable:** modo TV ambient + PWA installable mobile.
**DoD:**
- [x] TV `/tv` en fullscreen 24/7 sin sleep
- [x] Mobile PWA installable y funcional offline (último valor cacheado)
- [x] Lighthouse PWA score > 90

---

### 📅 Día 8 — Sidebar completa + Cmd+K + auth básica (1 día)

**Claude Code:**
- [ ] Sidebar completa con grupos colapsables + future modules señalizados "Próximamente"
- [ ] cmdk Command Palette `Cmd+K` con acciones: navegar a módulo, abrir alertas, toggle fullscreen, refrescar guardia
- [ ] Auth básica Supabase Auth: login email + password
- [ ] Middleware Next.js redirige a login si no autenticado
- [ ] Avatar + perfil dropdown en sidebar footer
- [ ] Logout funcional
- [ ] Branding personalizable (logo + plant name) via env

**Humano:**
- [ ] Crear usuario inicial en Supabase Auth para La Corona
- [ ] Confirmar branding + logo

**Entregable:** login funcional, sidebar profesional, command palette.
**DoD:**
- [x] Login → dashboard
- [x] Logout → login
- [x] Cmd+K abre palette y navega correcto
- [x] Sidebar collapse/expand persiste en localStorage

---

### 📅 Día 9 — Pulido, optimización, accesibilidad (1 día)

**Claude Code:**
- [ ] Lighthouse audit en cada vista, ajustes hasta > 90
- [ ] Optimización imágenes con `next/image`
- [ ] Lazy load componentes pesados (ECharts)
- [ ] Skeleton loaders en estado inicial
- [ ] ARIA labels en todos los componentes interactivos
- [ ] Keyboard navigation completa (Tab + Enter + Esc)
- [ ] Modo claro toggle (excepto TV)
- [ ] Densidad configurable (compact/comfortable/spacious)
- [ ] Modo daltónico (preset de tokens)
- [ ] Error boundary global + custom 404 + custom 500
- [ ] Loading.tsx para route transition
- [ ] Documentación interna: `README.md` + `CONTRIBUTING.md` + comentarios JSDoc en hooks
- [ ] Bundle analyzer + tree-shake unused deps

**Humano:**
- [ ] QA visual en pantalla real
- [ ] Test usabilidad con jefe de turno La Corona

**Entregable:** versión polish lista para deploy.
**DoD:**
- [x] Lighthouse > 90 todas las métricas
- [x] No console.error en runtime
- [x] Type-check + lint + tests todos verde
- [x] Bundle < 500 KB primary chunk

---

### 📅 Día 10-12 — Deploy producción + iteración cliente

**Claude Code:**
- [ ] Dockerfile production multi-stage build
- [ ] docker-compose.yml en VPS con Traefik
- [ ] Variables entorno producción
- [ ] CI/CD GitHub Actions (build + test + deploy)
- [ ] Configurar dominio SSL via Traefik + Let's Encrypt
- [ ] Healthcheck endpoint monitoreado
- [ ] Logs centralizados (pino → archivo + futuro Loki)
- [ ] Backup BD Supabase configurado

**Humano:**
- [ ] Provisionar VPS (si no estaba)
- [ ] DNS configurado
- [ ] Coordinación con jefe de turno La Corona para "launch interno"

**Iteración cliente (días 11-12):**
- [ ] Ajustes según feedback uso real
- [ ] Setpoints reales calibrados (alertas falsas → calibrar)
- [ ] Branding refinado

---

## Resumen tabular

| Día | Foco | Entregable demostrable |
|---|---|---|
| 1 | Setup + tokens | Repo + design system cargado |
| 2 | Átomos + tipos | Storybook con componentes base |
| 3 | Layout + mock | Dashboard mockeado responsive |
| 4 | DB + schema | Supabase con schema + seed |
| 5 | Realtime | Panel reacciona a cambios BD |
| 6 | Webhooks + MSSQL | Datos reales end-to-end |
| 7 | TV + PWA | Modo TV + mobile installable |
| 8 | Sidebar + auth | Login + cmdk + nav |
| 9 | Pulido | Lighthouse > 90 |
| 10-12 | Deploy + iteración | Producción + feedback cliente |

---

## Prompts Claude Code listos para usar

### Prompt 1 — Día 1 Setup

```
Iniciar proyecto Next.js 14 App Router en directorio actual con nombre `ingenio-cloud-web`.

Stack: TypeScript estricto, Tailwind 4, shadcn/ui, Drizzle ORM, Supabase, TanStack Query, Zustand, Framer Motion, Recharts, ECharts, @tabler/icons-react, Geist + JetBrains Mono.

Pasos:
1. pnpm create next-app + setup base
2. Instalar todas las dependencias listadas en /plan/01_ARQUITECTURA_Y_STACK.md sec 2
3. Configurar tailwind.config.ts con tokens INDUSTRIAL_DARK de /plan/02_DESIGN_SYSTEM.md sec 2.1
4. Crear src/app/globals.css con CSS variables (modo dark default + variant TV honey)
5. Cargar fuentes Geist Sans + Geist Mono + JetBrains Mono via next/font/google
6. shadcn init + agregar: card, badge, button, tabs, tooltip, skeleton, dialog, sonner
7. Crear estructura de carpetas exacta según /plan/01_ARQUITECTURA_Y_STACK.md sec 3
8. .env.example completo
9. tsconfig.json strict + paths @/*
10. next.config.mjs con headers seguridad
11. Husky + lint-staged + prettier
12. README.md interno + CLAUDE.md extracto

DoD: pnpm dev levanta página vacía con tipografía y dark mode activo.
```

### Prompt 2 — Día 2 Componentes atómicos

```
Crear todos los tipos + utilidades + hooks + componentes atómicos descritos en:
- /plan/04_COMPONENTES.md sec 2 (Industrial: MetricTile, LevelBar, KpiCard, AlertItem, PanelHeader)
- /plan/04_COMPONENTES.md sec 3 (Charts: Sparkline)
- /plan/05_VARIABLES_Y_DATOS.md sec 4 (tipos TS)
- /plan/05_VARIABLES_Y_DATOS.md sec 8 (utilidades calculations)
- /plan/07_HOOKS_Y_ESTADO.md sec 2 (useClock, useShift, useFlash, useCountUp)
- /plan/08_TURNOS_Y_LOGICA_GUARDIA.md sec 2 (getCurrentShift + getPreviousShift + tests)

Cada componente con cva variants. Usar tokens de design system via Tailwind. Storybook stories básicos.

DoD: pnpm test verde + Storybook muestra 8 componentes.
```

### Prompt 3 — Día 3 Layout + paneles mockeados

```
Crear el dashboard principal completo siguiendo /plan/03_LAYOUT_TV_Y_MOBILE.md y /plan/04_COMPONENTES.md.

Estructura:
- src/app/(dashboard)/layout.tsx con TopBar + slot main
- src/app/(dashboard)/page.tsx con grid TV
- src/components/industrial/{EnergyPanel,ProductionPanel,ShiftSummaryPanel,KpiHero,AlertStrip,CopilotBanner}.tsx
- src/components/layout/{TopBar,PageWrapper,ConnectionStatus}.tsx
- src/lib/mock/data.ts con 32 sensores con valores plausibles

Layout TV 1920x1080:
- Grid rows: 64px (TopBar), [56px AlertStrip cond], 112px (KpiHero), 1fr (body), 80px (Copilot)
- Body grid columns: 1.05fr 1.5fr 1fr (Energía / Producción / Guardia)
- overflow: hidden en TV

Mobile < 768:
- Stack vertical
- Tabs entre 3 paneles
- AlertStrip arriba persistente
- CopilotBanner sticky bottom

DoD: dashboard renderiza sin scroll en 1920x1080 y fluye en mobile.
```

### Prompts 4-9
(detallar en cada día según necesidad — el plan está suficiente para que cada prompt sea derivable)

---

## Checklist final pre-producción

### Pre-Deploy (todas las 22 items del CLAUDE.md Dev-Wolf)

- [ ] Variables entorno documentadas en `.env.example`
- [ ] Tests unitarios > 70% coverage en funciones críticas (shift.ts, status.ts, calculations.ts)
- [ ] E2E Playwright en 4 flujos: cargar dashboard, cambio turno, webhook ingesta, reconexión
- [ ] Build sin warnings TypeScript
- [ ] ESLint sin errores
- [ ] Lighthouse > 85 todas las métricas
- [ ] Responsive verificado 320-1920px
- [ ] Dark mode default + light disponible
- [ ] ARIA labels + keyboard nav
- [ ] Rate limiting configurado
- [ ] Error boundaries en componentes críticos
- [ ] Loading states en operaciones async
- [ ] Empty states con CTA
- [ ] 404 + 500 pages custom
- [ ] Metadata SEO
- [ ] Documentación interna actualizada
- [ ] Backup strategy definida
- [ ] Monitoring configurado (Sentry/GlitchTip)
- [ ] Dominio + SSL
- [ ] CI/CD funcional
- [ ] Healthcheck monitoreado
- [ ] Logs centralizados

---

**Siguiente:** [`10_PENDIENTES_HUMANO.md`](./10_PENDIENTES_HUMANO.md)
