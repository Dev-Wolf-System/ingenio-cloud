# 12 — Mejoras premium del Dashboard

> Features adicionales que elevan el panel de "muy bueno" a **vendible solo con screenshot**. Todas respetan pautas: TV sin scroll, mobile scroll, dark default, paleta `INGENIO_CLOUD_DARK`, multi-tenant futuro, realtime, estructura app ERP.
>
> Priorizadas P0 (Sprint 0 — al MVP), P1 (Sprint 0 final), P2 (Sprint 1+ junto a Vigía).

---

## 🎯 P0 — Incluir en MVP (al alcance días 1-12)

### 1. Sparkline inline en cada MetricTile (60 lecturas últimas)

**Qué:** cada `<MetricTile />` lleva debajo del valor un sparkline ghostly mostrando últimas 60 lecturas (5 min @ 5s o 15 min @ 15s según frecuencia). Color del trazo = color del status actual.

**Por qué:** contexto histórico sin agregar componente. Operador ve "subió de pronto" vs "estable hace rato" de un vistazo. Cero clutter (sparkline 16px alto, opacity 0.5).

**Implementación:**
- Backend: agregar columna virtual `recent_values numeric[]` calculada con window function sobre `metrics_history`
- Frontend: prop opcional `sparkline?: number[]` en MetricTile, render con Recharts MiniLine height=14
- Cache: Realtime trigger actualiza recent_values cada 30s (no en cada tick, batch)

**Refs:** [04_COMPONENTES.md sec 2.3](./04_COMPONENTES.md), [05_VARIABLES_Y_DATOS.md](./05_VARIABLES_Y_DATOS.md)

---

### 2. Shift Timeline visual bajo topbar

**Qué:** barra horizontal delgada (3-4px) bajo TopBar mostrando progreso del turno actual: línea base 0% → 100% con marcador "ahora" + tooltips en tick points (1h, 2h, 3h, 4h, 5h, 6h, 7h, 8h).

**Por qué:** operador siempre sabe cuánto queda del turno sin calcular. Visual + ambiental. Gerente entiende "estamos en mitad de turno" inmediato.

```
TopBar:    Ingenio Cloud · Planta Sur · Turno Tarde 14:32 [F]
ShiftBar:  ────────●────────────────────────────────────────
           start                   ↑                     end
                                   18% de turno transcurrido
```

**Implementación:**
- Componente `<ShiftTimeline />` usa `useShift()` para start/end/progress
- Color gradient `var(--primary-dark) → var(--primary-light)`
- Marcador "ahora" pulsando suave
- Click en marcador abre `<ShiftDetailsPopover />` con histórico de eventos del turno

---

### 3. Health Score por panel (Energía / Producción / Fábrica global)

**Qué:** cada panel lleva en su `<PanelHeader />` un score 0-100 calculado en tiempo real basado en cuántos sensores están ok vs warn vs alarm.

```
ENERGÍA  ●●●  87/100  (10 sensores: 9 ok, 1 warn)
PRODUCCIÓN  ●●○  73/100  (18 sensores: 14 ok, 3 warn, 1 alarm)
FÁBRICA GLOBAL  ●○○  79/100
```

**Por qué:** vista holística instantánea. Gerente que entra al panel sabe en 1s si está bien. Refuerza decisión "dónde mirar".

**Cálculo:**
```
score = (ok * 100 + warn * 60 + alarm * 0) / total
```

**Implementación:**
- Calcular client-side a partir de metrics del area
- Color score: ok > 85, warn > 60, alarm < 60
- Animar transiciones con `useCountUp`

---

### 4. Anomaly highlight visual

**Qué:** cuando un sensor cambia de `ok` → `warn` o `warn` → `alarm`, el tile no solo flashea cyan (update normal) sino que pulsa rojo 5s + glow `var(--glow-danger)` + scale 1.02 + opcional sonido.

**Por qué:** cambio de estado es **el evento más importante** en monitoreo industrial. No debe perderse en updates normales.

**Implementación:**
- Hook `useStatusChange(prev, current)` detecta transición
- CSS animation `anomaly-spotlight 5s ease-out`
- Sonido opcional vía `<audio>` (configurable en preferencias usuario)
- En mobile/PWA → vibración nativa breve

---

### 5. Activity Stream con observaciones sticky

**Qué:** en `<ShiftSummaryPanel />` reemplazar "Actividad reciente" placeholder por feed real combinando:
- Observaciones operadores (registradas vía Zoe o panel)
- Cambios de estado de alertas
- Cambios de turno
- Eventos importantes (parada iniciada, OT creada)

```
🟢 Cambio turno · Tarde · 13:00
📝 Cambio filtros entrada · 14:12 · Juan G.
⚠ Caldera 6 → warn · 14:21
✓ pH normalizado · 14:32
📋 OT-234 cerrada · 14:45 · Roberto P.
```

**Por qué:** narrativa del turno. Contexto que valores aislados no dan. Gerente entiende "qué pasó".

**Implementación:**
- Tabla `tenant_data.observations` y `audit.events` ya en plan
- Subscribe Realtime a ambas
- Componente `<ActivityStream />` con virtualización (react-virtual) si > 50 items
- Filtro por tipo + búsqueda

---

### 6. Notificaciones push browser para alertas críticas

**Qué:** cuando llega `critical` alert y la pestaña está minimizada o el panel está en otro tab, dispara notificación nativa del navegador (Notifications API).

**Por qué:** gerente puede tener el panel abierto en segundo monitor sin mirar. La notificación lo trae de vuelta. Operadores en mobile reciben push como app nativa via PWA.

**Implementación:**
- Pedir permisos `Notification.requestPermission()` en primer login
- Service worker maneja push (Workbox)
- Stored en preferencias usuario: opt-in/out por severity

---

### 7. Predictive trend ghost lines (placeholder S0 → ML real S1)

**Qué:** en sparklines de tiles + en sección guardia, mostrar una línea ghosty proyectando tendencia próximos 30min basado en regresión lineal simple (placeholder S0). En S1 reemplaza con Prophet/XGBoost real.

```
Caudal Caldera 6
  18.2 bar  ↗
  ──────●╌╌╌╌╌╌╌╌  (sólido = histórico, ghost = predicción)
  -30m            +30m
  ⚠ Si tendencia continúa: 19.4 bar en 30min
```

**Por qué:** anticipación. Convierte panel reactivo en panel predictivo desde día 0. Es el "wow factor" que vende a gerentes.

**Implementación S0:**
- Regresión lineal simple en últimos 10 puntos
- Confidence interval shaded
- Etiqueta solo si pendiente excede umbral configurable

**Implementación S1:** reemplazo con endpoint `/api/ai/forecast` desde Vigía-Predictor.

---

### 8. Smart density auto

**Qué:** detectar tamaño pantalla + densidad píxeles + zoom y ajustar automáticamente:
- TV 1920px → density compact (más info por px²)
- PC 1366-1919 → density comfortable
- Mobile → density spacious (touch targets ≥ 48px)
- Usuario puede override en preferencias

**Por qué:** cero configuración. Funciona out-of-the-box en cualquier pantalla.

**Implementación:**
- `useUIStore` con `density: 'auto' | 'compact' | 'comfortable' | 'spacious'`
- `useMatchMedia` para detección
- Tokens Tailwind con prefijo densidad: `text-sm-compact`, `gap-2-compact`, etc.

---

## 🎯 P1 — Final Sprint 0 (días 10-12 + iteración cliente)

### 9. Modo "Briefing" — Cmd/Ctrl+B

**Qué:** pulsar B (sin modifier — fácil acceso TV) abre modal full-screen con resumen 30s:

```
┌─────────────────────────────────────────────────┐
│  Briefing — Turno Tarde · 14:32                  │
│                                                  │
│  📊 Estado general: NORMAL (87/100)              │
│  ⚠ 2 alertas activas — 1 crítica                │
│  🏭 Producción: 6.629 t/h (↑3% vs ayer)         │
│  ⚡ Generación: 12.4 MW                          │
│  🔥 Gas: 320 m³/h actual, 380 m³/h promedio prev│
│                                                  │
│  🤖 Sugerencia copiloto:                         │
│  "Caldera 6 en tendencia ascendente. Revisar."  │
│                                                  │
│  [Cerrar (Esc)]   [Marcar revisado]              │
└─────────────────────────────────────────────────┘
```

**Por qué:** gerente que entra a sala control quiere síntesis en 5s, no leer 32 valores. Briefing condensado.

**Implementación:**
- Tecla `B` global (`useKeyboardShortcut`)
- Modal Radix Dialog
- Snapshot completo + delta vs ayer + sugerencia copilot (placeholder S0)
- Opción "leer en voz alta" (TTS opcional S3)

---

### 10. Quick Actions Floating button "Q"

**Qué:** botón flotante bottom-right (mobile) o bottom de copilot banner (PC/TV) que abre paleta de acciones rápidas:

```
[Q] Acciones rápidas
├─ ✏ Registrar observación
├─ 🔕 Silenciar alarma X
├─ 📨 Enviar reporte ahora
├─ 🔄 Forzar refresh KPIs guardia
├─ ⬛ Modo TV
├─ 🌓 Cambiar tema
└─ ❓ Pedir ayuda Zoe (S2+)
```

**Por qué:** acciones operativas accesibles en 2 clicks desde cualquier pantalla. Reduce fricción.

**Implementación:**
- Similar a Cmd+K pero con acciones específicas
- Shortcut tecla `Q` o long-press en mobile
- cmdk library

---

### 11. Mini-mapa de planta esquemático

**Qué:** en una esquina (bottom-left desktop), un esquemático SVG del flujo de proceso con nodos colorados según health score del área:

```
🟢 [Caña] → 🟢 [Molienda] → 🟢 [Clarificación] → 🟡 [Evaporación] → 🟢 [Cristalización] → 🟢 [Empaque]
                                                       │
                                                       └─ 🟢 [Destilería]
```

**Por qué:** comprensión visual del proceso completo. Click en nodo → drilldown a esa sección con métricas detalladas (Sprint 2+ módulos completos).

**Implementación:**
- SVG component custom
- Nodos clickeables
- Color reactivo a health score area
- En TV: visible siempre. En mobile: tab adicional.

---

### 12. Comparativa actual vs turno previo

**Qué:** en cada KPI hero, además del valor, un mini-delta vs **mismo turno del día anterior** (no turno previo de hoy, sino "Mañana ayer").

```
┌─────────────────────────────────┐
│ MOLIENDA PROMEDIO ACTUAL        │
│   6.629 t/h                    │
│   ↑ +127 t/h vs Mañana ayer    │
│   ↑ +3% vs Promedio última semana│
└─────────────────────────────────┘
```

**Por qué:** contexto comparativo. "¿Estamos mejor o peor que ayer?" responde en 1 vistazo.

**Implementación:**
- Endpoint `/api/analytics/compare?metric=molienda&period=same_shift_yesterday`
- Cache 5 min
- Mostrar 1 o 2 deltas según espacio

---

### 13. Reportes export PDF instantáneo

**Qué:** botón "Exportar vista" en TopBar (o tecla `P`) que genera PDF de la vista actual con timestamp + datos del turno + branding Ingenio Cloud.

**Por qué:** gerente puede compartir snapshot en WhatsApp inmediato sin tomar foto pantalla. Más profesional.

**Implementación:**
- `react-pdf` library
- Template profesional con logo + fecha + turno + datos
- Server-side rendering vía `/api/reports/snapshot` (opcional para mejor calidad)
- En mobile: directo a share API nativo

---

## 🎯 P2 — Sprint 1+ (con Vigía Mesh)

### 14. Voice greeting + announcer TV (cargar)

**Qué:** al cargar `/tv` mode, opcional TTS narra:
> "Buenos días. Turno Mañana iniciando. Estado fábrica: normal. 2 alertas activas. Producción 6.629 toneladas hora."

Anuncios automáticos por TTS al recibir alerta crítica:
> "Atención. Caldera 6 presión sobre límite."

**Por qué:** operador en planta sin pantalla puede escuchar. Sala control ambiental. Voz como canal natural.

**Implementación:** OpenAI TTS API + `<audio>` element. Toggle opcional en preferencias TV.

---

### 15. Heatmap energético

**Qué:** widget opcional con grilla 2D de sensores energía, cada celda colored según `status + value vs setpoint distance`. Verde frío (lejos del límite) → rojo caliente (cerca/excede).

**Por qué:** diagnóstico visual instantáneo de qué área está estresada.

**Implementación:** ECharts heatmap o D3 custom. Solo en PC/TV (no aplica mobile).

---

### 16. Replay / Time Machine

**Qué:** botón "Playback" → slider de timeline que permite ver el panel **como estaba en cualquier momento del pasado** (hasta 30 días). Útil para post-mortems de paradas.

```
[Now ●─────────────────────────] Hoy 14:32

Drag slider →
[Now ────●────────────────────] Hoy 12:48 (parada caldera 6)
```

**Por qué:** análisis retrospectivo sin abrir Grafana. Investigaciones "¿qué pasó cuando paró todo?" trivial.

**Implementación:** route `/playback?at=<iso>`. Query `metrics_history` + `alerts_history` snapshot. UI igual al panel live pero solo lectura.

---

### 17. Inspector de IA (mostrar trazabilidad respuestas Zoe)

**Qué:** cuando Zoe (S2+) responde, botón "🔍 Ver cómo lo decidió" abre side-panel con:
- Tools llamadas
- Datos consultados
- Modelo usado
- Tokens + costo
- Latencia
- Confidence

**Por qué:** transparencia genera confianza. Operador conservador acepta IA cuando ve "por qué".

**Implementación:** Langfuse trace embedding + custom UI.

---

### 18. Per-tenant branding override

**Qué:** futuro multi-cliente: cada tenant puede override:
- Logo
- Color `--primary`
- Nombre de marca visible
- Dominio: `panelclienteX.ingeniocloud.app`

**Por qué:** clientes Enterprise quieren branding propio. Diferenciación competitiva.

**Implementación:** tabla `core.tenant_branding` + middleware Next.js inyecta tokens CSS por tenant. Sprint 6+.

---

## Resumen tabla

| # | Mejora | Prio | Impacto | Esfuerzo | Sprint |
|---|---|---|---|---|---|
| 1 | Sparkline inline tiles | P0 | Alto | Bajo | S0 D5 |
| 2 | Shift timeline bar | P0 | Medio | Bajo | S0 D3 |
| 3 | Health score paneles | P0 | Alto | Bajo | S0 D5 |
| 4 | Anomaly highlight visual | P0 | Alto | Bajo | S0 D5 |
| 5 | Activity stream | P0 | Alto | Medio | S0 D6 |
| 6 | Push notifications | P0 | Alto | Bajo | S0 D7 |
| 7 | Predictive ghost lines | P0 | **Muy Alto** | Medio | S0 D8 |
| 8 | Smart density auto | P0 | Medio | Bajo | S0 D9 |
| 9 | Modo Briefing | P1 | Alto | Medio | S0 D10 |
| 10 | Quick Actions Q | P1 | Medio | Medio | S0 D10 |
| 11 | Mini-mapa planta | P1 | **Muy Alto** | Medio | S0 D11 |
| 12 | Comparativa vs ayer | P1 | Alto | Medio | S0 D11 |
| 13 | Export PDF instantáneo | P1 | Medio | Bajo | S0 D12 |
| 14 | Voice greeting TTS | P2 | Medio | Medio | S1+ |
| 15 | Heatmap energético | P2 | Bajo | Medio | S2 |
| 16 | Playback time machine | P2 | **Muy Alto** | Alto | S3 |
| 17 | Inspector IA | P2 | Alto | Medio | S2 (Zoe) |
| 18 | Per-tenant branding | P2 | Alto | Alto | S6 |

**Recomendación:** incluir TODAS las P0 + las P1 más impactantes (Briefing + Mini-mapa + Comparativa) en MVP Sprint 0. Eso es lo que hace al panel **vendible solo con screenshot**.

---

## Ajustes al roadmap original

Reorganizo días 5-12 para incluir mejoras P0/P1 sin extender tiempo (ajusto alcance otros días):

| Día | Antes | Ahora con mejoras |
|---|---|---|
| 3 | Layout mockeado | Layout + **Shift Timeline + Health Score paneles** |
| 5 | Hooks Realtime | Realtime + **Sparkline inline tiles** + **Health Score live** |
| 6 | Webhooks + MSSQL | Webhooks + MSSQL + **Activity Stream backend** |
| 7 | TV + PWA | TV + PWA + **Push notifications** + **Anomaly highlight** |
| 8 | Sidebar + auth + cmdk | + **Modo Briefing (tecla B)** + **Quick Actions (tecla Q)** |
| 9 | Pulido | Pulido + **Predictive ghost lines** + **Smart density** + **Mini-mapa planta** |
| 10 | Deploy | Deploy + **Export PDF** + **Comparativa vs ayer** |
| 11-12 | Iteración cliente | Iteración + ajustes basados en uso real |

---

## Justificación: estas mejoras siguen las pautas

| Mejora | Pauta respetada |
|---|---|
| Sparkline inline | No agrega clutter (16px alto, opacity 0.5) |
| Shift Timeline | Información siempre visible (regla CLAUDE.md) |
| Health Score | Densidad sin clutter (refuerza vista holística) |
| Anomaly highlight | Estado visible siempre (regla TV) |
| Activity Stream | Contexto + audit trail (compliance) |
| Push notifications | Errores explícitos (no perder eventos) |
| Predictive ghost | Asistencia IA, no decisión |
| Briefing | Operador UX dominante (síntesis 5s) |
| Quick Actions | Acciones críticas con confirmación |
| Mini-mapa | Densidad inteligente, drilldown lazy |
| Comparativa | Densidad información sin clutter |
| Export PDF | Reportes profesionales + branding |

Todas usan paleta `INGENIO_CLOUD_DARK`, multi-tenant ready, realtime cuando aplica, cache 1x turno cuando aplica, structure app preparada para ERP.

---

## Mockup mental — Panel final con mejoras

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo] Ingenio Cloud · Planta Sur          [● Copilot] [Score 87/100] [⌚]  │
│ ════════●════════════════════════════════ Turno Tarde · 18% transcurrido    │ ← shift timeline
├─────────────────────────────────────────────────────────────────────────────┤
│ [Alert strip condicional]                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ KPI Hero — 4 cards con sparkline + comparativa vs ayer + delta              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                            │
│ │ 6.629   │ │ 9.739   │ │ 12.4 MW │ │ 2 ⚠ + 1 ◆│                          │
│ │ t/h ↑3% │ │ bolsas  │ │ ↑1.2% ay│ │ activas │                            │
│ │ ╱╱╲╱╲╱  │ │ Meta ✓  │ │ ─╱─╲─╱─ │ │ pulse   │                            │
│ │ +127ayer│ │ ━━━━━   │ │         │ │         │                            │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ ENERGÍA 87/100 ●●● │ PRODUCCIÓN 73/100 ●●○ │ RESUMEN GUARDIA              │
│ ┌─┬─┬─┬─┐          │ pH/SUL/TC/POL/AIR/K2  │ Mol prom · Gas prev          │
│ │•│•│•│•│ sparkl   │ ┌─┬─┬─┐ ┌─┬─┬─┐      │ ┌────┬────┐                 │
│ ├─┼─┼─┼─┤          │ └─┴─┴─┘ └─┴─┴─┘      │ │6.642│380 │                 │
│ │•│•│•│•│          │                       │ ├────┼────┤                 │
│ ├─┼─┼─┼─┤          │ Niveles 2×2 LevelBar  │ │ 2  │4.8r│                 │
│ │•│•│•│•│ ghost↗   │ ████░░░ ██████░░     │ └────┴────┘                 │
│ └─┴─┴─┴─┘ trend    │                       │                              │
│                     │ Caudales 3×2          │ Activity stream:             │
│                     │ ┌─┬─┬─┐               │ • Cambio turno 13:00         │
│                     │ └─┴─┴─┘               │ • Cambio filtros 14:12 J.G.  │
│                     │                       │ • Caldera 6 → warn 14:21     │
│                     │                       │ • OT-234 cerrada 14:45 R.P.  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🟢 Caña → 🟢 Mol → 🟢 Clar → 🟡 Evap → 🟢 Crist → 🟢 Emp / 🟢 Dest         │ ← mini-mapa
├─────────────────────────────────────────────────────────────────────────────┤
│ 🤖 Copilot: "Caldera 6 tendencia ascendente. ¿Generar OT?"                   │
│                                              [Generar OT] [Ignorar] [···]   │
└─────────────────────────────────────────────────────────────────────────────┘
[Q]  ← Quick Actions floating
```

---

**Mantra del panel mejorado:** *"Cada pixel cuenta una historia. Cada cambio se ve. Cada tendencia anticipa. Cada decisión informada."*

---

**Volver al índice:** [`README.md`](./README.md)
