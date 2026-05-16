# 02 — Design System

## 1. Filosofía visual

El panel debe verse **profesional, denso pero limpio, industrial pero moderno**. Referencias: Linear, Datadog, Stripe (premium feeling) + Grafana 10+ (densidad operativa).

**Reglas no negociables:**
1. Densidad de información sin clutter
2. Modo oscuro default (sala control + turno noche)
3. Estado visible siempre (turno, hora, conexión, alertas)
4. Acciones críticas con confirmación
5. Sin emojis decorativos (salvo iconos status: ✓ ✗)
6. Tipografía legible a 3-5 m (TV planta)
7. Cero loading screens vacíos — skeletons siempre
8. Errores explícitos con acción concreta

---

## 2. Paleta de colores

### 2.1 Modo PC/Mobile (default app) — `INGENIO_CLOUD_DARK`

**Refinado del INDUSTRIAL_DARK para alinear con logo "Ingenio Cloud"** (azules del logo: #1E5A87 / #2E7AB5 / #4A9CD8).

```css
:root {
  /* Backgrounds */
  --bg-base:       #0A1018;   /* Body — azulado profundo */
  --bg-surface:    #0F1825;   /* Cards principales */
  --bg-card:       #18233A;   /* Cards elevadas, modales */
  --bg-hover:      #1F2D4A;   /* Hover state */

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-strong: rgba(255, 255, 255, 0.12);
  --border-focus:  #4A9CD8;

  /* Text */
  --text-primary:  #F0F4FF;
  --text-secondary:#A6B0CC;
  --text-muted:    #6B7A9E;
  --text-disabled: #4A5670;

  /* Brand — derivado del logo */
  --primary:       #2E7AB5;   /* Azul medio logo — KPIs, links, primary actions */
  --primary-light: #4A9CD8;   /* Azul claro logo — hover, hi-contrast */
  --primary-dark:  #1E5A87;   /* Azul oscuro logo — backgrounds destacados */
  --primary-soft:  rgba(46, 122, 181, 0.14);
  --primary-glow:  rgba(74, 156, 216, 0.32);

  --accent:        #4FBFE5;   /* Cyan vivo (acento red neuronal del logo) */
  --accent-soft:   rgba(79, 191, 229, 0.12);

  /* Semantic */
  --ok:            #00C896;   /* Verde esmeralda — datos OK */
  --ok-soft:       rgba(0, 200, 150, 0.12);
  --warn:          #FFB020;   /* Ámbar */
  --warn-soft:     rgba(255, 176, 32, 0.12);
  --danger:        #FF4757;   /* Rojo alarma */
  --danger-soft:   rgba(255, 71, 87, 0.12);
  --info:          #4A9CD8;
  --info-soft:     rgba(74, 156, 216, 0.12);

  /* Gradients */
  --gradient-hero: linear-gradient(135deg, #2E7AB522, #4FBFE511);
  --gradient-card: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
  --gradient-brand: linear-gradient(135deg, #1E5A87, #4A9CD8);  /* Logo gradient */
}
```

### 2.2 Modo TV ambient — fusión con tokens Panel General

```css
[data-mode="tv"] {
  /* Override hacia tokens TV (más oscuros, accent honey) */
  --bg-base:       #0A0E12;
  --bg-surface:    #11161D;
  --bg-card:       #1A2129;
  --bg-hover:      #232C36;

  --accent:        #E6A817;   /* Honey/sugar reference para sala control */
  --accent-soft:   rgba(230, 168, 23, 0.12);

  --text-primary:  #E8EBF0;
  --text-secondary:#8B95A3;
  --text-muted:    #5A6573;

  --ok:            #6FCF5C;
  --warn:          #FFB020;
  --danger:        #FF4C4C;
  --info:          #4DA3FF;
}
```

### 2.3 Modo claro (disponible en mobile/PC, bloqueado en TV)

```css
[data-theme="light"] {
  --bg-base:       #FFFFFF;
  --bg-surface:    #F8FAFC;
  --bg-card:       #F1F5F9;
  --bg-hover:      #E2E8F0;

  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-strong: rgba(0, 0, 0, 0.12);

  --text-primary:  #0F172A;
  --text-secondary:#475569;
  --text-muted:    #64748B;

  --primary:       #0099BB;
  --primary-dim:   #007799;
  --accent:        #E55A2B;
  --ok:            #059669;
  --warn:          #D97706;
  --danger:        #DC2626;
}
```

---

## 3. Tipografía

### 3.1 Fuentes

```css
--font-display: 'Geist', 'DM Sans', -apple-system, sans-serif;
--font-body:    'Geist', -apple-system, system-ui, sans-serif;
--font-mono:    'JetBrains Mono', 'Geist Mono', 'SF Mono', Menlo, monospace;
```

Pesos disponibles: 400 (regular) · 500 (medium) · 600 (semibold)
**Nunca usar bold 700+** salvo en KPIs hero de TV.

### 3.2 Escala (clamp para TV/mobile fluido)

```css
--text-2xs:  0.6875rem;  /* 11px — labels micro, uppercase */
--text-xs:   0.75rem;    /* 12px — labels, leyendas */
--text-sm:   0.875rem;   /* 14px — texto secundario, tablas */
--text-base: 1rem;       /* 16px — body principal */
--text-lg:   1.125rem;   /* 18px — subtítulos */
--text-xl:   1.25rem;    /* 20px — títulos card */
--text-2xl:  1.5rem;     /* 24px — títulos sección */
--text-3xl:  1.875rem;   /* 30px — KPI grande */
--text-4xl:  2.25rem;    /* 36px — KPI hero */
--text-5xl:  3rem;       /* 48px — KPI hero TV */

/* Fluid scale TV */
--text-fluid-kpi:    clamp(1.5rem, 2.5vw, 3rem);
--text-fluid-value:  clamp(1rem, 1.2vw, 1.5rem);
```

### 3.3 Tracking + leading

```css
--tracking-tight:  -0.02em;   /* Títulos */
--tracking-normal: 0;
--tracking-wide:   0.04em;    /* Labels uppercase */
--tracking-wider:  0.08em;    /* Botones */

--leading-tight:   1.2;
--leading-normal:  1.5;
--leading-relaxed: 1.7;
```

### 3.4 Cuándo usar mono

`JetBrains Mono` siempre para:
- Valores numéricos de sensores
- Timestamps
- IDs / códigos
- Diff de cambios (futuro audit log)

Body texto = `Geist Sans`.

---

## 4. Espaciado (sistema 4pt)

```css
--space-0:  0;
--space-1:  0.25rem;   /* 4px */
--space-2:  0.5rem;    /* 8px */
--space-3:  0.75rem;   /* 12px */
--space-4:  1rem;      /* 16px */
--space-5:  1.25rem;   /* 20px */
--space-6:  1.5rem;    /* 24px */
--space-8:  2rem;      /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
--space-16: 4rem;      /* 64px */
--space-20: 5rem;      /* 80px */
--space-24: 6rem;      /* 96px */
```

**Regla:** entre tiles `gap-3`, entre paneles `gap-4`, entre secciones `gap-6`. Padding cards `p-4` o `p-5`. TV podría requerir `gap-2` por densidad.

---

## 5. Border radius

```css
--radius-xs:   4px;     /* badges micro */
--radius-sm:   6px;     /* botones, inputs */
--radius-md:   10px;    /* cards */
--radius-lg:   14px;    /* cards elevadas, modales */
--radius-xl:   18px;    /* hero cards */
--radius-2xl:  24px;
--radius-full: 9999px;  /* chips, avatars */
```

---

## 6. Elevaciones / Sombras

```css
/* Dark mode (glow effects sutiles) */
--shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.4);
--shadow-md:  0 4px 12px rgba(0, 0, 0, 0.4);
--shadow-lg:  0 8px 24px rgba(0, 0, 0, 0.5);
--shadow-xl:  0 16px 48px rgba(0, 0, 0, 0.6);

/* Glow para destacar elementos críticos */
--glow-primary: 0 0 24px var(--primary-glow);
--glow-ok:      0 0 16px rgba(0, 229, 160, 0.4);
--glow-warn:    0 0 16px rgba(255, 184, 0, 0.5);
--glow-danger:  0 0 20px rgba(255, 71, 87, 0.6);

/* Inset glow (bordes laterales status) */
--inset-glow-ok:     inset 3px 0 0 var(--ok);
--inset-glow-warn:   inset 3px 0 0 var(--warn);
--inset-glow-danger: inset 3px 0 0 var(--danger);
```

---

## 7. Glassmorphism (paneles destacados)

```css
.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-md);
}

.glass-card-strong {
  background: rgba(26, 34, 54, 0.7);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--border-strong);
}
```

Uso: `<CopilotBanner />`, modales, sidebar.
NO usar en tiles industriales (legibilidad > efecto).

---

## 8. Animaciones

### 8.1 Tokens

```css
--duration-instant: 100ms;
--duration-fast:    150ms;
--duration-base:    300ms;
--duration-slow:    600ms;
--duration-slower:  900ms;

--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);     /* entradas */
--ease-in:     cubic-bezier(0.7, 0, 0.84, 0);     /* salidas */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);      /* transiciones */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* hover playful */
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);      /* default */
```

### 8.2 Animaciones obligatorias

#### `flash` — Update de valor
```css
@keyframes flash {
  0%, 100% { background-color: transparent; }
  20%      { background-color: var(--primary-soft); }
}
.metric-flash { animation: flash 400ms ease-out; }
```

#### `pulse-alarm` — Alarma crítica
```css
@keyframes pulse-alarm {
  0%, 100% {
    box-shadow: var(--inset-glow-danger), 0 0 0 0 rgba(255, 71, 87, 0.4);
  }
  50% {
    box-shadow: var(--inset-glow-danger), 0 0 0 8px rgba(255, 71, 87, 0);
  }
}
.alarm-active { animation: pulse-alarm 2s ease-in-out infinite; }
```

#### `count-up` — Contador KPI
```typescript
// Hook useCountUp para animar valor numérico al cambiar
// Duración 800ms ease-out, decimales preservados
```

#### `fade-up` — Entrada de página
```css
@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

#### `slide-down` — AlertStrip entrada
```css
@keyframes slide-down {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
```

### 8.3 Framer Motion variantes

```typescript
// src/lib/animations.ts

export const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -8 },
};

export const containerVariants = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export const cardVariants = {
  initial: { opacity: 0, y: 20, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

export const cardHover = {
  whileHover: { y: -2, transition: { duration: 0.2 } },
};

export const alertSlide = {
  initial: { y: -64, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit:    { y: -64, opacity: 0, transition: { duration: 0.2 } },
};
```

### 8.4 Reglas de uso

- ⚡ Animar SOLO `transform` y `opacity` (60fps garantizado)
- ⚡ Duración max recomendada en industriales: 400ms (más es distracción)
- ⚡ Hover en TV mode = OFF (`pointer-events: none`)
- ⚡ Auto-rotación TV solo si hay alarma crítica (cada 90s zoom 5s)

---

## 9. Iconografía

### 9.1 Set principal: @tabler/icons-react

Categorías y mapeo:
```typescript
// src/lib/icons.ts
import {
  IconBolt,           // Energía
  IconFlame,          // Combustión / gas
  IconDroplet,        // Vapor / líquidos
  IconGauge,          // Presión
  IconTemperature,    // Temperatura
  IconActivity,       // Tiempo real / proceso
  IconAlertTriangle,  // Alerta warning
  IconAlertCircle,    // Alerta crítica
  IconClock,          // Tiempo / turno
  IconChartLine,      // Producción
  IconFactory,        // Brand
  IconCircleCheck,    // Status OK
  IconRobot,          // IA / copiloto
  IconMaximize,       // Fullscreen
  IconArrowsMaximize,
  IconWifi,           // Conexión
  IconWifiOff,
  IconMicrophone,     // Voz (futuro)
} from '@tabler/icons-react';
```

### 9.2 Lucide para resto

- Navegación general
- Acciones (close, edit, settings)
- Resto UI

### 9.3 Tamaños

- 14px → text-sm
- 16px → text-base (default)
- 20px → títulos card
- 24px → KPI hero
- 32px+ → empty states

### 9.4 Stroke width

Tabler default = 2 (industrial)
Lucide default = 1.5 (cleaner)

---

## 10. Tailwind config base

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base:    'var(--bg-base)',
          surface: 'var(--bg-surface)',
          card:    'var(--bg-card)',
          hover:   'var(--bg-hover)',
        },
        border: {
          DEFAULT: 'var(--border-subtle)',
          strong:  'var(--border-strong)',
          focus:   'var(--border-focus)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
          disabled:  'var(--text-disabled)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          dim:     'var(--primary-dim)',
          soft:    'var(--primary-soft)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft:    'var(--accent-soft)',
        },
        ok:     { DEFAULT: 'var(--ok)',     soft: 'var(--ok-soft)' },
        warn:   { DEFAULT: 'var(--warn)',   soft: 'var(--warn-soft)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
        info:   { DEFAULT: 'var(--info)',   soft: 'var(--info-soft)' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body:    ['var(--font-body)', 'sans-serif'],
        mono:    ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        '2xs':       ['0.6875rem',  { lineHeight: '1.2' }],
        'fluid-kpi': ['clamp(1.5rem, 2.5vw, 3rem)', { lineHeight: '1.1' }],
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        glow:        'var(--glow-primary)',
        'glow-ok':   'var(--glow-ok)',
        'glow-warn': 'var(--glow-warn)',
        'glow-danger': 'var(--glow-danger)',
      },
      animation: {
        flash:       'flash 400ms ease-out',
        'pulse-alarm': 'pulse-alarm 2s ease-in-out infinite',
        'fade-up':   'fade-up 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 400ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
```

---

## 11. Resumen visual

```
DARK MODE PC/MOBILE              TV AMBIENT MODE              LIGHT MODE
─────────────────────            ───────────────────          ──────────────
bg:    #0A1018                   bg:    #0A0E12               bg:    #FFFFFF
card:  #18233A                   card:  #1A2129               card:  #F1F5F9
primary: #2E7AB5 (azul logo)     primary: #2E7AB5             primary: #1E5A87
accent: #4FBFE5 (cyan logo)      accent: #E6A817 (honey TV)   accent: #4FBFE5
ok:    #00C896                   ok:    #6FCF5C               ok:    #059669
warn:  #FFB020                   warn:  #FFB020               warn:  #D97706
danger: #FF4757                  danger: #FF4C4C              danger: #DC2626
```

**Logo "Ingenio Cloud":** ubicado en [`Media/Logo - Ingenio Cloud.png`](../Media/Logo%20-%20Ingenio%20Cloud.png)
**Portada:** [`Media/Portada Ingenio Cloud.png`](../Media/Portada%20Ingenio%20Cloud.png) — tagline oficial: *"Plataforma Inteligente de Monitoreo, Producción y Asistencia Operativa Industrial"*

**Decisión cuándo usar cada modo:**
- `/tv` route o `?mode=tv` → TV ambient
- Mobile/PC user logged → dark (default) o light (preferencia)
- Sala de control monitor fijo → siempre TV ambient

---

**Siguiente:** [`03_LAYOUT_TV_Y_MOBILE.md`](./03_LAYOUT_TV_Y_MOBILE.md)
