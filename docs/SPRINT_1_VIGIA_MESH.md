# Sprint 1 — Vigía Mesh

> Plan ejecutable para construir la red de agentes IA proactivos sobre el dashboard.
> Estado: PENDIENTE · Última revisión 2026-05-19

---

## Resumen ejecutivo

**Vigía Mesh** = red de 4 agentes IA especializados que vigilan continuamente el dashboard sin operador. Cada agente tiene un rol específico y se comunica con los demás vía bus de eventos (PostgreSQL NOTIFY/LISTEN + Realtime Supabase channels).

### Diferencia clave vs sistema actual

| Hoy (Sprint 0) | Vigía Mesh (Sprint 1) |
|---|---|
| Umbrales fijos configurados manualmente en `/alertas` | Detección **estadística** de anomalías (3σ rolling, isolation forest) |
| Análisis IA solo al cambio de turno (cron 05:15/13:15/21:15) | **Vigilancia continua** cada 30s-5min |
| Alerta dispara cuando valor cruza umbral configurado | Alerta dispara cuando hay **patrón anormal** aunque esté en rango |
| Sin contexto histórico para evaluar tendencias | Aprende patrones normales por turno/día/clima |
| Sin sugerencia de acción correctiva | Prescribe acción concreta con pasos |

---

## Arquitectura propuesta

```
┌────────────────────────────────────────────────────────────────────────┐
│                          BUS DE EVENTOS                                 │
│        PostgreSQL NOTIFY/LISTEN  +  Realtime Supabase channels         │
└──────┬─────────────┬───────────────┬───────────────┬───────────────────┘
       │             │               │               │
       ▼             ▼               ▼               ▼
┌──────────┐  ┌──────────┐   ┌─────────────┐   ┌─────────────┐
│ ANOMALY  │  │PREDICTOR │   │ DIAGNÓSTICO │   │ PRESCRIPTOR │
│ DETECTOR │  │  (LSTM   │   │   (LLM      │   │   (LLM      │
│ (3σ stat)│  │  / Proph)│   │   OpenAI)   │   │   OpenAI)   │
└────┬─────┘  └────┬─────┘   └──────┬──────┘   └──────┬──────┘
     │             │                │                  │
     │ "Z-score    │ "Molienda      │ "Caída por      │ "Reducir
     │  3.2 en     │  bajará a      │  imbibición     │  imbibición
     │  Temp_Cald" │  180 t/h en    │  fuera rango,   │  a 30 m³/h y
     │             │  30 min"       │  no es sensor"  │  monitorear"
     ▼             ▼                ▼                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│   alerts.active  +  industrial.vigia_insights  +  WhatsApp/Email      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Pasos detallados de implementación

### Paso 1 — Histórico continuo (pre-requisito, 1 día)

Vigía necesita serie temporal de cada sensor para detectar patrones.

**Tareas**:
- Verificar que tabla `industrial.metrics_history_2026_MM` particionada por mes está activa
- Crear cron backend NestJS que cada 1 min snapshot `dashboard_data` → `metrics_history`
  ```typescript
  @Cron('* * * * *', { timeZone: 'America/Argentina/Buenos_Aires' })
  async snapshotToHistory() {
    const industrial = this.supabase.schema('industrial');
    const { data } = await industrial
      .from('dashboard_data')
      .select('area, key, value, unit, updated_at');
    // INSERT en metrics_history particionada
    await industrial.from('metrics_history').insert(
      data.map((d) => ({
        sensor_id: `${d.area}:${d.key}`,
        recorded_at: new Date().toISOString(),
        value: d.value,
        unit: d.unit,
      }))
    );
  }
  ```
- Política de retención: 90 días (drop partition antigua automático con extension `pg_partman`)
- Estimación volumen: ~30 sensores × 1 row/min = 43k rows/día (gestionable con BRIN indexes)

**Criterio de éxito**: `SELECT count(*) FROM industrial.metrics_history WHERE recorded_at > now() - interval '1 hour'` devuelve ~1800 rows.

---

### Paso 2 — Anomaly Detector estadístico (1-2 días)

Primer agente, sin LLM. Detecta outliers con métodos clásicos.

**Tareas**:

A) Crear tabla `industrial.vigia_insights`:
```sql
CREATE TABLE industrial.vigia_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL CHECK (source IN ('anomaly','predictor','diagnostico','prescriptor')),
  sensor_key TEXT NOT NULL,
  area TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','warn','critical')),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  parent_id UUID REFERENCES industrial.vigia_insights(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  tenant_id UUID NOT NULL DEFAULT 'ac154845-105e-408c-9650-58b8146d129a',
  plant_id UUID NOT NULL DEFAULT '5aaaeb76-a290-4502-9048-c42faa4d3eef'
);
CREATE INDEX idx_vigia_insights_active ON industrial.vigia_insights(detected_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX idx_vigia_insights_sensor ON industrial.vigia_insights(sensor_key, detected_at DESC);
ALTER TABLE industrial.vigia_insights REPLICA IDENTITY FULL;
ALTER TABLE industrial.vigia_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY vigia_insights_read ON industrial.vigia_insights FOR SELECT TO public USING (true);
CREATE POLICY vigia_insights_service ON industrial.vigia_insights FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON industrial.vigia_insights TO anon, authenticated;
GRANT ALL ON industrial.vigia_insights TO service_role;
```

B) `AnomalyDetectorService` corre cada 60s:
```typescript
@Cron(CronExpression.EVERY_MINUTE, { timeZone: 'America/Argentina/Buenos_Aires' })
async detect() {
  // 1. Por cada sensor activo:
  //    - Calcular μ y σ rolling 24h desde metrics_history
  //    - Comparar con valor actual de dashboard_data
  //    - Si |valor − μ| > 3σ → dispara
  // 2. Anti-flapping: ignorar si hay otro insight para el mismo sensor < 10min
  // 3. INSERT en vigia_insights con metadata { value, mu, sigma, z_score }
}
```

C) Tunables:
- Threshold Z-score por área (energia=3, produccion=2.5, trapiche=3.5)
- Ventana rolling (24h por defecto, configurable por sensor)
- Mínimo de samples (n>30) antes de evaluar

**Criterio de éxito**: introducir desviación artificial >3σ en un sensor → row aparece en `vigia_insights` en ≤ 60s.

---

### Paso 3 — Predictor (LSTM o Prophet sidecar, 3-5 días)

Agente que predice valor futuro 15-30 min adelante.

**Tareas**:

A) Sidecar Python con FastAPI + Prophet o PyTorch LSTM:
```python
from fastapi import FastAPI
from prophet import Prophet

app = FastAPI()

@app.post("/predict")
def predict(req: PredictRequest):
    df = pd.DataFrame({'ds': req.timestamps, 'y': req.values})
    m = Prophet(daily_seasonality=False, weekly_seasonality=False)
    m.fit(df)
    future = m.make_future_dataframe(periods=req.horizon_min, freq='min')
    forecast = m.predict(future)
    return {
        'predicted': forecast.tail(1)['yhat'].values[0],
        'confidence_lower': forecast.tail(1)['yhat_lower'].values[0],
        'confidence_upper': forecast.tail(1)['yhat_upper'].values[0],
        'horizon_min': req.horizon_min,
    }
```

B) Backend NestJS llama al sidecar cada 5 min:
- Obtiene últimos N=240 valores del sensor (4h × 1 sample/min)
- POST `http://vigia-predictor:8001/predict`
- Si predicción cruza threshold antes que valor actual → INSERT vigia_insights `source='predictor'`

C) Modelo trainings:
- Re-entrenar nightly con histórico completo
- Por sensor (no global) — mejor precisión, más recursos
- Alternativa simple: ARIMA(2,1,2) en lugar de Prophet (menos memoria)

D) Docker Compose service nuevo:
```yaml
vigia-predictor:
  build: ./vigia-predictor
  container_name: vigia-predictor
  restart: unless-stopped
  networks: [n8n_evoapi]
  expose: [8001]
```

**Criterio de éxito**: predicción de Temp_Cald 30 min adelante con MAE < 5%.

---

### Paso 4 — Diagnóstico contextual con LLM (2-3 días)

Agente IA que correlaciona múltiples sensores para explicar la anomalía.

**Tareas**:

A) Listener en `vigia_insights` (PG NOTIFY o cron polling) que detecta insights de Anomaly/Predictor sin diagnóstico aún.

B) Para cada insight:
- Recolectar contexto:
  - Sensor afectado + serie últimos 30 min
  - Sensores correlacionados (definidos por matriz estática + correlación rolling)
  - Estado trapiche (funcionando/parado)
  - Turno actual
  - Si hay otras alertas/insights activos
- Llamar OpenAI gpt-4o-mini:
  ```typescript
  const systemPrompt = `Sos ingeniero senior experto en ingenios azucareros.
  Dada esta anomalía + contexto multi-sensor, identificá la causa probable.
  JSON: { causa: string, sensores_relacionados: string[], confianza: 0-1, urgencia: low|medium|high }`;
  ```
- INSERT child insight en `vigia_insights` con `source='diagnostico'`, `parent_id=anomaly.id`

C) Reglas de correlación predefinidas (matriz iniciales):
- Vapor_Vg1 ↔ Caudal_Gas_Cald* (suben/bajan juntos)
- Temperatura_Calentador ↔ Caudal_Vapor_Cald*
- Bagazo_Humedad ↔ Caudal_imbibición
- Trapiche_Estado ↔ Molienda_Kilos

**Criterio de éxito**: diagnóstico textualmente correcto en >70% de casos validados.

---

### Paso 5 — Prescriptor con LLM (1-2 días)

Agente que sugiere acción correctiva específica.

**Tareas**:

A) Listener en `vigia_insights` para `source='diagnostico'` sin prescripción.

B) Llamar OpenAI:
```typescript
const systemPrompt = `Sos jefe de turno con 20 años experiencia.
Dada esta causa diagnosticada, sugerí acción correctiva paso a paso.
Considerá riesgos. JSON:
{
  accion_principal: string,
  pasos: string[],
  riesgo_si_no_actuar: string,
  tiempo_estimado_min: number,
  rol_responsable: 'operador' | 'jefe_turno' | 'mantenimiento'
}`;
```

C) INSERT child `source='prescriptor'`. También push a `alerts.active` con:
- `severity` calibrada por confianza/urgencia
- `suggested_action` = primer paso
- `message` = accion_principal + riesgo

**Criterio de éxito**: prescripción accionable y específica (no genérica).

---

### Paso 6 — UI Vigía panel (2 días)

Componente frontend que muestra los insights activos.

**Tareas**:

A) Nueva ruta `/vigia` con:
- Timeline insights activos (más reciente arriba)
- Filtros por severity + source + área
- Cada insight expandible muestra:
  - Anomaly raw (Z-score, valor vs μ±σ)
  - Diagnóstico LLM (causa + correlaciones)
  - Prescripción LLM (acción + pasos)
- Acciones operador:
  - Acknowledge (marcar visto)
  - Resolved manual
  - Falso positivo (para fine-tuning)
- Sparkline inline del sensor afectado últimas 2h

B) Mini-widget "Vigía está vigilando" en dashboard principal (counter de insights activos, click → /vigia).

**Criterio de éxito**: operador puede triagear insight en < 30s.

---

### Paso 7 — Canal notificación WhatsApp (1 día, depende Evolution API)

Ya pendiente del Sprint 1 — el Vigía dispara hacia ese canal cuando `severity ≥ warn`.

**Tareas**:

A) `NotificationsService` listens a INSERTs en `vigia_insights` o `alerts.active` críticos.

B) Para cada evento:
- Formatear mensaje WhatsApp (resumen ejecutivo + acción + link al panel)
- POST a Evolution API:
  ```typescript
  await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: { apikey: EVOLUTION_API_KEY },
    body: JSON.stringify({
      number: jefeDeTurnoPhone,
      text: `🚨 ${insight.title}\n${insight.description}\n→ ${insight.metadata.accion_principal}`,
    }),
  });
  ```
- Anti-spam: máximo 1 notif/sensor/30min
- Roles destinatarios: jefe_turno → WhatsApp, operador → solo panel UI, mantenimiento → WhatsApp + email

**Criterio de éxito**: jefe de turno recibe WhatsApp en ≤ 90s de la detección de un critical.

---

## Tiempo total estimado

| Paso | Días |
|---|---|
| 1. Histórico continuo | 1 |
| 2. Anomaly Detector | 1-2 |
| 3. Predictor sidecar | 3-5 |
| 4. Diagnóstico LLM | 2-3 |
| 5. Prescriptor LLM | 1-2 |
| 6. UI Vigía panel | 2 |
| 7. WhatsApp | 1 |
| **TOTAL** | **11-16 días** |

---

## Quick Win (5-7 días)

Si urge ver resultados rápido, hacer **solo Pasos 2 + 4 + 5** (sin Predictor):

```
Anomaly estadístico (1-2 días)
       ↓
Diagnóstico LLM (2-3 días)
       ↓
Prescriptor LLM (1-2 días)
       ↓
WhatsApp básico (1 día)
```

Salta el Predictor (más complejo, requiere ML training + sidecar Python).
Resultado: Vigía funcional aunque sin predicción a futuro. **5-7 días total**.

---

## Configuración por implementar antes

| Item | Acción |
|---|---|
| OpenAI key | Verificar disponibilidad + rotar la actual (estuvo expuesta en chat) |
| Evolution API | Confirmar instancia activa + número del jefe de turno |
| Resend API | Para emails (opcional) |
| pg_partman | Para gestión automática de particiones `metrics_history` |
| Cron policies | Definir intervalos por agente |

---

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Spam de alertas (false positives) | Anti-flapping 10min mismo sensor + scoring confianza |
| Costo OpenAI (gpt-4o-mini ~$0.15/1M tokens) | Cache análisis si patrón repetido + batch nightly |
| Drift de modelo Predictor | Re-train nightly + alerta si MAE sube |
| Vigía marca normal anomalía real | Fine-tuning con feedback operador (falso positivo button) |
| Notificaciones fuera de horario | Schedule policies (no critical en 23:00-06:00) |

---

## Métricas de éxito globales

- **Tiempo a detección** (TTD): mediana < 2 min desde anomalía real
- **Precision**: >70% de insights validados como reales por operador
- **Recall**: >80% de eventos críticos reales detectados
- **Cost per insight**: < $0.005 OpenAI tokens
- **Operator satisfaction**: encuesta semanal 4/5+

---

*Próximos pasos al empezar Sprint 1: confirmar enfoque (quick win vs completo) + bloquear semana de dev focal.*
