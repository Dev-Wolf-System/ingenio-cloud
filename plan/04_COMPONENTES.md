# 04 — Catálogo de componentes

## Convenciones

- **Server Component default** salvo que necesite `useState/useEffect/useContext`
- Props tipadas con interfaces (no `type` para extensibilidad)
- Variantes con `class-variance-authority` (cva)
- Cada componente exportado con su tipo Props
- Stories en Storybook (desde Día 8)

---

## 1. Layout

### 1.1 `<TopBar />`

```typescript
interface TopBarProps {
  plant?: string;             // "Planta Sur"
  copilotActive?: boolean;
  showSearch?: boolean;       // Cmd+K trigger
  className?: string;
}
```

**Contenido:**
- Brand: `<IconFactory />` + "Ingenio Cloud" + plant slug
- Búsqueda Cmd+K (placeholder S0, activo S2)
- Chip turno calculado client-side (`useShift()`)
- Indicador copiloto activo (pulse verde si activo)
- Estado conexión (`<ConnectionStatus />`)
- Reloj live (`useClock()`)
- Botón fullscreen
- Avatar perfil (PC/oficina)

**Server/Client:** Client (reloj + turno tick).

### 1.2 `<Sidebar />`

```typescript
interface SidebarProps {
  collapsed?: boolean;
  groups: SidebarGroup[];
  user: { name: string; role: string; email: string };
}

interface SidebarGroup {
  label: string;              // "General", "Operación", "IA", "Admin"
  items: SidebarItem[];
}

interface SidebarItem {
  href: string;
  label: string;
  icon: TablerIcon;
  badge?: number;             // contador notif
  disabled?: boolean;
  comingSoon?: boolean;       // muestra etiqueta "Próximamente"
}
```

Features:
- Grupos colapsables
- Active state highlight con borde izquierdo cyan
- Drawer mobile
- Tooltips en modo colapsado
- Footer con avatar + role

### 1.3 `<PageWrapper />`

```typescript
interface PageWrapperProps {
  title?: string;
  description?: string;
  actions?: ReactNode;        // botones top-right
  variant?: 'default' | 'tv' | 'fullscreen';
  children: ReactNode;
}
```

### 1.4 `<ConnectionStatus />`

```typescript
interface ConnectionStatusProps {
  status: 'connected' | 'reconnecting' | 'offline';
  lastUpdate?: Date;
}
```

Chip con icono `<IconWifi />` o `<IconWifiOff />` + label.

---

## 2. Industrial

### 2.1 `<KpiHero />`

```typescript
interface KpiHeroProps {
  kpis: [KpiCardProps, KpiCardProps, KpiCardProps, KpiCardProps];
}
```

Grid 4 col en > 1280px, 2×2 en < 1280px. Stagger animation `containerVariants`.

### 2.2 `<KpiCard />`

```typescript
interface KpiCardProps {
  label: string;
  value: number | string;
  unit?: string;
  icon: TablerIcon;
  status?: 'ok' | 'warn' | 'alarm' | 'accent';
  delta?: {
    value: string;             // "+3%", "-12 t/h"
    direction: 'up' | 'down' | 'flat';
  };
  progress?: number;           // 0-100 → barra inferior
  footer?: string;             // "Meta: 9.000"
  sparkline?: number[];        // mini gráfica
  pulse?: boolean;             // animación pulse (alarm)
  className?: string;
}
```

Estructura visual:
```
┌─────────────────────────────────┐
│ <icon> LABEL UPPERCASE       ↗ │
│ │                              │
│ │  6.629  t/h                  │  ← borde izq cyan/verde/amber/rojo
│ │                              │
│ │ ▂▃▅▇▆▅▃▁ +3% vs ayer        │
│ │ Meta: 9.000 ✓                │
└─────────────────────────────────┘
```

### 2.3 `<MetricTile />`

```typescript
interface MetricTileProps {
  label: string;
  value: number | string;
  unit?: string;
  status?: 'ok' | 'warn' | 'alarm' | 'unknown';
  flash?: boolean;
  stale?: boolean;             // mostrar "hace X min" subtle
  staleSince?: Date;
  setpoints?: {
    min?: number;
    max?: number;
    warnMin?: number;
    warnMax?: number;
  };
  precision?: number;          // decimales (default 1)
  size?: 'sm' | 'md' | 'lg';   // densidad
  className?: string;
}
```

Estructura:
```
┌───────────────────────┐
│ CAUDAL CALDERA 2  ⚠ │ ← label uppercase + icon status si aplica
│ │                     │ ← borde izq 2px según status
│ │  62.3  t/h         │ ← valor mono + unidad pequeña
│ │                     │
└───────────────────────┘
```

Variantes:
- `sm` → 80px alto, font sm
- `md` → 96px alto, font base (default)
- `lg` → 120px alto, font lg (paneles destacados)

### 2.4 `<LevelBar />`

```typescript
interface LevelBarProps {
  label: string;
  value: number;               // 0-100 (porcentaje) o numérico
  capacity?: number;           // si no es %, divide value/capacity
  unit?: string;
  status?: 'ok' | 'warn' | 'alarm';
  showPercent?: boolean;
  flash?: boolean;
  className?: string;
}
```

Estructura:
```
┌───────────────────────────┐
│ NIVEL JUGO PESADO         │
│ │                         │
│ │ ████████░░░░░░░░  62%  │ ← barra animada cubic-bezier
│ │                         │
└───────────────────────────┘
```

Animación width transition: `width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)`.

### 2.5 `<PanelHeader />`

```typescript
interface PanelHeaderProps {
  title: string;
  icon?: TablerIcon;
  badge?: string | number;
  status?: 'ok' | 'warn' | 'alarm';
  action?: { label: string; onClick: () => void };
}
```

Header para `<EnergyPanel />`, `<ProductionPanel />`, etc.

### 2.6 `<AlertStrip />`

```typescript
interface AlertStripProps {
  alert: ActiveAlert | null;
  onDetails?: () => void;
  onDismiss?: () => void;
  className?: string;
}
```

Banda horizontal roja, solo si `severity === 'critical'`. Slide-down animación al aparecer. Si null, no renderiza.

### 2.7 `<AlertItem />`

```typescript
interface AlertItemProps {
  alert: ActiveAlert;
  variant?: 'compact' | 'full';
  showActions?: boolean;
  onAck?: () => void;
}
```

Item lista. Compact = título + timestamp. Full = título + descripción + acción sugerida.

### 2.8 `<EnergyPanel />`

```typescript
interface EnergyPanelProps {
  metrics: Map<string, MetricReading>;
  className?: string;
}
```

Orquesta:
- `<PanelHeader title="Energía" icon={IconBolt} />`
- Grid 4×3 de `<MetricTile />` (10 activos + 2 hidden md:hidden)
- Suscribe `useRealtimeMetrics(['energia'])`

### 2.9 `<ProductionPanel />`

```typescript
interface ProductionPanelProps {
  metrics: Map<string, MetricReading>;
  className?: string;
}
```

Orquesta 4 sub-secciones:
1. Top compacto (Producción azúcar + Indicador molienda) → 2 `<KpiCard sm />`
2. Proceso químico → grid 3×2 `<MetricTile />`
3. Niveles → grid 2×2 `<LevelBar />`
4. Caudales/salidas → grid 3×2 `<MetricTile />`

### 2.10 `<ShiftSummaryPanel />`

```typescript
interface ShiftSummaryPanelProps {
  shiftKpis: ShiftKPI[];        // 4 KPIs
  activeAlerts: ActiveAlert[];
  recentActivity: ActivityEvent[];
  className?: string;
}
```

Orquesta:
- `<PanelHeader title="Resumen Guardia" icon={IconClock} />`
- Grid 2×2 `<ShiftKpi />`
- Lista `<AlertItem />` activos (max 4 visibles, scroll si más)
- Lista actividad reciente

### 2.11 `<ShiftKpi />`

```typescript
interface ShiftKpiProps {
  id: 'molienda_promedio' | 'gas_turno_previo' | 'paradas' | 'vel_primer_molino';
  label: string;
  value: number | string;
  unit?: string;
  context?: string;            // "2.555 t / 6.2 h" o "47 min total"
  shiftRef: 'current' | 'previous';
  loading?: boolean;
  error?: string;
}
```

Más compacto que `<KpiCard />`, sin sparkline (los datos cambian solo al cambiar turno).

### 2.12 `<K2Indicator />`

```typescript
interface K2IndicatorProps {
  vaporDestileria: number;     // valor vapor destilería
  className?: string;
}
```

Lógica: `funcionando = vaporDestileria > 2`. Muestra "K2: FUNCIONANDO ✓" verde o "K2: DETENIDO ✗" rojo.

### 2.13 `<CopilotBanner />`

```typescript
interface CopilotBannerProps {
  suggestion?: CopilotSuggestion;
  loading?: boolean;
  onAction: (action: string) => void;
  onDismiss: () => void;
  variant?: 'tv' | 'mobile';
  className?: string;
}

interface CopilotSuggestion {
  id: string;
  label: string;               // "Detección: ..."
  text: string;                // mensaje principal
  confidence?: number;         // 0-1
  primaryAction: string;
  secondaryActions: string[];
}
```

S0: placeholder con texto fijo. S1+: conectar `/api/copilot/suggest`.

---

## 3. Charts

### 3.1 `<Sparkline />`

```typescript
interface SparklineProps {
  data: number[];
  width?: number | string;     // default '100%'
  height?: number;             // default 32
  color?: string;              // default 'var(--primary)'
  showLastValue?: boolean;
  className?: string;
}
```

Recharts `<AreaChart />` minimal sin ejes, con gradient subtle.

### 3.2 `<AreaChart />`

```typescript
interface AreaChartProps {
  data: { timestamp: string; value: number }[];
  height?: number;
  yAxisLabel?: string;
  threshold?: { min?: number; max?: number };
  color?: string;
}
```

Para mostrar histórico turno (velocidad molino turno anterior).

### 3.3 `<Gauge />` (ECharts)

```typescript
interface GaugeProps {
  value: number;
  min: number;
  max: number;
  setpoints: { warnMin?: number; warnMax?: number; alarmMin?: number; alarmMax?: number };
  label: string;
  unit: string;
  size?: 'sm' | 'md' | 'lg';
}
```

Para presiones críticas (Caldera, agua alimentación). Uso opcional en versión expandida del panel.

---

## 4. UI base (shadcn customizado)

### 4.1 `<Card />`

```typescript
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated';
  padded?: boolean;
}
```

Variantes con cva.

### 4.2 `<Badge />`

```typescript
interface BadgeProps {
  variant?: 'default' | 'ok' | 'warn' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md';
  pulse?: boolean;
}
```

### 4.3 `<Button />`

Default shadcn + variantes custom: `primary | secondary | ghost | danger | icon-only`.

### 4.4 `<Tabs />`

Radix Tabs. Usado en mobile body.

### 4.5 `<Skeleton />`

Tile-shaped skeleton para cargas iniciales.

### 4.6 `<Toast />`

Sonner library. Stack bottom-right en PC, bottom-center en mobile.

---

## 5. Domain-specific

### 5.1 `<MoliendaCard />`

```typescript
interface MoliendaCardProps {
  promedio: number;            // t/h
  acumulado: number;           // toneladas turno
  horasTrans: number;          // horas transcurridas turno
  shift: Shift;
}
```

Wrapper especializado de `<KpiCard />` con context "Turno: 02h 18min" + ratio acumulado/horas.

### 5.2 `<ShiftChip />`

```typescript
interface ShiftChipProps {
  shift?: Shift;
  showDate?: boolean;
  compact?: boolean;
}
```

Calcula turno actual automáticamente vía `useShift()`. Muestra "Turno Tarde · 14:32" con icono.

---

## 6. AI placeholders (Sprint 0)

### 6.1 `<CopilotPlaceholder />`

Componente fixed text en CopilotBanner mientras Sprint 1 no activa el real. Texto: "Copiloto Vigía estará activo desde Sprint 1 — detección proactiva en desarrollo".

---

## 7. Variantes cva ejemplo

```typescript
// components/industrial/MetricTile.tsx
import { cva, type VariantProps } from 'class-variance-authority';

const metricTileVariants = cva(
  'relative rounded-md transition-all duration-200',
  {
    variants: {
      status: {
        ok:      'border-l-2 border-l-ok bg-bg-card',
        warn:    'border-l-2 border-l-warn bg-bg-card',
        alarm:   'border-l-[3px] border-l-danger bg-bg-card animate-pulse-alarm',
        unknown: 'border-l border-l-text-muted bg-bg-card/60 opacity-70',
      },
      size: {
        sm: 'p-3 min-h-[80px]',
        md: 'p-4 min-h-[96px]',
        lg: 'p-5 min-h-[120px]',
      },
      flash: {
        true: 'animate-flash',
        false: '',
      },
    },
    defaultVariants: {
      status: 'unknown',
      size: 'md',
      flash: false,
    },
  }
);

export interface MetricTileProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'size'>,
    VariantProps<typeof metricTileVariants> {
  label: string;
  value: number | string;
  unit?: string;
  precision?: number;
  setpoints?: Setpoints;
}

export function MetricTile({
  label,
  value,
  unit,
  status,
  size,
  flash,
  precision = 1,
  className,
  ...props
}: MetricTileProps) {
  // ... render
}
```

---

## 8. Estructura archivo de cada componente

```typescript
// components/industrial/MetricTile.tsx

'use client';                 // si necesita state

import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';
import type { MetricStatus } from '@/types/metrics';

// 1. Variants
const variants = cva(...);

// 2. Props interface
export interface MetricTileProps extends ... {}

// 3. Component
export function MetricTile({ ... }: MetricTileProps) { ... }

// 4. Sub-components si necesarios
```

---

## 9. Storybook entries (Día 8+)

Cada componente principal tiene story:
- `Default`
- `WithFlash`
- `Alarm`
- `Stale`
- `Loading`
- `Mobile`

---

## 10. Lista completa de componentes

| Componente | Categoría | Prioridad | Días |
|---|---|---|---|
| `MetricTile` | Industrial | P0 | Día 2 |
| `LevelBar` | Industrial | P0 | Día 2 |
| `KpiCard` | Industrial | P0 | Día 2 |
| `KpiHero` | Industrial | P0 | Día 3 |
| `AlertItem` | Industrial | P0 | Día 2 |
| `AlertStrip` | Industrial | P0 | Día 3 |
| `PanelHeader` | Industrial | P0 | Día 2 |
| `EnergyPanel` | Industrial | P0 | Día 3 |
| `ProductionPanel` | Industrial | P0 | Día 3 |
| `ShiftSummaryPanel` | Industrial | P0 | Día 3 |
| `ShiftKpi` | Industrial | P0 | Día 3 |
| `K2Indicator` | Industrial | P0 | Día 3 |
| `CopilotBanner` | AI | P0 | Día 3 (placeholder) |
| `TopBar` | Layout | P0 | Día 3 |
| `Sidebar` | Layout | P1 | Día 4 |
| `PageWrapper` | Layout | P0 | Día 3 |
| `ConnectionStatus` | Layout | P0 | Día 4 |
| `Sparkline` | Charts | P0 | Día 2 |
| `AreaChart` | Charts | P1 | Día 5 |
| `Gauge` | Charts | P2 | (opcional) |
| `MoliendaCard` | Domain | P0 | Día 3 |
| `ShiftChip` | Domain | P0 | Día 3 |
| `Card`/`Badge`/`Button`/`Tabs`/`Skeleton`/`Toast` | UI base | P0 | Día 1 (shadcn add) |

---

**Siguiente:** [`05_VARIABLES_Y_DATOS.md`](./05_VARIABLES_Y_DATOS.md)
