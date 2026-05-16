# 05 — Variables y datos

## Catálogo completo de variables del Dashboard

Fuente original: [`VariablesDashboardPrincipal.md`](../VariablesDashboardPrincipal.md)

Cada variable tiene:
- `sensor_id` único (formato kebab-case)
- `label` legible (display)
- `area` agrupador (energia / produccion / guardia)
- `unit` (t/h, bar, °C, %, m³, etc.)
- `fuente` (webhook n8n / HTTP / MSSQL / cálculo)
- `setpoints` (min/max/warn) — placeholder hasta confirmar con cliente
- `frecuencia_refresh` (realtime / 1x turno / 1x día)

---

## 1. ENERGÍA (10 variables — webhook agrupado realtime)

### 1.1 Vapor y Calderas (7 variables)

| sensor_id | label | unit | setpoints (TBD) | notas |
|---|---|---|---|---|
| `caudal_total_vapor` | Caudal total de vapor | t/h | min: 150, warn_max: 220 | **Calculado** = `caudal_caldera_2` + `caudal_caldera_3` + `caudal_caldera_6` |
| `caudal_caldera_2` | Caudal caldera 2 | t/h | min: 40, max: 80 | Sensor PLC |
| `caudal_caldera_3` | Caudal caldera 3 | t/h | min: 40, max: 80 | Sensor PLC |
| `caudal_caldera_6` | Caudal caldera 6 | t/h | min: 40, max: 80 | Sensor PLC |
| `presion_alta_baja` | Presión alta/baja | bar | min: 15, max: 22, warn_max: 20 | (clarificar con cliente cuál es alta vs baja, posiblemente 2 sensores) |
| `presion_escape` | Presión de escape | bar | min: 1.5, max: 3.0 | |
| `presion_vg1` | Presión VG1 | bar | min: 7, max: 10 | VG1 = válvula generación 1 |

### 1.2 Agua de alimentación (2 variables)

| sensor_id | label | unit | setpoints | notas |
|---|---|---|---|---|
| `temp_agua_alimentacion` | Temperatura agua alimentación | °C | min: 95, max: 115, warn_max: 110 | |
| `presion_agua_alimentacion` | Presión agua alimentación | bar | min: 12, max: 16 | |

### 1.3 Generación eléctrica (1 variable + 2 sensores internos)

| sensor_id | label | unit | setpoints | notas |
|---|---|---|---|---|
| `generacion_total` | Generación eléctrica total | MW | min: 8, max: 15 | **Calculado** = `potencia_weg` + `potencia_siemens` |
| `potencia_weg` | Potencia WEG (interno) | MW | — | Sensor PLC (no se muestra solo, sirve para calc) |
| `potencia_siemens` | Potencia Siemens (interno) | MW | — | Sensor PLC |

### 1.4 Combustible (3 variables)

| sensor_id | label | unit | setpoints | notas |
|---|---|---|---|---|
| `gas_actual` | Gas consumo actual | m³/h | max: 500, warn_max: 450 | |
| `gas_acumulado_dia` | Gas acumulado del día | m³ | — | Suma día desde 00:00 |
| `gas_promedio_turno_previo` | Gas promedio 8h turno previo | m³/h | — | **Resumen guardia, NO realtime** |

---

## 2. PRODUCCIÓN (18 variables — webhook agrupado realtime)

### 2.1 Extracción / Jugo crudo (3 variables)

| sensor_id | label | unit | setpoints | notas |
|---|---|---|---|---|
| `nivel_jugo_pesado` | Nivel jugo pesado | % | min: 30, max: 90, warn_max: 85 | LevelBar |
| `ph_jugo` | pH jugo | pH | min: 6.0, max: 7.0, warn_min: 6.2, warn_max: 6.8 | |
| `sulfitado` | Sulfitado | ppm SO₂ | min: 80, max: 120 | |

### 2.2 Calentamiento y clarificación (4 variables)

| sensor_id | label | unit | setpoints | notas |
|---|---|---|---|---|
| `temp_ultimo_calentador` | Última temp. calentador | °C | min: 100, max: 108, warn_max: 110 | |
| `pol_cachaza` | Pol cachaza | %Pol | max: 1.5, warn_max: 2.0 | bajo es mejor (pérdida) |
| `nivel_jugo_clarificado` | Nivel jugo clarificado | % | min: 40, max: 90 | LevelBar |
| `caudal_jugo_clarificado` | Caudal jugo clarificado | t/h | min: 200, max: 400 | |

### 2.3 Evaporación (3 variables)

| sensor_id | label | unit | setpoints | notas |
|---|---|---|---|---|
| `caudal_jugo_destileria` | Caudal jugo a destilería | t/h | min: 20, max: 60 | |
| `nivel_melado_tratado` | Nivel tanque melado tratado | % | min: 30, max: 85 | LevelBar |
| `nivel_melado_1_2` | Nivel melado 1/2 | % | min: 30, max: 85 | LevelBar (clarificar si son 2 sensores) |

### 2.4 Cristalización y azúcar (3 variables)

| sensor_id | label | unit | setpoints | notas |
|---|---|---|---|---|
| `nivel_cristalizador_1ra` | Nivel cristalizador primera | % | min: 40, max: 90 | LevelBar |
| `produccion_azucar_diaria` | Producción azúcar diaria | bolsas | — | Acumulado día, **KPI Hero** |
| `color_humedad_azucar` | Color y humedad azúcar (secador) | (compuesto) | — | Mostrar 2 valores: color ICUMSA + humedad % |

**Nota color_humedad_azucar:** se modela como 2 sensores separados para tile:
- `color_azucar_icumsa` (unit: ICUMSA)
- `humedad_azucar` (unit: %)

### 2.5 Destilería / Alcohol (5 variables)

| sensor_id | label | unit | setpoints | notas |
|---|---|---|---|---|
| `caudal_alcohol` | Caudal de alcohol | L/h | min: 1500, max: 4000 | |
| `caudal_vino_destilado` | Caudal vino destilado | L/h | — | |
| `caudal_buen_gusto` | Caudal buen gusto | L/h | — | (clarificar si es 1 o 2 con `caudal_vino_destilado`) |
| `vapor_destileria_k2` | Vapor destilería (K2) | bar | — | **Si > 2 → K2 funcionando** |
| `nivel_agua_foza` | Nivel agua foza | % | min: 20, max: 90, warn_min: 25 | |
| `aire_destileria` | Aire | bar | min: 4, max: 8 | |

### 2.6 Indicadores generales (1 variable — calculada)

| sensor_id | label | unit | setpoints | notas |
|---|---|---|---|---|
| `promedio_molienda_turno_actual` | Promedio molienda turno actual | t/h | min: 350, max: 600, warn_max: 580 | **Calculado** = `molienda_acumulada_turno` / `horas_trans_turno` |

---

## 3. RESUMEN GUARDIA (4 KPIs — 1x por turno)

| kpi_id | label | unit | fuente | refresh |
|---|---|---|---|---|
| `molienda_promedio_turno_actual` | Molienda promedio | t/h | **HTTP endpoint listo** (externo) | 1x al cargar + 1x cambio turno (con tolerancia hasta nueva info disponible) |
| `gas_promedio_turno_previo` | Consumo gas turno anterior | m³/h promedio + total m³ | **Consulta MSSQL CORONA** | 1x cambio turno |
| `paradas_turno_previo` | Paradas turno anterior | objeto `{total, motivos[], tiempo_neto_horas}` | **Consulta MSSQL CORONA** | 1x cambio turno |
| `vel_primer_molino_turno_previo` | Velocidad primer molino | rpm + serie tiempo (gráfica) | **Webhook 1x turno** (push manual) | 1x cambio turno |

### 3.1 Notas KPIs guardia

- **Molienda promedio actual** del turno en curso ≠ molienda promedio cuando se calcule oficialmente al cerrar el turno. Mostrar ambos: el actual cambia continuo, el "oficial cerrado" del turno previo es del bloque guardia.

- **Gas turno anterior:** consulta MSSQL — definir query exacta una vez se conozca la tabla. Estructura tentativa:
```sql
SELECT
  SUM(gas_consumo) / horas_turno AS promedio_m3_h,
  SUM(gas_consumo) AS total_m3
FROM ... 
WHERE codigoproceso = 'Gas'
  AND fecha_hora BETWEEN :inicio_turno_prev AND :fin_turno_prev
```

- **Paradas turno anterior:** tabla con `codigoproceso = 'Paradas'`. Devolver:
```typescript
{
  total: number;                  // cantidad eventos
  motivos: { motivo: string; cantidad: number; minutos: number }[];
  tiempo_neto_horas: number;      // suma duración
}
```

- **Velocidad primer molino:** array de samples `{ timestamp, rpm }` del turno previo. Servido vía webhook push (n8n exporta cada cierre de turno desde InfluxDB).

---

## 4. ESTRUCTURA TYPESCRIPT

### 4.1 `src/types/metrics.ts`

```typescript
export type MetricArea = 'energia' | 'produccion' | 'guardia';
export type MetricStatus = 'ok' | 'warn' | 'alarm' | 'unknown';
export type ShiftRef = 'current' | 'previous';

export interface Setpoints {
  min?: number;
  max?: number;
  warnMin?: number;
  warnMax?: number;
}

export interface MetricReading {
  id: string;                    // sensor_id
  area: MetricArea;
  label: string;
  value: number;
  unit: string;
  status: MetricStatus;
  timestamp: string;             // ISO
  setpoints?: Setpoints;
  precision?: number;
}

export interface LevelReading extends MetricReading {
  capacity: number;              // 100 si es %
}

export interface VariableDefinition {
  sensor_id: string;
  label: string;
  area: MetricArea;
  unit: string;
  setpoints: Setpoints;
  precision: number;
  type: 'numeric' | 'level' | 'boolean' | 'computed';
  computed_from?: string[];      // si type === 'computed'
  show_in_dashboard: boolean;
  show_in_kpi_hero?: boolean;
}
```

### 4.2 `src/types/shift.ts`

```typescript
export type ShiftName = 'morning' | 'afternoon' | 'night';

export interface Shift {
  name: ShiftName;
  displayName: string;           // "Turno Mañana", "Turno Tarde", "Turno Noche"
  start: Date;                   // inicio del turno actual
  end: Date;                     // fin del turno actual
  elapsedMinutes: number;        // minutos transcurridos
  remainingMinutes: number;
  progress: number;              // 0-1
}

export interface ShiftKPI {
  id: 'molienda_promedio' | 'gas_turno_previo' | 'paradas' | 'vel_primer_molino';
  label: string;
  value: number | string | object;
  unit?: string;
  context?: string;
  shiftRef: ShiftRef;
  fetchedAt: string;             // ISO
  validUntil?: string;           // próximo cambio turno
}

export interface ParadasKPI {
  total: number;
  motivos: { motivo: string; cantidad: number; minutos: number }[];
  tiempo_neto_horas: number;
}

export interface VelMolinoKPI {
  promedio_rpm: number;
  samples: { timestamp: string; rpm: number }[];
}
```

### 4.3 `src/types/alerts.ts`

```typescript
export type AlertSeverity = 'info' | 'warn' | 'critical';

export interface ActiveAlert {
  id: string;
  severity: AlertSeverity;
  area: MetricArea;
  source: string;                // "Caldera 6", "pH jugo"
  title: string;                 // "Presión sobre límite"
  message: string;               // descripción completa
  detectedAt: string;            // ISO
  acknowledgedAt?: string;
  resolvedAt?: string;
  suggestedAction?: string;
  metadata?: Record<string, unknown>;
}
```

### 4.4 `src/types/webhooks.ts`

```typescript
import { z } from 'zod';

export const MetricsWebhookSchema = z.object({
  tenant_id: z.string().uuid().optional().default('default'),
  plant_id: z.string().uuid().optional().default('default'),
  source: z.enum(['n8n', 'node-red', 'manual']),
  timestamp: z.string().datetime().optional(),       // si no, server.now()
  metrics: z.array(z.object({
    sensor_id: z.string().min(1),
    value: z.union([z.number(), z.string()]),
    unit: z.string().optional(),                     // override catalog
    timestamp: z.string().datetime().optional(),
  })).min(1),
});

export type MetricsWebhookPayload = z.infer<typeof MetricsWebhookSchema>;

export const MillSpeedWebhookSchema = z.object({
  tenant_id: z.string().optional(),
  shift: z.enum(['morning', 'afternoon', 'night']),
  shift_date: z.string().date(),
  promedio_rpm: z.number(),
  samples: z.array(z.object({
    timestamp: z.string().datetime(),
    rpm: z.number(),
  })),
});

export type MillSpeedWebhookPayload = z.infer<typeof MillSpeedWebhookSchema>;
```

---

## 5. Catálogo runtime — `src/lib/constants/variables.ts`

```typescript
import type { VariableDefinition } from '@/types/metrics';

export const VARIABLES: VariableDefinition[] = [
  // ENERGÍA
  {
    sensor_id: 'caudal_total_vapor',
    label: 'Caudal total vapor',
    area: 'energia',
    unit: 't/h',
    setpoints: { min: 150, warnMax: 220 },
    precision: 1,
    type: 'computed',
    computed_from: ['caudal_caldera_2', 'caudal_caldera_3', 'caudal_caldera_6'],
    show_in_dashboard: true,
    show_in_kpi_hero: false,
  },
  {
    sensor_id: 'caudal_caldera_2',
    label: 'Caudal caldera 2',
    area: 'energia',
    unit: 't/h',
    setpoints: { min: 40, max: 80 },
    precision: 1,
    type: 'numeric',
    show_in_dashboard: true,
  },
  // ... (resto completar todas las 32 variables)
];

export const VARIABLE_BY_ID = Object.fromEntries(
  VARIABLES.map(v => [v.sensor_id, v])
);

export function getVariablesByArea(area: MetricArea): VariableDefinition[] {
  return VARIABLES.filter(v => v.area === area);
}
```

---

## 6. Schema Supabase relevante

```sql
-- src/lib/db/schema.sql (Drizzle generará types)

CREATE SCHEMA IF NOT EXISTS industrial;

CREATE TABLE industrial.sensor_mapping (
  sensor_id      TEXT PRIMARY KEY,
  label          TEXT NOT NULL,
  area           TEXT NOT NULL CHECK (area IN ('energia', 'produccion', 'guardia')),
  unit           TEXT NOT NULL,
  setpoint_min   NUMERIC,
  setpoint_max   NUMERIC,
  setpoint_warn_min NUMERIC,
  setpoint_warn_max NUMERIC,
  precision      INT DEFAULT 1,
  type           TEXT DEFAULT 'numeric',
  active         BOOLEAN DEFAULT true,
  tenant_id      UUID,
  plant_id       UUID,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE industrial.metrics_live (
  sensor_id      TEXT PRIMARY KEY REFERENCES industrial.sensor_mapping(sensor_id),
  value          NUMERIC NOT NULL,
  status         TEXT NOT NULL DEFAULT 'unknown',
  tenant_id      UUID,
  plant_id       UUID,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON industrial.metrics_live (tenant_id, plant_id, updated_at DESC);
ALTER TABLE industrial.metrics_live ENABLE ROW LEVEL SECURITY;

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE industrial.metrics_live;

CREATE TABLE industrial.metrics_history (
  id             BIGSERIAL PRIMARY KEY,
  sensor_id      TEXT NOT NULL,
  value          NUMERIC NOT NULL,
  status         TEXT,
  tenant_id      UUID,
  plant_id       UUID,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (recorded_at);

CREATE INDEX ON industrial.metrics_history (sensor_id, recorded_at DESC);

CREATE TABLE alerts.active (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity       TEXT NOT NULL CHECK (severity IN ('info', 'warn', 'critical')),
  area           TEXT NOT NULL,
  source         TEXT NOT NULL,
  title          TEXT NOT NULL,
  message        TEXT,
  suggested_action TEXT,
  detected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at    TIMESTAMPTZ,
  tenant_id      UUID,
  plant_id       UUID
);

CREATE INDEX ON alerts.active (resolved_at, detected_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE alerts.active;

CREATE TABLE industrial.shift_kpis_cache (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id         TEXT NOT NULL,
  shift_date     DATE NOT NULL,
  shift_name     TEXT NOT NULL,
  shift_ref      TEXT NOT NULL,         -- 'current' o 'previous'
  payload        JSONB NOT NULL,
  fetched_at     TIMESTAMPTZ DEFAULT now(),
  valid_until    TIMESTAMPTZ,
  tenant_id      UUID,
  plant_id       UUID,
  UNIQUE (kpi_id, shift_date, shift_name, tenant_id, plant_id)
);
```

---

## 7. Mapping completo a confirmar con cliente

**Pendiente humano:**

- [ ] Confirmar tags exactos InfluxDB / KEPServerEX para cada uno de los 32 `sensor_id`
- [ ] Setpoints reales (min/max/warn) por sensor — los valores actuales son tentativos
- [ ] Diferenciar `presion_alta_baja` ¿es un sensor o dos (alta + baja separados)?
- [ ] `nivel_melado_1_2` ¿es 1 sensor "melado1/melado2" o 2 sensores?
- [ ] `caudal_vino_destilado` y `caudal_buen_gusto` ¿son separados o un total?
- [ ] `color_humedad_azucar` confirmar si vienen como 2 sensores (color + humedad)
- [ ] Query SQL exacta para gas turno previo (tabla MSSQL + columnas)
- [ ] Query SQL exacta para paradas turno previo (tabla + columnas + cómo identifica turno)
- [ ] URL + auth del HTTP endpoint listo de molienda promedio
- [ ] Schema payload del webhook de velocidad primer molino

---

## 8. Cálculos derivados

```typescript
// src/lib/utils/calculations.ts

export function caudalTotalVapor(c2: number, c3: number, c6: number): number {
  return c2 + c3 + c6;
}

export function generacionTotal(weg: number, siemens: number): number {
  return weg + siemens;
}

export function promedioMoliendaTurnoActual(
  acumulado: number,
  horasTrans: number
): number {
  return horasTrans > 0 ? acumulado / horasTrans : 0;
}

export function k2Funcionando(vaporDestileria: number): boolean {
  return vaporDestileria > 2;
}

export function resolveStatus(
  value: number,
  setpoints: Setpoints
): MetricStatus {
  if (setpoints.min !== undefined && value < setpoints.min) return 'alarm';
  if (setpoints.max !== undefined && value > setpoints.max) return 'alarm';
  if (setpoints.warnMin !== undefined && value < setpoints.warnMin) return 'warn';
  if (setpoints.warnMax !== undefined && value > setpoints.warnMax) return 'warn';
  return 'ok';
}
```

---

**Siguiente:** [`06_INTEGRACION_DATOS.md`](./06_INTEGRACION_DATOS.md)
