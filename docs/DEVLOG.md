# DEVLOG — Ingenio Cloud v2.0

> Registro de features implementados, bugs corregidos y tareas pendientes.
> Actualizado: 2026-05-27 (sesión 2)

---

## ✅ COMPLETADO

### 🔔 Sistema de Alertas (2026-05-27)

#### Modal auto-emergente de alertas activas
- **Componente:** `frontend/src/components/industrial/AlertasModalAuto.tsx`
- Se abre automáticamente al detectar nuevas alertas activas
- Se reabre cada 5 min si la alerta persiste y fue cerrada manualmente
- Se cierra solo cuando no quedan alertas activas
- Respeta toggle `localStorage.alert_modal_enabled`
- Ordenado: critical → warning → info
- Glow del modal según severidad dominante
- Dot pulsante animado
- `ValueBar` visual: muestra valor actual vs rango mín/máx
- Footer: indicadores de estado beep/voz + link a /alertas
- Tamaño: `max-w-xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl max-h-[90vh]`

#### Análisis IA de causa por alerta
- **Endpoint:** `GET /api/alerts/:id/analisis-causa`
- Genera análisis contextual con OpenAI gpt-4o-mini
- Cache in-memory 5 min, invalidado si cambia `metadata.value + updated_at`
- Retorna: `causa_probable`, `factores_contribuyentes[]`, `acciones_sugeridas[]`
- Expandible inline en cada AlertItem del modal
- Indicador `cached: true` visible en UI

#### Historial de alertas
- **Endpoint:** `GET /api/alerts/history?limit=N&offset=N`
- Consulta `alerts.active` donde `resolved_at IS NOT NULL`
- **UI:** sección "HISTORIAL DE ALERTAS" en `/alertas`
- Columnas: Sev, Área, Alerta, Valor, Inicio, Normalización, Duración
- Duración coloreada: rojo >60min, amarillo >15min, verde si menor
- Las alertas se persisten en `alerts.active` con ciclo `detected_at → resolved_at`

#### Audio de alertas (beep + voz OpenAI TTS)
- **Hook:** `frontend/src/lib/hooks/useAlertAudio.ts`
- **Endpoints:** `POST /api/alerts/voice` + `POST /api/alerts/voice-text`
- Beep inmediato (`/sounds/alert.mp3`) + voz natural después (`tts-1-hd`, voz `nova`)
- **Repetición automática cada 5 min** si la alerta persiste sin resolver (igual que modal)
- Timer se resetea al llegar nueva alerta, se cancela al resolverse todas
- 2 toggles independientes: Beep y Voz
- Cuando Voz OFF → no llama OpenAI → **cero costo**
- Cache de audio 5 min por combinación de alertIds
- Maneja autoplay policy del browser (guarda audio pendiente hasta primer click)
- Texto natural: *"Atención, hay 2 alertas críticas en el sistema. En el área de Energía, alerta crítica: título. El valor actual es 95 grados. Está por encima del máximo permitido de 80 grados."*
- Máx 3 alertas en el audio + "Además hay N alertas más pendientes."
- Archivos: `frontend/public/sounds/alert.mp3` + `normalize.mp3`
- Costo estimado: ~$0.006 USD/alerta generada (tts-1-hd), <$2/mes en operación normal

#### Sonido de normalización al resolverse una alerta ✅
- Detecta alertas que desaparecen del array activo (`prevIdsRef` → diff)
- Reproduce `normalize.mp3` (tono suave diferente al de alerta)
- Si voz ON → llama `POST /api/alerts/voice-text` con texto:
  *"Normalizado. [título] volvió al rango normal."* (pluralizado si son varias)
- Si hay nuevas alertas Y resueltas simultáneas → prioriza audio de alerta nueva
- **Backend:** `POST /api/alerts/voice-text` + `alerts.service.generarAudioTexto(text)`

#### Fuentes del modal de alertas ampliadas (2026-05-27 sesión 2)
- Header: `text-sm lg:text-xl` → `text-base lg:text-2xl`
- Subtítulo header: `text-[10px] lg:text-sm` → `text-xs lg:text-base`
- Badge/área/tiempo: `text-[10px] lg:text-xs` → `text-xs lg:text-sm`
- Título alerta: `text-sm lg:text-base` → `text-base lg:text-lg`
- Mensaje: `text-xs lg:text-sm` → `text-sm lg:text-base`
- Análisis IA body: `text-xs` → `text-sm`, labels `text-[10px]` → `text-xs`

#### Protección por contraseña
- **Hook:** `frontend/src/lib/hooks/usePasswordSession.ts`
- **Componente:** `frontend/src/components/ui/PasswordGate.tsx`
- Password: `balitec$` (hardcoded cliente, válido para sala de control)
- Sesión desbloqueada 30 min vía `sessionStorage`
- Protege: Guardar umbrales, Toggle modal, Toggle beep, Toggle voz
- Modal glassmorphism con input show/hide password

#### Panel de configuración de avisos
- Nuevo panel en `/alertas` con 3 toggles protegidos:
  - **Modal automático** → `localStorage.alert_modal_enabled` (default: ON)
  - **Beep de alerta** → `localStorage.alert_beep_enabled` (default: ON)
  - **Voz IA (OpenAI TTS)** → `localStorage.alert_voice_enabled` (default: OFF)
- Cambio de toggle emite `StorageEvent` para sincronizar otros componentes

---

### 📊 KPIs y Sensores

#### KPIs derivados de energía (2026-05-27)
Inyectados en `dashboard_data` cada vez que ingresa payload de energía desde Node-RED:
- `Gas_Total` (m³/h) = Caudal_Gas_Cald2 + Caudal_Gas_Cald3 + Caudal_Gas_Cald6
- `Vapor_Total_Calderas` (Tn/H) = suma calderas — **oculto en tiles** (tile combo ya lo muestra)
- `Potencia_Total` (MW) = (Weg + Siemens) / 1000 — **oculto en tiles** (tile combo ya lo muestra)
- Los 3 disponibles en tabla de config de umbrales (área `energia`)

#### Fix: tiles duplicados ocultos (2026-05-27)
`Vapor_Total_Calderas` y `Potencia_Total` agregados al set `oculto` en `EnergyPanel.tsx`.
Siguen en DB para configuración de umbrales. No aparecen como tiles sueltos.

---

### 📋 Reportes de Turno

#### Fix: paradas no aparecían en reportes (2026-05-27)
- **Causa:** schema `legacy` no estaba en `PGRST_DB_SCHEMAS` de PostgREST
- **Solución:** RPC `public.fn_paradas_turno(ts_inicio, ts_fin)` con `SECURITY DEFINER` + `search_path = legacy`
- Solo `service_role` tiene `EXECUTE` — dato no expuesto directamente
- Archivo: `backend/src/modules/reportes/reportes-data.service.ts` → `fetchParadas()`

#### Fix: reportes no se enviaban (silencio en audit)
- **Causa:** `service_role` no tenía grants en `production.reportes_turno_enviados`
- **Solución SQL:**
  ```sql
  GRANT SELECT, INSERT, UPDATE ON production.reportes_turno_enviados TO service_role;
  GRANT USAGE, SELECT ON SEQUENCE production.reportes_turno_enviados_id_seq TO service_role;
  ```

---

### 🎨 UI / UX

#### Subtítulos de secciones más claros (2026-05-27)
- `PremiumPanel` subtitle: `text-[10px] text-text-muted` → `text-[11px] text-text-secondary`
- TopBar planta: mismo ajuste
- Textos mejorados:
  - ENERGÍA: `Calderas · Vapor · Potencia eléctrica · N señales activas`
  - TRAPICHE: `Molinos · Extracción de jugo · N/M sensores en línea`
  - PRODUCCIÓN: `Fábrica · Clarificación · Tachos · Destilería · N señales activas`
  - MOLIENDA TIEMPO REAL: `Turno en curso · acumulado hora a hora desde las 07:00 hs`
  - RESUMEN GUARDIA: `Turno X · HH:MM → HH:MM · KPIs consolidados`

#### Tabla config alertas más grande en desktop
- Headers: `text-[10px] lg:text-xs`, celdas con padding `lg:`
- Botón Volver escalado con prefixes `lg:`

---

## ⚠️ PENDIENTE

### Bugs conocidos

| # | Descripción | Archivo | Prioridad |
|---|---|---|---|
| 1 | Re-display timer (5min) no respeta toggle modal OFF | `AlertasModalAuto.tsx` | Alta |
| 2 | Endpoint `/alerts/voice` + `/alerts/voice-text` sin rate limiting | `alerts.controller.ts` | Media |

**Fix bug #1:**
```typescript
// En closeModal → setTimeout callback, agregar check:
if (alerts.length > 0 && getLs(LS_MODAL, true)) openModal();
```

---

### Features faltantes

| # | Feature | Área | Esfuerzo |
|---|---|---|---|
| 3 | Más KPIs configurables (Influx-based: vapor por sector, etc.) | Config alertas | Alto |
| 4 | Verificar cron auto-firing reportes de turno (05:30/13:30/21:30) | Reportes | Bajo |
| 5 | Página historial de reportes de turno enviados | Frontend | Medio |
| 6 | Indicador visual "audio pendiente" (autoplay bloqueado) | AlertasModalAuto | Bajo |
| 7 | Botón "Probar sonido" en panel de config de avisos | /alertas page | Bajo |
| 8 | Git push a remote (credenciales pendientes) | DevOps | Bajo |

### Decisiones técnicas TTS (referencia futura)
- **Modelo:** `tts-1-hd` (no `tts-1`) — diferencia de calidad notable en español
- **Voz:** `nova` — mejor pronunciación español latinoamericano vs `onyx` (grave, robótica en ES)
- **Idioma:** no usar prefijo separado; integrar "Atención, hay..." al inicio del texto → TTS detecta español por contexto
- **Repetición audio:** `scheduleRepeat()` en `useAlertAudio.ts` — setTimeout auto-recurrente cada 5min, usa `alertsRef` para evitar stale closure

---

### KPIs faltantes en config de alertas

Los siguientes KPIs de Influx aún no están disponibles como targets de umbral:
- Vapor por sector (caldera 2, 3, 6 individualmente desde Influx)
- Alcohol industrial (derivado estimado)
- Cachaza, bagazo (de `v_dia_industrial_hxh`)

Para agregar: deben aparecer en `dashboard_data` vía ingesta Node-RED **o** exponerse via endpoint separado en el evaluador de umbrales.

---

## 🏗️ ARQUITECTURA ACTUAL

```
frontend/src/
├── app/
│   ├── page.tsx                    # Dashboard principal (KpiHero)
│   └── alertas/page.tsx            # Config umbrales + historial + config avisos
├── components/
│   ├── industrial/
│   │   ├── AlertasModalAuto.tsx    # Modal auto-emergente + audio hook
│   │   ├── KpiHero.tsx             # Monta AlertasModalAuto
│   │   ├── EnergyPanel.tsx         # Tiles energía (oculta derivados duplicados)
│   │   ├── TrapichePanel.tsx
│   │   ├── ProductionPanel.tsx
│   │   ├── MoliendaProduccionHora.tsx
│   │   └── ShiftSummaryPanel.tsx
│   ├── layout/TopBar.tsx
│   └── ui/PasswordGate.tsx         # Modal de contraseña
└── lib/hooks/
    ├── useAlertAudio.ts            # Orquesta beep + TTS + normalización
    └── usePasswordSession.ts       # Sesión desbloqueada 30min

backend/src/modules/
├── alerts/
│   ├── alerts.controller.ts        # GET active, GET history, GET :id/analisis-causa,
│   │                               # POST voice, POST voice-text
│   └── alerts.service.ts           # listActive, listHistory, getAnalisisCausa,
│                                   # generarAudioAlertas, generarAudioTexto
├── ai/
│   └── ai.service.ts               # analizarAlertaCausa, analizarResumenGuardia,
│                                   # generarVozAlertas
├── realtime/
│   └── realtime.service.ts         # ingestDashboard (+ KPIs derivados energía)
└── reportes/
    └── reportes-data.service.ts    # fetchParadas vía RPC fn_paradas_turno
```

### DB — Schema `alerts`
- Tabla `active`: todas las alertas (activas + resueltas). `resolved_at IS NULL` = activa.
- Evaluador de umbrales: `ThresholdEvaluatorService` — corre cada 30s, inserta/resuelve alertas.

### Audio — Flujo completo
```
Nueva alerta detectada (useAlertAudio)
  → beepEnabled? → reproduce /sounds/alert.mp3 (0ms)
  → voiceEnabled? → POST /api/alerts/voice { alertIds }
      → backend busca alertas activas, construye texto contextual
      → cache HIT (5min)? → devuelve buffer cacheado (0 API calls)
      → cache MISS? → OpenAI TTS (tts-1, onyx) → cachea → devuelve mp3
  → frontend reproduce blob URL

Alerta resuelta detectada (useAlertAudio)
  → beepEnabled? → reproduce /sounds/normalize.mp3 (0ms)
  → voiceEnabled? → POST /api/alerts/voice-text { text: "Normalizado. X volvió a rango normal." }
      → OpenAI TTS sin cache (texto único cada vez)
  → frontend reproduce blob URL

Prioridad: nueva alerta > normalización (si ambas simultáneas, gana alerta)
```

### Password — Acciones protegidas
| Acción | Requiere contraseña |
|---|---|
| Ver alertas / historial | ❌ |
| Guardar umbrales | ✅ `balitec$` |
| Toggle modal automático | ✅ |
| Toggle beep | ✅ |
| Toggle voz | ✅ |

---

*Actualizado por Claude Code — 2026-05-27*
