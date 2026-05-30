# Deploy — Alertas Inteligentes (Fase 1+2)

Runbook para deployar el branch `feat/alertas-inteligentes` de forma segura, con
rollback inmediato a la versión estable. **`main` es la versión estable**: no se
mergea hasta validar en la sala.

---

## Principio

- **main** = estable, lo que corre hoy → punto de retorno.
- **feat/alertas-inteligentes** = candidato.
- **imágenes `:stable`** = backup que crea `deploy.sh` → botón de pánico (`rollback.sh`).

El branch NUNCA se borra → si falla, se vuelve a estable y se sigue corrigiendo en el branch.

---

## Pre-requisitos (una vez)

En `.env.prod-ready` (el `.env` que copiás a la VPS) deben estar:
- `OPENAI_API_KEY` (triage, voz, resumen).
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (push backend).
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (push frontend, se hornea en build).

Migración DB (opcional — solo habilita overrides de escalado por sensor; el default
global 5min/10% funciona sin ella). Correr en Supabase Studio / psql **como owner**:
```sql
ALTER TABLE industrial.alert_thresholds
  ADD COLUMN IF NOT EXISTS escalate_after_min integer,
  ADD COLUMN IF NOT EXISTS escalate_drift_pct numeric;
```
La tabla `industrial.push_subscriptions` ya existe. Ambos cambios son **aditivos**:
la versión estable los ignora si hay que volver atrás → **no requiere rollback de DB**.

---

## Deploy

En la VPS, en la raíz del repo:
```bash
git fetch
git checkout feat/alertas-inteligentes
bash scripts/deploy.sh
```
`deploy.sh` respalda las imágenes actuales como `:stable`, buildeа y levanta lo nuevo.

Reiniciar para tomar env nuevas lo hace el propio `up -d`.

---

## Verificación runtime (tildá uno por uno — nada de esto se probó automáticamente)

Audio / pantalla de sala (Chrome kiosko con `--autoplay-policy=no-user-gesture-required`):
- [ ] Salta una alerta y **suena sin tocar nada** (con el flag kiosko).
- [ ] Botón "Activar sonido" aparece si el navegador bloquea audio (sin flag).

Comportamiento por severidad:
- [ ] **Info** → no abre modal, solo voz (si voz activa).
- [ ] **Advertencia** → modal 8s, auto-cierra, reaparece a los 5min si persiste; tono medio.
- [ ] **Crítica** → modal persistente; suena `alert.mp3`.

Inteligencia:
- [ ] **Escalado**: una advertencia que persiste 5min o se desvía ≥10% pasa a crítica sola.
- [ ] **Triage IA**: con varias alertas activas, se agrupan por causa y muestran recomendación (requiere OpenAI key).

Notificaciones:
- [ ] En `/alertas`, "Activar notificaciones en este dispositivo" pide permiso y suscribe.
- [ ] Llega **push al celular** suscripto al saltar una alerta warn/critical.

Normalización:
- [ ] Al volver la variable a rango, la alerta **sale del modal al instante** (el modal se cierra si era la única crítica; queda si hay otras).
- [ ] Si sigue normal **30s**, suena `normalize.mp3` + la voz avisa que volvió a la normalidad.

Historial:
- [ ] Paginación, filtros (turno/área/severidad) y **gráficos** con datos reales.
- [ ] Botón "Analizar período con IA" devuelve resumen (requiere OpenAI key).

---

## Rollback (si algo falla)

```bash
bash scripts/rollback.sh
```
Restaura las imágenes `:stable` y reinicia en segundos. **El branch queda intacto**
para seguir corrigiendo. No hace falta tocar la base de datos.

---

## Si TODO anda

Recién ahí mergear a main:
```bash
git checkout main && git merge feat/alertas-inteligentes && git push
```

---

## Ancla en git (recomendado, una vez antes de todo)
```bash
git tag estable-pre-alertas main
```
Nombre fijo del último estado bueno, por si se necesita además del branch.

---

## Migración — `escalate_enabled` por umbral (REQUERIDA antes de deploy)

Esta migración es **obligatoria** antes de deployar el commit que agrega la opción
"no escalar" por umbral. El evaluador hace `.select('... escalate_enabled')` y fallará
con un error de Postgres si la columna no existe. El default `true` mantiene
compatibilidad con todos los umbrales existentes (sin cambio de comportamiento).

Correr en Supabase Studio / psql **como owner**:
```sql
ALTER TABLE industrial.alert_thresholds
  ADD COLUMN IF NOT EXISTS escalate_enabled boolean NOT NULL DEFAULT true;
```

> **Caveat**: hasta que esta columna exista en producción, el servicio
> `ThresholdEvaluatorService` lanzará un error en cada ciclo de evaluación y no
> procesará alertas. **No deployar este cambio sin correr la migración primero.**
>
> La migración es aditiva: si hay que hacer rollback a la versión anterior, la columna
> extra es ignorada — no requiere rollback de DB.
