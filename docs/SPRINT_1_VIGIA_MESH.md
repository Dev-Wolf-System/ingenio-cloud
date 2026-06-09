# Sprint 1 — Vigía Mesh (v2 — Consolidated)

> Plan ejecutable para la red de agentes IA proactivos.
> v2: consolidado con esquema Influx real + decisión arquitectura.
> Estado: EN CURSO · Actualizado 2026-06-08

---

## Decisión de arquitectura

**Fase 1 (este sprint)**: Vigía 100% NestJS nativo, sin sidecar Python.
- Lee Influx directamente (calderas, trapiche, fabrica, electrica) — no hace snapshots innecesarios.
- Usa `InfluxQueryService` ya existente.
- Z-score rolling en TypeScript (ventana 2h para detección, baseline 24h).
- Diagnóstico + Prescripción: OpenAI `gpt-4o-mini` via ai.service pattern existente.
- Anti-fatiga, debouncing y trial mode en NestJS.

**Fase 2 (sprint 2+)**: Sidecar Python FastAPI + Celery para:
- Isolation Forest multivariado (requiere sklearn, no JS).
- Prophet / LSTM predicción a 30 min.
- RAG sobre manual Hugot.

No rompemos nada ahora, la Fase 2 coexiste con la Fase 1.

---

## Diferencia clave vs Sprint 0

| Sprint 0 | Sprint 1 (Vigía) |
|---|---|
| Umbrales fijos manuales en `/alertas` | Z-score estadístico rolling (detecta anomalías en rango) |
| IA solo al cambio de turno | Vigilancia continua cada 5 min |
| Sin correlación multi-sensor | Diagnóstico correlacionado + reglas declarativas |
| Sin prescripción | Pasos de acción específicos con responsable |
| WhatsApp solo manual | Notificación automática WhatsApp por severidad |

---

## Tablas de base de datos requeridas

### A) `production.sensores_vigia`

```sql
-- Configuración por variable a monitorear
CREATE TABLE production.sensores_vigia (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable          TEXT NOT NULL UNIQUE,     -- ej: 'vapor.vapor.vapor_alta_presion'
  tabla_influx      TEXT NOT NULL,            -- 'calderas' | 'trapiche' | 'fabrica' | 'electrica'
  display_name      TEXT NOT NULL,            -- 'Vapor Alta Presión'
  unidad            TEXT,                     -- 'Bar', 'Tn/H', '°C', '%', 'Kg/cm²'
  area              TEXT NOT NULL,            -- 'caldera' | 'trapiche' | 'fabrica' | 'electrica'
  -- Rangos operativos
  normal_min        NUMERIC,
  normal_max        NUMERIC,
  warn_min          NUMERIC,
  warn_max          NUMERIC,
  critical_min      NUMERIC,
  critical_max      NUMERIC,
  optimal           NUMERIC,
  -- Umbrales Z-score por área (override global)
  zscore_threshold  NUMERIC NOT NULL DEFAULT 3.0,
  -- Conocimiento experto
  probable_cause_high    TEXT,
  probable_cause_low     TEXT,
  action_if_high         TEXT,
  action_if_low          TEXT,
  process_impact         TEXT,
  hugot_ref              TEXT,
  -- Variables correlacionadas
  corr_variables    TEXT[],
  -- Control
  activo            BOOLEAN NOT NULL DEFAULT true,
  trial_mode        BOOLEAN NOT NULL DEFAULT true,  -- true = solo loggea, no notifica
  debounce_min      INT NOT NULL DEFAULT 30,
  min_samples       INT NOT NULL DEFAULT 30,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON production.sensores_vigia TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON production.sensores_vigia TO service_role;
```

### B) `industrial.vigia_insights`

```sql
CREATE TABLE industrial.vigia_insights (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source            TEXT NOT NULL CHECK (source IN ('anomaly','diagnostico','prescriptor','combined')),
  sensor_key        TEXT NOT NULL,
  sensor_name       TEXT,
  area              TEXT NOT NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('info','warn','critical')),
  title             TEXT NOT NULL,
  description       TEXT,
  diagnosis         TEXT,
  prescription      TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { value, mu, sigma, z_score, direction, baseline_window_h, corr_values: {} }
  parent_id         UUID REFERENCES industrial.vigia_insights(id) ON DELETE SET NULL,
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID,
  is_false_positive BOOLEAN NOT NULL DEFAULT false,
  notified_at       TIMESTAMPTZ,
  tenant_id         UUID NOT NULL DEFAULT 'ac154845-105e-408c-9650-58b8146d129a',
  plant_id          UUID NOT NULL DEFAULT '5aaaeb76-a290-4502-9048-c42faa4d3eef',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vigia_insights_active
  ON industrial.vigia_insights(detected_at DESC)
  WHERE resolved_at IS NULL AND is_false_positive = false;

CREATE INDEX idx_vigia_insights_sensor
  ON industrial.vigia_insights(sensor_key, detected_at DESC);

ALTER TABLE industrial.vigia_insights REPLICA IDENTITY FULL;
ALTER TABLE industrial.vigia_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY vigia_insights_read ON industrial.vigia_insights
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY vigia_insights_service ON industrial.vigia_insights
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON industrial.vigia_insights TO anon, authenticated;
GRANT ALL ON industrial.vigia_insights TO service_role;
```

---

## Variables a monitorear (propuesta inicial — PENDIENTE RANGOS DEL USUARIO)

Las columnas `normal_min/max`, `warn_min/max`, `critical_min/max` y los textos de causa/acción
deben ser completados por el equipo de proceso antes de activar Vigía.

| # | Variable Influx | Tabla | Display | Unidad | Estado rangos |
|---|---|---|---|---|---|
| 1 | `vapor.vapor.vapor_alta_presion` | calderas | Vapor Alta Presión | Bar | ⏳ pendiente |
| 2 | `vapor.vapor.vapor_baja_presion` | calderas | Vapor Baja Presión | Bar | ⏳ pendiente |
| 3 | `vapor.vapor.vapor_trapiche_caudal` | calderas | Caudal Vapor Trapiche | Tn/H | ⏳ pendiente |
| 4 | `caldera.Caldera.cald_vapor_alta_presion` | calderas | Presión Caldera (PLC) | Bar | ⏳ pendiente |
| 5 | `caldera.Caldera.cald_reserva_nivel` | calderas | Nivel Reserva Agua | % | ⏳ pendiente |
| 6 | `Clarificacion3.Clarificacion3.clar3_encalado_ph` | fabrica | pH Encalado | — | ⏳ pendiente |
| 7 | `Clarificacion3.Clarificacion3.clar3_calentador13_temp` | fabrica | Temp Calentador 1-3 | °C | ⏳ pendiente |
| 8 | `fabrica.fabrica.Fab_jugo_clarificado_caudal` | fabrica | Caudal Jugo Clarificado | — | ⏳ pendiente |
| 9 | `trapiche_cabina.trapiche_cabina.trap_molino1_presion_este` | trapiche | Presión Molino 1 Este | Kg/cm² | ⏳ pendiente |
| 10 | `trapiche_cabina.trapiche_cabina.trap_molino1_presion_oeste` | trapiche | Presión Molino 1 Oeste | Kg/cm² | ⏳ pendiente |
| 11 | `weg.weg.WEG_potencia_activa` | electrica | Potencia WEG | kW | ⏳ pendiente |
| 12 | `siemens.siemens.siemens_potencia_activa` | electrica | Potencia Siemens | kW | ⏳ pendiente |

---

## Correlaciones propuestas (validar con equipo de proceso)

```
vapor_alta_presion ↔ cald_vapor_alta_presion   (deben moverse juntos)
vapor_trapiche_caudal ↔ trap_molino1_presion*  (más caudal = más presión molienda)
clar3_calentador13_temp ↔ vapor_baja_presion   (calentador depende vapor escape)
WEG_potencia_activa ↔ siemens_potencia_activa  (cogeneración, deben complementar)
cald_reserva_nivel ↔ vapor_trapiche_caudal     (si reserva baja → reduce caudal)
Fab_jugo_clarificado_caudal ↔ molienda_actual  (jugo depende de caña molida)
```

---

## Arquitectura Vigía NestJS (Fase 1)

```
InfluxDB 3 (variables existentes)
      │
      │  cada 5 min (@Cron)
      ▼
VigiaMeshService (NestJS)
├── 1. pull_series(variable, 2h)      ← InfluxQueryService existente
├── 2. zscore_rolling(series, mu_24h) ← TypeScript puro
├── 3. check_debounce(variable, 30m)  ← Supabase vigia_insights
├── 4. collect_context()              ← correlaciones + paradas_inferidas + turno
├── 5a. rule_match()                  ← sensores_vigia probable_cause/action
├── 5b. llm_diagnose() si no hay regla ← OpenAI gpt-4o-mini
├── 6. insert_insight()               ← Supabase vigia_insights
└── 7. notify_whatsapp() si >= warn   ← Evolution API existente

Anti-fatiga:
  - debounce: no insight para misma variable si hay uno < 30min
  - confirmación: esperar 2 ciclos consecutivos antes de critical
  - trial_mode: solo loggea, no notifica (activo primeras 2 semanas)
  - silence_window: no notificar entre 00:00 y 06:00 salvo critical
```

### Módulo NestJS a crear

```
backend/src/modules/vigia/
├── vigia.module.ts
├── vigia.service.ts          ← orquestador + scheduler
├── vigia-detector.service.ts ← Z-score + correlación
├── vigia-diagnoser.service.ts ← OpenAI diagnosis + prescription
├── vigia-notifier.service.ts  ← WhatsApp + (futuro email/push)
└── vigia.controller.ts       ← GET /api/vigia/insights, POST /api/vigia/:id/resolve
```

### Endpoints

```
GET  /api/vigia/insights                      ← lista activos (no resueltos)
GET  /api/vigia/insights?limit=50&severity=   ← filtros
POST /api/vigia/:id/resolve                   ← resolver
POST /api/vigia/:id/false-positive            ← marcar FP
POST /api/vigia/check-now                     ← trigger manual (dev/debug)
GET  /api/vigia/status                        ← estado del servicio + últimos ciclos
```

---

## Frontend — componentes a crear

### A) Mini-widget dashboard (día 4)
```tsx
// components/industrial/VigiaBadge.tsx
// Muestra: "Vigía · N insights activos" con dot animado
// Colores: verde (0 insights) | ámbar (>0 warn) | rojo (>0 critical)
// Click → /vigia
// Subscribed via Supabase Realtime a vigia_insights INSERT
```

### B) Página `/vigia` (días 4-5)
```
┌─────────────────────────────────────────────────────┐
│  Vigía Mesh — Supervisión proactiva                 │
│  N insights activos · último ciclo hace Xmin        │
├─────────────────────────────────────────────────────┤
│  [Filtros: severidad | área | fuente]               │
├─────────────────────────────────────────────────────┤
│  ┌── INSIGHT ─────────────────────────────────────┐ │
│  │  ⚠️  Vapor Alta Presión — warn — hace 12 min   │ │
│  │  Z-score: 3.4  |  Valor: 8.2 Bar  |  μ: 6.1   │ │
│  │  Diagnóstico: [expandible]                     │ │
│  │  Prescripción: [expandible]                    │ │
│  │  Sparkline sensor últimas 2h                   │ │
│  │  [Resolver] [Falso positivo] [Ver correlaciones]│ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## WhatsApp — formato de notificación

```
🔴 VIGÍA — CRÍTICO
Sensor: Vapor Alta Presión (Bar)
Valor: 8.2 Bar  |  Normal: 5.5–6.8
Z-score: 3.4σ  |  Duración: 15min

Diagnóstico: Exceso de presión posiblemente por
cierre parcial de válvula de alivio.

Acción: Verificar válvula alivio + revisar setpoint
quemador caldera. Responsable: Jefe de turno.

→ Ver panel: https://ingcloud.srv.../vigia
```

---

## Pasos de implementación

| Paso | Tarea | Días | Pre-requisito |
|---|---|---|---|
| 1 | Migración DB: `sensores_vigia` + `vigia_insights` | 0.5 | — |
| 2 | Seed tabla `sensores_vigia` con 12 variables | 0.5 | **RANGOS DEL USUARIO** |
| 3 | `VigiaMeshModule` skeleton + cron base | 1 | Paso 1 |
| 4 | `VigiaDetectorService`: Z-score + debounce | 1 | Paso 3 |
| 5 | `VigiaDiagnoserService`: OpenAI + rules-first | 1.5 | Paso 4 |
| 6 | `VigiaNotifierService`: WhatsApp Evolution API | 0.5 | Paso 5 |
| 7 | Frontend: VigiaBadge widget | 0.5 | Paso 1 |
| 8 | Frontend: `/vigia` página timeline | 2 | Paso 7 |
| **TOTAL** | | **7–8 días** | |

**Quick win** (3-4 días): Pasos 1+3+4+5+6 sin UI — Vigía detecta y manda WhatsApp aunque no haya página bonita.

---

## Información requerida del equipo de proceso (BLOCKER)

Antes de activar el detector se necesitan:

### 1. Rangos operativos (12 variables — ver tabla arriba)
Por cada variable:
- Rango normal: min / max
- Umbral advertencia: warn_min / warn_max
- Umbral crítico: critical_min / critical_max
- Valor óptimo: optimal
- Causa probable si sube: probable_cause_high
- Causa probable si baja: probable_cause_low
- Acción si sube: action_if_high
- Acción si baja: action_if_low

### 2. Correlaciones confirmadas
¿Cuáles de las 6 correlaciones propuestas arriba son correctas?
¿Hay otras que el equipo de proceso conoce?

### 3. Targets de producción
- Target molienda t/h normal
- Target vapor normal calderas
- Target potencia generación propia (kW)

### 4. Configuración notificaciones
- Número WhatsApp jefe de turno (o grupo)
- Instancia Evolution API a usar
- Horario de silencio (sugerencia: 00:00-06:00)

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Spam de falsas alarmas | `trial_mode=true` primeras 2 semanas + debounce 30min |
| Variables con datos ruidosos | `min_samples=30` + zscore_threshold configurable |
| OpenAI cost | gpt-4o-mini ~$0.15/1M tokens; < $0.001 por diagnóstico |
| Influx sin datos recientes | check `series.length > min_samples` antes de evaluar |
| Parada fábrica genera FP masivos | detectar `paradas_inferidas.fin IS NULL` → silenciar variables de proceso |

---

## Métricas de éxito

| Métrica | Target |
|---|---|
| Tiempo anomalía → alerta | < 5 min |
| Precision (insights reales / total) | > 60% semana 1, > 80% semana 4 |
| Costo OpenAI por día | < $0.50 USD |
| False positives marcados | < 20% del total |

---

## Fase 2 — Python sidecar (sprint futuro)

Cuando Fase 1 esté en producción y tengamos feedback:
- Isolation Forest multivariado
- Prophet/LSTM predicción 15-30 min ahead
- RAG sobre manual Hugot
- `vigia_feed` bucket InfluxDB dedicado con variables normalizadas

---

*Vigía Mesh v2 — 2026-06-08 · Ingenio Cloud*
