# 03 — Layout TV + Mobile

## 1. Filosofía responsive

| Pantalla | Strategy | Scroll |
|---|---|---|
| TV 1920×1080 (sala control) | **Fixed-height, sin scroll**, fluido con `clamp()` | **No** |
| PC 1366-1920 (oficina) | Mismo layout TV, scroll permitido si overflow | Sí, suave |
| Tablet 768-1023 | 2 columnas, secciones colapsables | Sí |
| Mobile < 768 | Stack vertical + Tabs entre secciones | Sí |

---

## 2. Layout TV 1920×1080 (sin scroll)

### 2.1 Wireframe ASCII

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR (h: 64px)                                                             │
│ [Logo Ingenio Cloud] · Planta Sur          [● Copiloto activo] [⌚ 14:32:17 │
│                                                              · Turno Tarde] │
│                                                              [⛶ Fullscreen]│
├──────────────────────────────────────────────────────────────────────────────┤
│ ALERT STRIP (condicional, h: 56px) — solo si hay alerta crítica activa       │
│ ⚠ Caldera 6 — Presión sobre límite — 18.2 bar > 17.5 bar  [Detalles →]     │
├──────────────────────────────────────────────────────────────────────────────┤
│ KPI HERO (h: 112px) — 4 cards principales                                    │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐│
│ │ Molienda       │ │ Producción     │ │ Generación     │ │ Alertas        ││
│ │ promedio       │ │ azúcar diaria  │ │ eléctrica      │ │ activas        ││
│ │   6.629 t/h ▲ │ │  9.739 bolsas │ │   12.4 MW    │ │     2 críticas  ││
│ │ ··•··•·•·•·•·· │ │ Meta 9.000 ✓  │ │ +3% vs ayer    │ │ 1 warning      ││
│ └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘│
├──────────────────────────────────────────────────────────────────────────────┤
│ BODY GRID 3 cols (1.05fr · 1.5fr · 1fr) (h: flex-1)                          │
│ ┌──────────────────┐ ┌─────────────────────────┐ ┌────────────────────────┐│
│ │ ENERGÍA          │ │ PRODUCCIÓN              │ │ RESUMEN GUARDIA        ││
│ │                  │ │                         │ │                        ││
│ │ ┌───┬───┬───┬───┐│ │ Proceso químico (3×2)   │ │ ┌────┬────┐            ││
│ │ │   │   │   │   ││ │ ┌───┬───┬───┐           │ │ │MOL │GAS │ (KPIs 2×2)││
│ │ ├───┼───┼───┼───┤│ │ │pH │SUL│TC │           │ │ │PROM│PREV│            ││
│ │ │   │   │   │   ││ │ ├───┼───┼───┤           │ │ ├────┼────┤            ││
│ │ ├───┼───┼───┼───┤│ │ │POL│AIR│K2 │           │ │ │PAR │VEL │            ││
│ │ │   │   │   │   ││ │ └───┴───┴───┘           │ │ │ADAS│MOL │            ││
│ │ ├───┼───┼───┼───┤│ │                         │ │ └────┴────┘            ││
│ │ │   │   │   │   ││ │ Niveles (2×2)           │ │                        ││
│ │ ├───┼───┼───┼───┤│ │ ████░░░ ████████        │ │ Alertas activas (list) ││
│ │ │   │   │   │   ││ │ ████░░░ █████░░░        │ │ • Caldera 6 ⚠ 14:21   ││
│ │ └───┴───┴───┴───┘│ │                         │ │ • pH bajo ⚠ 14:18     ││
│ │ (10 tiles 2×5)   │ │ Caudales (3×2)          │ │ • OT-234 ◆ 12:55      ││
│ │                  │ │ ┌───┬───┬───┐           │ │                        ││
│ │                  │ │ │CJD│CAL│MEL│           │ │ Actividad reciente     ││
│ │                  │ │ ├───┼───┼───┤           │ │ ⏱ Cambio turno 13:00  ││
│ │                  │ │ │NTM│NM1│PAD│           │ │ ⏱ Lectura lab 12:45   ││
│ │                  │ │ └───┴───┴───┘           │ │                        ││
│ └──────────────────┘ └─────────────────────────┘ └────────────────────────┘│
├──────────────────────────────────────────────────────────────────────────────┤
│ COPILOT BANNER (h: 80px) — placeholder Sprint 0, activo desde Sprint 1       │
│ 🤖 Copiloto: "Presión caldera 6 en tendencia ascendente últimos 12 min.     │
│                Revisar válvula de escape. ¿Generar OT?"                      │
│                                              [Generar OT] [Ignorar] [···]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Distribución vertical (TV 1080px disponible)

| Sección | Alto | Cuándo |
|---|---|---|
| TopBar | 64px | Siempre |
| AlertStrip | 56px | Condicional (recompone si oculta) |
| KpiHero | 112px | Siempre |
| Body grid | flex-1 (~744px sin alert, ~688px con) | Siempre |
| CopilotBanner | 80px | Siempre |
| **Total disponible body** | **688-744px** | — |

### 2.3 Grid 3 columnas

```css
.body-grid {
  display: grid;
  grid-template-columns: 1.05fr 1.5fr 1fr;
  gap: var(--space-3);
  height: 100%;
  overflow: hidden;       /* fuerza no-scroll en TV */
}
```

**Razón proporciones:**
- Energía 1.05fr → 10 tiles 2×5 ocupan más alto
- Producción 1.5fr → 3 sub-secciones internas, necesita ancho
- Guardia 1fr → KPIs 2×2 + lista compacta

### 2.4 Detalle paneles internos

#### EnergyPanel (grid 2×5 = 10 tiles)

```
┌────────────┬────────────┬────────────┬────────────┐
│ Caudal     │ Caudal     │ Caudal     │ Caudal     │
│ TOTAL VAP. │ CALDERA 2  │ CALDERA 3  │ CALDERA 6  │
│  185 t/h   │  62 t/h    │  58 t/h    │  65 t/h    │
├────────────┼────────────┼────────────┼────────────┤
│ Presión    │ Presión    │ Presión    │ Presión    │
│ ALTA/BAJA  │ ESCAPE     │ VG1        │ AGUA ALIM. │
│ 19.2 bar   │ 2.1 bar    │ 8.4 bar    │ 14.2 bar   │
├────────────┼────────────┼────────────┼────────────┤
│ Temp. agua │ Generación │ Gas actual │ Gas total  │
│ ALIMENT.   │ ELÉCTRICA  │            │ DÍA        │
│ 105 °C     │ 12.4 MW    │ 320 m³/h   │ 4.820 m³  │
└────────────┴────────────┴────────────┴────────────┘
```

(10 tiles → grid 4×3 = 12 slots, dejo 2 vacíos para futuras métricas o uso 2×5 = 10 exacto)

**Decisión:** grid 4 columnas × 3 filas con 10 tiles ocupados + 2 placeholders ocultos (`md:hidden`).

#### ProductionPanel (3 sub-secciones)

**Sub-sección 1: Proceso químico (3×2 = 6 tiles)**
```
┌─────────┬─────────┬─────────┐
│ pH      │ Sulfit. │ Temp.   │
│ jugo    │         │ calent. │
├─────────┼─────────┼─────────┤
│ Pol     │ Aire    │ K2      │
│ cachaza │         │ (vapor) │
└─────────┴─────────┴─────────┘
```

**Sub-sección 2: Niveles (2×2 = 4 LevelBar)**
```
┌──────────────────┬──────────────────┐
│ Jugo pesado      │ Jugo clarificado │
│ ████████░░ 78%   │ ██████░░░░ 62%   │
├──────────────────┼──────────────────┤
│ Melado tratado   │ Cristalizador 1° │
│ █████░░░░░ 45%   │ ███████░░░ 71%   │
└──────────────────┴──────────────────┘
```

**Sub-sección 3: Caudales y salidas (3×2 = 6 tiles)**
```
┌─────────┬─────────┬─────────┐
│ Caudal  │ Caudal  │ Caudal  │
│ jugo→   │ alcohol │ vino    │
│ destil. │         │ destil. │
├─────────┼─────────┼─────────┤
│ Nivel   │ Nivel   │ Color/  │
│ agua    │ melado  │ humedad │
│ foza    │ 1/2     │ azúcar  │
└─────────┴─────────┴─────────┘
```

**Adicional sub-sección 4 (compacto top): Producción azúcar + indicador molienda**
```
┌──────────────────────────┬──────────────────────────┐
│ Producción azúcar diaria │ Promedio molienda actual │
│  9.739 bolsas           │   6.629 t/h            │
│  Meta: 9.000 ✓          │   Turno: 02h 18min      │
└──────────────────────────┴──────────────────────────┘
```

#### ShiftSummaryPanel (3 bloques)

**Bloque 1: KPIs guardia (2×2)**
```
┌────────────────┬────────────────┐
│ MOLIENDA       │ GAS TURNO      │
│ PROMEDIO       │ ANTERIOR       │
│ 6.642 t/h     │ 380 m³/h prom  │
│ ✓ Actual       │ 3.040 m³ tot   │
├────────────────┼────────────────┤
│ PARADAS        │ VEL. PRIMER    │
│ TURNO PREV     │ MOLINO PREV    │
│ 2 paradas     │ 4.8 rpm prom   │
│ 47 min total   │ Gráfica →      │
└────────────────┴────────────────┘
```

**Bloque 2: Lista alertas activas**
```
┌─────────────────────────────────┐
│ ALERTAS ACTIVAS (3)             │
├─────────────────────────────────┤
│ ⚠ Caldera 6 — Presión           │
│   18.2 bar > 17.5 bar           │
│   14:21 · hace 11 min           │
├─────────────────────────────────┤
│ ⚠ pH jugo bajo                  │
│   5.8 < 6.0                     │
│   14:18 · hace 14 min           │
├─────────────────────────────────┤
│ ◆ OT pendiente · centrífuga 2   │
│   12:55                         │
└─────────────────────────────────┘
```

**Bloque 3: Actividad reciente / placeholder copilot mobile**
```
┌─────────────────────────────────┐
│ Cambio turno · 13:00            │
│ Lectura lab · 12:45             │
│ Inicio molienda · 06:00         │
└─────────────────────────────────┘
```

---

## 3. Layout PC oficina (1366-1919)

Idéntico a TV pero:
- Sidebar visible (no se quita)
- Topbar incluye búsqueda Cmd+K + perfil + notificaciones
- Scroll permitido si content > viewport
- KPI hero puede pasar a 2×2 grid en 1366px
- Tile font escala automática vía clamp

### 3.1 Wireframe PC

```
┌──┬───────────────────────────────────────────────────────────────────┐
│S │ TopBar — [Search Cmd+K] [⚙ Notif] [👤 Perfil] [⌚ Turno + Reloj]│
│i ├───────────────────────────────────────────────────────────────────┤
│d │ AlertStrip (cond.)                                                │
│e ├───────────────────────────────────────────────────────────────────┤
│b │ KpiHero — 4 cards (responsive: 4 col en >1280, 2×2 en <1280)     │
│a ├───────────────────────────────────────────────────────────────────┤
│r │ Body grid (igual TV)                                              │
│  ├───────────────────────────────────────────────────────────────────┤
│  │ CopilotBanner                                                     │
└──┴───────────────────────────────────────────────────────────────────┘
```

### 3.2 Sidebar

```
┌───────────────────────┐
│ [▼ Logo IngenioCloud] │
│  Planta Sur ▾         │
├───────────────────────┤
│ — General             │
│ 📊 Dashboard      [activo]
│ 🏭 Producción         │
│ ⚡ Energía            │
│ 🔬 Laboratorio        │
│ ⚙ Equipos            │
│                       │
│ — Operación           │
│ 🚨 Alertas       (3)  │
│ 🔧 Mantenimiento      │
│ 📋 Reportes           │
│                       │
│ — IA                  │
│ 🤖 Zoe                │
│                       │
│ — Admin               │
│ ⚙ Configuración      │
│ 👥 Usuarios           │
├───────────────────────┤
│ [👤 nlobo@lacorona]   │
│ Jefe de turno      ▾ │
└───────────────────────┘
```

Colapsable: en mobile drawer, en PC clic icono hamburguesa para versión 56px solo iconos.

---

## 4. Layout Mobile (< 768px)

### 4.1 Estructura

```
┌────────────────────────┐
│ TopBar (h: 56px)       │
│ [☰] IngenioCloud [⚙]  │
│ Turno Tarde · 14:32    │
├────────────────────────┤
│ AlertStrip (siempre    │
│ arriba si activa)      │
├────────────────────────┤
│ KpiHero (2×2)          │
│ ┌────────┬────────┐    │
│ │ Mol.   │ Azúcar │    │
│ │ 6.6t/h │ 9.7Kb  │    │
│ ├────────┼────────┤    │
│ │ Gen.   │ Alert  │    │
│ │ 12.4MW │  2  │    │
│ └────────┴────────┘    │
├────────────────────────┤
│ Tabs ▼                 │
│ [Energía][Prod][Guard] │
├────────────────────────┤
│ Contenido tab actual   │
│ (scroll vertical)      │
│                        │
│                        │
│                        │
├────────────────────────┤
│ Copilot sticky bottom  │
│ 🤖 Sugerencia activa  │
│ [Acción] [Cerrar]      │
└────────────────────────┘
```

### 4.2 Decisiones mobile

- **Sin sidebar** — drawer al tocar `☰`
- **Tabs** entre Energía / Producción / Guardia (no 3 columnas)
- **Copilot sticky** bottom siempre visible (60px)
- **AlertStrip** persistente arriba (no se oculta)
- **PWA installable** — desde menú "Add to home screen"
- **Touch targets ≥ 48px** (botones grandes para guantes)
- **Modo linterna** — toggle setting para invertir más oscuro + tipo más grande

---

## 5. Breakpoints Tailwind

```typescript
// tailwind.config.ts
screens: {
  'xs':   '375px',     // mobile pequeño
  'sm':   '640px',     // mobile grande
  'md':   '768px',     // tablet
  'lg':   '1024px',    // laptop
  'xl':   '1280px',    // desktop
  '2xl':  '1536px',    // wide
  '3xl':  '1920px',    // TV / sala control
  'tv':   { 'raw': '(min-width: 1900px) and (orientation: landscape)' },
}
```

### 5.1 Uso típico

```tsx
<div className="
  grid gap-3
  grid-cols-1                    // mobile: 1 col
  md:grid-cols-2                 // tablet: 2 cols
  xl:grid-cols-[1.05fr_1.5fr_1fr] // PC/TV: 3 cols custom
">
```

---

## 6. Modo TV — Detalles especiales

### 6.1 Activación

- URL `?mode=tv` o ruta `/tv`
- Detecta `screen.width >= 1900` y `orientation: landscape` → sugerir activación
- Botón fullscreen en TopBar → `document.documentElement.requestFullscreen()` + `navigator.wakeLock.request('screen')`
- Tecla `F` toggle fullscreen
- Tecla `Esc` salir fullscreen

### 6.2 Comportamiento

- **Cero pointer-events** en chips, buttons (excepto fullscreen toggle)
- **Sin hover effects**
- **Sin scroll** (`overflow: hidden` en body)
- **Tipografía clamp** se ajusta auto
- **Auto-rotación atención** — cada 90s, si hay alarma crítica, zoom 5s a la sección afectada (border highlight + scale 1.02)
- **Tema oscuro forzado** (no toggle a claro)
- **Reconnect silencioso** — toast persistente si falla conexión
- **Persistencia de últimos valores** — nunca mostrar `--` o vacío

### 6.3 Wake lock + fullscreen

```typescript
// src/lib/hooks/useWakeLock.ts
export function useWakeLock() {
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    async function acquire() {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch (e) {
          console.warn('Wake lock denied', e);
        }
      }
    }
    acquire();

    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      wakeLock?.release();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
```

---

## 7. Estados visuales

### 7.1 Estados de carga

```
LOADING:    Skeleton del tile (no spinner)
INITIAL:    Skeleton + "Conectando..."
LIVE:       Valor + flash animado en update
STALE:      Valor en gris + "hace X min"
ERROR:      Valor último conocido + chip "señal demorada"
RECONNECT:  Toast persistente "Reconectando..."
NO_DATA:    "Sin datos" + icono + última lectura conocida
```

### 7.2 Estados de status (color borde lateral)

| Status | Borde | Animación |
|---|---|---|
| `ok` | `var(--ok)` 2-3px left | Ninguna |
| `warn` | `var(--warn)` 2-3px left | Subtle pulse glow |
| `alarm` | `var(--danger)` 3-4px left | Pulse animation continua |
| `unknown` | `var(--text-muted)` 1px left | Opacity 0.6 |
| `stale` | gris + opacity 0.7 | Ninguna |

---

## 8. Ejemplo CSS módulo dashboard

```css
/* app/(dashboard)/page.module.css */

.tv-shell {
  display: grid;
  grid-template-rows: 64px auto 112px 1fr 80px;
  height: 100dvh;
  overflow: hidden;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-body);
}

.tv-shell[data-alert-active="true"] {
  grid-template-rows: 64px 56px 112px 1fr 80px;
}

.body-grid {
  display: grid;
  grid-template-columns: 1.05fr 1.5fr 1fr;
  gap: var(--space-3);
  padding: var(--space-3);
  overflow: hidden;
}

@media (max-width: 1023px) {
  .tv-shell {
    height: auto;
    min-height: 100dvh;
    overflow: auto;
  }
  .body-grid {
    grid-template-columns: 1fr;
    overflow: visible;
  }
}
```

---

**Siguiente:** [`04_COMPONENTES.md`](./04_COMPONENTES.md)
