# Alertas Inteligentes — Diseño (Fase 1 + Fase 2)

> Estado: APROBADO (diseño) · 2026-05-28
> Alcance: comportamiento de alertas por severidad, triage IA batch, auto-escalado,
> notificaciones mobile (PWA push), rework panel config e historial.
> NO incluye Vigía Mesh / Predictor ML (fases posteriores).

---

## 0. Contexto y problema

El dashboard corre en la **sala de monitoreo global de planta, desatendido** (nadie
interactúa necesariamente con la pantalla). Hoy:

- El audio de alertas no sonaba hasta que alguien tocaba/cerraba el modal (bug autoplay — **ya resuelto** en Fase 0, ver §6).
- Las alertas son solo cruce de umbral min/max. Sin agrupación, clasificación ni priorización inteligente.
- El análisis IA es on-demand y aislado (un sensor por vez).
- El panel de config es una tabla plana tosca; el historial no tiene paginación, gráficos ni análisis por turno.

Objetivo: alertas **inteligentes, automáticas y no intrusivas**, con notificación al
celular, escalado automático de severidad, y un panel de gestión profesional.

---

## 1. Modelo de comportamiento por severidad (frontend)

Refactor de `AlertasModalAuto.tsx`. El comportamiento se decide por la severidad
**recalibrada por IA** (ver §3), no por la cruda del threshold.

| Tipo | Modal | Voz (TTS) | Push mobile |
|---|---|---|---|
| **Informativa** (`info`) | ❌ no abre | ✅ comunica la info | ✅ |
| **Advertencia** (`warning`) | ✅ abre 8 s y **auto-cierra aunque persista**; si sigue activa, reabre cada 5 min | ✅ | ✅ |
| **Crítica** (`critical`) | ✅ persistente, requiere cierre manual (acción requerida) | ✅ | ✅ |

Reglas:
- El modal **agrupa por causa raíz IA** y ordena por **prioridad IA** (no solo por severity).
- Una sola instancia de modal: si coexisten críticas y advertencias, manda la crítica (modal persistente). Las advertencias se listan dentro.
- Si solo hay informativas → no se abre modal, solo suena la voz con el resumen.
- Timings configurables vía constantes: `WARNING_MODAL_OPEN_MS = 8_000`, `WARNING_REPEAT_MS = 5 * 60_000`.

### Detalle de implementación
- `AlertasModalAuto` calcula `dominantSeverity` recalibrada. Comportamiento de apertura/cierre por máquina de estados simple basada en esa severidad.
- Para advertencias: timer de 8 s que cierra; si en el próximo poll la alerta sigue y pasaron ≥5 min desde el último show → reabre.
- Para críticas: no auto-cierra; el redisplay de 5 min actual se mantiene solo si el usuario la cierra.
- Componente queda < ~250 líneas; extraer `AlertItem`, `AlertGroup` y `useAlertModalBehavior` a archivos propios.

---

## 2. Auto-escalado de severidad (backend, motor de reglas)

La IA **y** un motor de reglas determinista pueden cambiar la severidad de una alerta
activa. El motor de reglas es la fuente auditable; la IA solo recalibra/sugiere.

**Default global (aplicado a todas las alertas, override por umbral opcional):**

> Una alerta `warning` escala a `critical` si **persiste ≥ 5 min** activa **O** el valor
> se **desvía ≥ 10 %** más allá del umbral cruzado (por encima del máximo o por debajo
> del mínimo, según el caso).

- Se evalúa en el `ThresholdEvaluatorService` existente (cron 30 s) o en el nuevo triage (§3).
- Al escalar: `UPDATE alerts.active SET severity='critical'`, y en `metadata` se agrega
  `{ escalated: true, escalated_at, escalated_reason: 'persistencia 5min' | 'tendencia +10%', original_severity }`.
- No se crea fila nueva: es la misma alerta que cambia de severidad → dispara el comportamiento crítico (modal persistente + voz + push).
- Override por umbral: campos opcionales `escalate_after_min` y `escalate_drift_pct` en `industrial.alert_thresholds` (NULL = usa default global).

### Constantes default
`ESCALATE_AFTER_MIN = 5`, `ESCALATE_DRIFT_PCT = 10`.

---

## 3. Triage IA batch (backend, Fase 1 core)

Nuevo `AlertTriageService` (módulo `alerts`).

- **Cron ~60 s.** Toma **todas** las alertas activas (`resolved_at IS NULL`) + snapshot
  multi-sensor de `industrial.dashboard_data`.
- **Una sola llamada** a `gpt-4o-mini` con contexto agregado (no una llamada por alerta).
- Prompt devuelve JSON por alerta:
  ```json
  {
    "alerts": [{
      "id": "uuid",
      "severidad_recalibrada": "info|warning|critical",
      "grupo_causa": "string corto (clave de agrupación)",
      "prioridad": 1,
      "titular": "frase ejecutiva corta",
      "recomendacion": "acción accionable"
    }]
  }
  ```
- Persiste resultado en `alerts.active.metadata.triage` (jsonb). Sin tabla nueva.
- **Caché / control de costo:** solo llama a la IA si el set de alertas activas cambió
  (hash de ids + valores) desde el último triage. Si no cambió, conserva el triage previo.
- Si la IA recalibra severidad, respeta el escalado del motor de reglas como **piso**
  (la IA puede subir, no bajar por debajo de lo que las reglas determinaron crítico).
- Si IA no disponible: las alertas funcionan con severity cruda (degradación elegante).

### TTS agrupado
`generarAudioAlertas` (en `alerts.service.ts`) pasa a leer el **resumen agrupado** por
`grupo_causa` y prioridad, en vez de iterar alerta por alerta. Ej: *"Atención: 3 alertas
en Energía, causa probable común: caída de presión de vapor. Prioridad alta: ..."*.

---

## 4. Notificaciones mobile — PWA Web Push (Fase 1)

Capa **abstracta** para poder migrar/añadir email y WhatsApp (Evolution API) después sin
tocar el resto.

### Backend
- `NotificationsService` con interfaz `NotificationDriver { send(payload): Promise<void> }`.
- **Driver activo ahora: `WebPushDriver`** (librería `web-push`, claves VAPID en env).
- Tabla nueva `industrial.push_subscriptions { id, endpoint, keys jsonb, role, created_at }`.
- Dispara push cuando: nueva alerta `warning|critical`, escalado a crítica, o informativa relevante.
- **Anti-spam: máximo 1 push por sensor cada 30 min.**
- Payload: `{ title, body, severity, url: '/alertas' }`.
- Drivers futuros (`EmailDriver` Resend, `WhatsAppDriver` Evolution) implementan la misma interfaz; selección por config/rol.

### Frontend
- Service worker (`public/sw.js`) que maneja `push` y `notificationclick`.
- Registro PWA: `manifest.json` + registro de SW.
- UI en `/alertas`: botón "Activar notificaciones en este dispositivo" → pide permiso, suscribe, POST de la subscription al backend.
- VAPID public key expuesta vía `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

### Env nuevas
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

---

## 5. Fase 2 — Panel de config e historial profesional

### 5.1 Config de umbrales (rework UX)
Partir `alertas/page.tsx` (748 líneas) en componentes:
`AvisosConfigPanel`, `ThresholdsPanel`, `HistorialPanel`, `useAlertasConfig` hook.

- Umbrales **agrupados por área** en secciones colapsables (no tabla plana de todos los sensores).
- Por sensor: descripción/nota visible, badge de **estado en vivo** (en rango / fuera / sin lectura), valor actual destacado.
- Campos opcionales de **override de escalado** (`escalate_after_min`, `escalate_drift_pct`).
- Presets rápidos por tipo de sensor (opcional, si hay tiempo).
- Mantiene el password gate existente.

### 5.2 Historial (rework)
- **Paginación server-side** (backend `listHistory` ya soporta `limit`/`offset` — exponer `offset` y `total` en el controller y consumir desde el front con paginador).
- Filtros: turno (05/13/21), área, severidad, rango de fechas.
- **Gráficos** (Recharts):
  - Barras: alertas por turno.
  - Línea/área: duración media de alertas en el tiempo.
  - Top sensores con más alertas (barras horizontales).
  - Heatmap horario (hora × día) de densidad de alertas.
- **Resumen IA del período**: botón que llama un endpoint nuevo `/alerts/history/resumen` → gpt-4o-mini analiza el set filtrado y devuelve patrones/recomendaciones.

---

## 6. Fase 0 — Audio (RESUELTO)

Ya implementado:
- `useAlertAudio.ts` reescrito con `AudioContext` único desbloqueado en primer gesto;
  beep y voz vía WebAudio (no `new Audio()` por disparo). Suena solo sin tocar el modal.
- Botón "Activar sonido" de respaldo en el modal cuando el navegador bloquea audio.

Pendiente operativo (deploy):
- Lanzar la pantalla de la sala de monitoreo con flag
  `--autoplay-policy=no-user-gesture-required` para que suene 100 % sin gesto en kiosko desatendido.

---

## 7. Arquitectura — resumen de cambios

**Backend (NestJS, módulo `alerts` + nuevo `notifications`):**
- `AlertTriageService` (nuevo) — triage IA batch cron 60 s.
- `ThresholdEvaluatorService` (extender) — auto-escalado por reglas.
- `NotificationsService` + `WebPushDriver` (nuevo módulo `notifications`).
- `alerts.controller` — endpoints: `offset` en history, `/alerts/history/resumen`, `/notifications/subscribe`.
- `ai.service` — prompt de triage batch + prompt de resumen de historial.

**DB (Supabase, schema `industrial`):**
- `alert_thresholds`: + columnas `escalate_after_min`, `escalate_drift_pct` (nullable).
- `push_subscriptions` (tabla nueva).
- `alerts.active.metadata`: claves nuevas `triage`, `escalated`, `escalated_reason`, `original_severity` (sin migración, es jsonb).

**Frontend (Next.js):**
- `AlertasModalAuto` refactor + `AlertGroup`, `useAlertModalBehavior`.
- `alertas/page.tsx` partido en paneles + paginación + gráficos.
- PWA: `manifest.json`, `public/sw.js`, registro + UI de suscripción.

---

## 8. Routing de agentes (model-routing)
- **opus**: prompt de triage batch, prompt de resumen, schema de escalado, decisiones de diseño de la capa de notificaciones.
- **sonnet**: implementación de servicios, endpoints, refactor UI, gráficos, paginación, PWA boilerplate.
- **haiku**: lecturas puntuales, greps, ejecución de comandos.

## 9. Dependencias / prerequisitos
- OpenAI key activa (rotar la expuesta).
- Generar par VAPID (`npx web-push generate-vapid-keys`).
- `web-push` (backend), nada nuevo crítico en frontend.

## 10. Criterios de éxito
- Pantalla desatendida: alerta suena sola, sin interacción (con flag kiosko).
- Advertencia: modal aparece 8 s, se cierra solo, reaparece a los 5 min si persiste.
- Crítica: modal persistente; informativa: solo voz.
- Warning escala a critical sola tras 5 min o +10 % de desvío.
- Triage agrupa y prioriza alertas correlacionadas en 1 llamada IA.
- Push llega al celular suscripto en < 90 s, anti-spam 1/sensor/30min.
- Historial paginado con gráficos por turno y resumen IA.

## 11. Fuera de alcance (fases futuras)
- Vigía Mesh: histórico continuo, Anomaly Detector 3σ, Predictor ML, panel `/vigia`.
- Drivers de notificación email (Resend) y WhatsApp (Evolution API) — la capa queda lista, los drivers se agregan después.
