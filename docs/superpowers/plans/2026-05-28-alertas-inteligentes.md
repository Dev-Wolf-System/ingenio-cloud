# Alertas Inteligentes — Implementation Plan (Fase 1 + Fase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el sistema de alertas en uno inteligente: triage IA batch que agrupa/prioriza, auto-escalado de severidad, comportamiento de modal/voz diferenciado por tipo, notificaciones PWA push al celular, y panel de config + historial profesional.

**Architecture:** Backend NestJS (módulo `alerts` + nuevo `notifications`) corre crons que evalúan umbrales, escalan severidad por reglas, y hacen triage IA batch (1 llamada gpt-4o-mini para todas las alertas activas). El resultado se guarda en `alerts.active.metadata`. El frontend Next.js consume `/alerts/active`, decide comportamiento por severidad recalibrada, y maneja PWA push. Fase 2 reescribe el panel `/alertas`.

**Tech Stack:** NestJS, @nestjs/schedule (cron), Supabase (PostgreSQL), OpenAI gpt-4o-mini, `web-push` (VAPID), Next.js 14 App Router, React Query, Recharts, Framer Motion, Jest (solo lógica pura — el repo no tiene cultura de tests; UI/cron se valida con `tsc --noEmit` + verificación manual).

**Vocabulario canónico de severidad:** `'info' | 'warn' | 'critical'` (es lo que ya guarda la DB: `alerts.active` tiene 130 `warn` + 191 `critical`). El frontend hoy usa `'warning'` por error → las advertencias se pintan como info. Task 0 lo normaliza.

**Convención de verificación:**
- Backend lógica pura → Jest (`cd backend && npx jest <archivo>`).
- Backend wiring/cron → `cd backend && npx tsc --noEmit` + log de arranque.
- Frontend → `cd frontend && npx tsc --noEmit` + verificación manual descrita.
- Commit después de cada task. Mensajes en español (subject + body), keywords conventional en inglés.

---

## File Structure

**Backend — crear:**
- `backend/src/modules/alerts/severity.ts` — helpers canónicos de severidad (orden, label, normalización).
- `backend/src/modules/alerts/severity.spec.ts` — tests.
- `backend/src/modules/alerts/escalation.ts` — función pura `shouldEscalate()`.
- `backend/src/modules/alerts/escalation.spec.ts` — tests.
- `backend/src/modules/alerts/alert-triage.service.ts` — cron triage IA batch.
- `backend/src/modules/alerts/triage-parse.ts` — parse puro de respuesta IA + hash de set.
- `backend/src/modules/alerts/triage-parse.spec.ts` — tests.
- `backend/src/modules/notifications/notifications.module.ts`
- `backend/src/modules/notifications/notifications.service.ts`
- `backend/src/modules/notifications/web-push.driver.ts`
- `backend/src/modules/notifications/notifications.controller.ts`
- `backend/src/modules/notifications/throttle.ts` + `throttle.spec.ts` — anti-spam puro.

**Backend — modificar:**
- `backend/src/modules/alerts/threshold-evaluator.service.ts` — integrar escalado + disparo de push.
- `backend/src/modules/alerts/alerts.service.ts` — TTS agrupado + resumen historial.
- `backend/src/modules/alerts/alerts.controller.ts` — exponer `offset`/`total`, endpoint resumen.
- `backend/src/modules/alerts/alerts.module.ts` — registrar `AlertTriageService`, importar `NotificationsModule`.
- `backend/src/modules/ai/ai.service.ts` — `triageAlertas()` + `resumenHistorial()`.
- `backend/src/config/env.ts` — VAPID keys.

**Frontend — crear:**
- `frontend/public/manifest.json`, `frontend/public/sw.js`
- `frontend/src/lib/hooks/useAlertModalBehavior.ts`
- `frontend/src/lib/push.ts` — registro SW + suscripción.
- `frontend/src/lib/severity.ts` — helpers canónicos front.
- `frontend/src/components/industrial/AlertGroup.tsx`
- `frontend/src/app/alertas/_components/AvisosConfigPanel.tsx`
- `frontend/src/app/alertas/_components/ThresholdsPanel.tsx`
- `frontend/src/app/alertas/_components/HistorialPanel.tsx`
- `frontend/src/app/alertas/_components/HistorialCharts.tsx`
- `frontend/src/app/alertas/_hooks/useAlertasConfig.ts`

**Frontend — modificar:**
- `frontend/src/components/industrial/AlertasModalAuto.tsx` — comportamiento por severidad.
- `frontend/src/app/alertas/page.tsx` — partir en paneles.
- `frontend/src/app/layout.tsx` — link manifest + registro SW.

**DB (migraciones vía MCP `apply_migration`):**
- `industrial.alert_thresholds` + `escalate_after_min int`, `escalate_drift_pct numeric`.
- `industrial.push_subscriptions` (tabla nueva).

---

## FASE 0 — Severidad canónica (foundation)

### Task 0: Normalizar vocabulario de severidad

**Files:**
- Create: `backend/src/modules/alerts/severity.ts`
- Create: `backend/src/modules/alerts/severity.spec.ts`
- Modify: `backend/src/modules/alerts/alerts.service.ts:231-237` (sevLabel + ORDER)
- Create: `frontend/src/lib/severity.ts`
- Modify: `frontend/src/components/industrial/AlertasModalAuto.tsx` (severityStyles keys + types)

- [ ] **Step 1: Test del helper backend**

`backend/src/modules/alerts/severity.spec.ts`:
```typescript
import { sevLabel, sevOrder, normalizeSeverity } from './severity';

describe('severity helpers', () => {
  it('normaliza warning legacy a warn', () => {
    expect(normalizeSeverity('warning')).toBe('warn');
    expect(normalizeSeverity('warn')).toBe('warn');
    expect(normalizeSeverity('critical')).toBe('critical');
    expect(normalizeSeverity('info')).toBe('info');
    expect(normalizeSeverity('xxx')).toBe('info');
  });
  it('ordena critical < warn < info', () => {
    expect(sevOrder('critical')).toBeLessThan(sevOrder('warn'));
    expect(sevOrder('warn')).toBeLessThan(sevOrder('info'));
  });
  it('label en español', () => {
    expect(sevLabel('warn')).toBe('de advertencia');
    expect(sevLabel('critical')).toBe('crítica');
    expect(sevLabel('info')).toBe('informativa');
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `cd backend && npx jest severity --silent`
Expected: FAIL — `Cannot find module './severity'`

- [ ] **Step 3: Implementar helper**

`backend/src/modules/alerts/severity.ts`:
```typescript
export type Severity = 'info' | 'warn' | 'critical';

export function normalizeSeverity(s: string): Severity {
  if (s === 'critical') return 'critical';
  if (s === 'warn' || s === 'warning') return 'warn';
  if (s === 'info') return 'info';
  return 'info';
}

const ORDER: Record<Severity, number> = { critical: 0, warn: 1, info: 2 };
export function sevOrder(s: string): number {
  return ORDER[normalizeSeverity(s)];
}

export function sevLabel(s: string): string {
  const n = normalizeSeverity(s);
  return n === 'critical' ? 'crítica' : n === 'warn' ? 'de advertencia' : 'informativa';
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `cd backend && npx jest severity --silent`
Expected: PASS (3 tests)

- [ ] **Step 5: Usar el helper en alerts.service.ts**

En `backend/src/modules/alerts/alerts.service.ts`, agregar import arriba:
```typescript
import { sevLabel, sevOrder } from './severity';
```
Reemplazar el bloque `ORDER`/`sevLabel`/sort (líneas ~231-241) por uso de los helpers:
```typescript
    const sorted = [...data].sort((a, b) => sevOrder(a.severity) - sevOrder(b.severity));

    const critCount = sorted.filter((a) => normalizeSeverity(a.severity) === 'critical').length;
    const warnCount = sorted.filter((a) => normalizeSeverity(a.severity) === 'warn').length;
```
(importar `normalizeSeverity` también). Eliminar la función local `sevLabel` y el `ORDER` local. El uso de `sevLabel(a.severity)` más abajo ahora resuelve `'warn'` correctamente.

- [ ] **Step 6: Helper frontend**

`frontend/src/lib/severity.ts`:
```typescript
export type Severity = 'info' | 'warn' | 'critical';

export function normalizeSeverity(s: string): Severity {
  if (s === 'critical') return 'critical';
  if (s === 'warn' || s === 'warning') return 'warn';
  return s === 'info' ? 'info' : 'info';
}
export const SEV_ORDER: Record<Severity, number> = { critical: 0, warn: 1, info: 2 };
```

- [ ] **Step 7: Arreglar el modal**

En `AlertasModalAuto.tsx`:
- Cambiar `ActiveAlert.severity` type a `'critical' | 'warn' | 'info'`.
- Renombrar la key `warning` de `severityStyles` a `warn`.
- Reemplazar `SEVERITY_ORDER` por import `SEV_ORDER` de `@/lib/severity` y usar `normalizeSeverity(a.severity)` al indexar `severityStyles` y al ordenar.
- En el header, `alerts.filter(a => a.severity === 'critical')` queda igual (critical no cambió).

- [ ] **Step 8: Verificar**

Run: `cd backend && npx jest severity --silent && npx tsc --noEmit`
Run: `cd frontend && npx tsc --noEmit`
Expected: ambos EXIT 0.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/alerts/severity.ts backend/src/modules/alerts/severity.spec.ts backend/src/modules/alerts/alerts.service.ts frontend/src/lib/severity.ts frontend/src/components/industrial/AlertasModalAuto.tsx
git commit -m "fix(alertas): normalizar vocabulario severidad a info/warn/critical

Las advertencias (warn) se pintaban como info en el modal y el TTS las
anunciaba 'informativa' porque el front usaba 'warning'. Helper canónico
compartido + tests."
```

---

## FASE 1 — Backend inteligencia

### Task 1: Auto-escalado de severidad por reglas

**Files:**
- Create: `backend/src/modules/alerts/escalation.ts`
- Create: `backend/src/modules/alerts/escalation.spec.ts`
- Modify: `backend/src/modules/alerts/threshold-evaluator.service.ts`
- DB migration: columnas `escalate_after_min`, `escalate_drift_pct`.

- [ ] **Step 1: Migración DB**

Aplicar vía MCP `apply_migration` (name `add_escalation_cols`):
```sql
ALTER TABLE industrial.alert_thresholds
  ADD COLUMN IF NOT EXISTS escalate_after_min integer,
  ADD COLUMN IF NOT EXISTS escalate_drift_pct numeric;
```

- [ ] **Step 2: Test de la función pura**

`backend/src/modules/alerts/escalation.spec.ts`:
```typescript
import { shouldEscalate } from './escalation';

const base = { detectedAt: new Date(Date.now() - 6 * 60_000).toISOString(), severity: 'warn' as const };

describe('shouldEscalate', () => {
  it('escala por persistencia >= 5min default', () => {
    const r = shouldEscalate({ ...base, value: 23, min: null, max: 22, afterMin: null, driftPct: null });
    expect(r.escalate).toBe(true);
    expect(r.reason).toBe('persistencia');
  });
  it('escala por drift >= 10% aunque sea reciente', () => {
    const recent = { ...base, detectedAt: new Date().toISOString() };
    const r = shouldEscalate({ ...recent, value: 25, min: null, max: 22, afterMin: null, driftPct: null });
    // (25-22)/22 = 13.6% >= 10
    expect(r.escalate).toBe(true);
    expect(r.reason).toBe('tendencia');
  });
  it('no escala si reciente y dentro del 10%', () => {
    const recent = { ...base, detectedAt: new Date().toISOString() };
    const r = shouldEscalate({ ...recent, value: 22.5, min: null, max: 22, afterMin: null, driftPct: null });
    expect(r.escalate).toBe(false);
  });
  it('no escala alertas que ya son critical', () => {
    const r = shouldEscalate({ ...base, severity: 'critical', value: 30, min: null, max: 22, afterMin: null, driftPct: null });
    expect(r.escalate).toBe(false);
  });
  it('respeta override por umbral', () => {
    const recent = { ...base, detectedAt: new Date(Date.now() - 2 * 60_000).toISOString() };
    const r = shouldEscalate({ ...recent, value: 23, min: null, max: 22, afterMin: 1, driftPct: null });
    expect(r.escalate).toBe(true); // afterMin=1, lleva 2min
  });
});
```

- [ ] **Step 3: Correr y ver fallar**

Run: `cd backend && npx jest escalation --silent`
Expected: FAIL — módulo no existe.

- [ ] **Step 4: Implementar**

`backend/src/modules/alerts/escalation.ts`:
```typescript
export const ESCALATE_AFTER_MIN = 5;
export const ESCALATE_DRIFT_PCT = 10;

export interface EscalateInput {
  severity: string;
  detectedAt: string;
  value: number;
  min: number | null;
  max: number | null;
  afterMin: number | null;   // override por umbral
  driftPct: number | null;   // override por umbral
}

export interface EscalateResult {
  escalate: boolean;
  reason: 'persistencia' | 'tendencia' | null;
}

/** Decide si una alerta warn debe pasar a critical. Pura, testeable. */
export function shouldEscalate(i: EscalateInput): EscalateResult {
  if (i.severity === 'critical') return { escalate: false, reason: null };

  const afterMin = i.afterMin ?? ESCALATE_AFTER_MIN;
  const driftPct = i.driftPct ?? ESCALATE_DRIFT_PCT;

  // 1. Tendencia: ¿cuánto se pasó del umbral cruzado?
  let drift = 0;
  if (i.max != null && i.value > i.max && i.max !== 0) {
    drift = ((i.value - i.max) / Math.abs(i.max)) * 100;
  } else if (i.min != null && i.value < i.min && i.min !== 0) {
    drift = ((i.min - i.value) / Math.abs(i.min)) * 100;
  }
  if (drift >= driftPct) return { escalate: true, reason: 'tendencia' };

  // 2. Persistencia
  const ageMin = (Date.now() - new Date(i.detectedAt).getTime()) / 60_000;
  if (ageMin >= afterMin) return { escalate: true, reason: 'persistencia' };

  return { escalate: false, reason: null };
}
```

- [ ] **Step 5: Correr y ver pasar**

Run: `cd backend && npx jest escalation --silent`
Expected: PASS (5 tests)

- [ ] **Step 6: Integrar en el evaluator**

En `threshold-evaluator.service.ts`, dentro del loop `for (const rule of rules)`, después de calcular `isOut`/`openId`: cuando `isOut && openId` (alerta ya abierta y sigue fuera), evaluar escalado. Necesitás traer `detected_at`, `severity`, `metadata` de las alertas abiertas (ampliar el `select` del paso 3 a `id, source, severity, detected_at`). Construir un `toEscalate: Array<{id, reason}>`:
```typescript
import { shouldEscalate } from './escalation';
// ...
// en select de openAlerts: .select('id, source, severity, detected_at, metadata')
// guardar el row completo en openMap (Map<string, OpenAlertRow>)
// dentro del loop, rama nueva:
} else if (isOut && openId) {
  const open = openMap.get(source)!;
  if (open.severity !== 'critical') {
    const res = shouldEscalate({
      severity: open.severity,
      detectedAt: open.detected_at,
      value: row.value,
      min: rule.min_value,
      max: rule.max_value,
      afterMin: rule.escalate_after_min ?? null,
      driftPct: rule.escalate_drift_pct ?? null,
    });
    if (res.escalate) toEscalate.push({ id: open.id, reason: res.reason! });
  }
}
```
Agregar `escalate_after_min`/`escalate_drift_pct` al type `Threshold` y al `select` de thresholds. Después del bloque de resolver, aplicar escalados:
```typescript
for (const e of toEscalate) {
  const { error } = await alerts.from('active')
    .update({ severity: 'critical', metadata: /* merge */ })
    .eq('id', e.id);
}
```
Para el merge de metadata sin pisar: hacer `update` con `severity:'critical'` y un campo `metadata` que combine lo previo (`{ ...open.metadata, escalated: true, escalated_at: now, escalated_reason: e.reason, original_severity: open.severity }`). Loggear `escalated N alerts`.

- [ ] **Step 7: Verificar**

Run: `cd backend && npx jest escalation --silent && npx tsc --noEmit`
Expected: EXIT 0.
Verificación manual: bajar un `max_value` de un umbral activo por debajo del valor actual y esperar ≥5min (o setear `escalate_after_min=1`) → la fila en `alerts.active` pasa a `severity='critical'` con `metadata.escalated=true`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/alerts/escalation.ts backend/src/modules/alerts/escalation.spec.ts backend/src/modules/alerts/threshold-evaluator.service.ts
git commit -m "feat(alertas): auto-escalado warn->critical por persistencia 5min o drift 10%

Motor de reglas determinista en el evaluator. Default global con override
por umbral (escalate_after_min, escalate_drift_pct). Tests de la función pura."
```

---

### Task 2: Triage IA batch

**Files:**
- Create: `backend/src/modules/alerts/triage-parse.ts` + `.spec.ts`
- Create: `backend/src/modules/alerts/alert-triage.service.ts`
- Modify: `backend/src/modules/ai/ai.service.ts` (método `triageAlertas`)
- Modify: `backend/src/modules/alerts/alerts.module.ts` (registrar provider)

- [ ] **Step 1: Test de parse + hash**

`backend/src/modules/alerts/triage-parse.spec.ts`:
```typescript
import { parseTriage, alertsHash } from './triage-parse';

describe('triage-parse', () => {
  it('parsea respuesta válida y normaliza severidad', () => {
    const raw = JSON.stringify({ alerts: [
      { id: 'a', severidad_recalibrada: 'warning', grupo_causa: 'vapor', prioridad: 1, titular: 'T', recomendacion: 'R' },
    ]});
    const out = parseTriage(raw);
    expect(out['a'].severidad).toBe('warn');
    expect(out['a'].grupo).toBe('vapor');
    expect(out['a'].prioridad).toBe(1);
  });
  it('devuelve {} ante JSON inválido', () => {
    expect(parseTriage('no json')).toEqual({});
  });
  it('hash estable ante mismo set, distinto ante cambio', () => {
    const a = [{ id: '1', value: 10 }, { id: '2', value: 20 }];
    const b = [{ id: '2', value: 20 }, { id: '1', value: 10 }];
    const c = [{ id: '1', value: 11 }, { id: '2', value: 20 }];
    expect(alertsHash(a)).toBe(alertsHash(b));
    expect(alertsHash(a)).not.toBe(alertsHash(c));
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `cd backend && npx jest triage-parse --silent`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar parse + hash**

`backend/src/modules/alerts/triage-parse.ts`:
```typescript
import { normalizeSeverity, Severity } from './severity';

export interface TriageEntry {
  severidad: Severity;
  grupo: string;
  prioridad: number;
  titular: string;
  recomendacion: string;
}

export function parseTriage(raw: string): Record<string, TriageEntry> {
  const out: Record<string, TriageEntry> = {};
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) return out;
    const obj = JSON.parse(raw.slice(start, end + 1)) as {
      alerts?: Array<Record<string, unknown>>;
    };
    for (const a of obj.alerts ?? []) {
      const id = String(a.id ?? '');
      if (!id) continue;
      out[id] = {
        severidad: normalizeSeverity(String(a.severidad_recalibrada ?? 'info')),
        grupo: String(a.grupo_causa ?? 'general'),
        prioridad: Number(a.prioridad ?? 99),
        titular: String(a.titular ?? ''),
        recomendacion: String(a.recomendacion ?? ''),
      };
    }
  } catch { /* {} */ }
  return out;
}

/** Hash estable del set de alertas (id+value), insensible al orden. */
export function alertsHash(alerts: Array<{ id: string; value?: number | null }>): string {
  return alerts
    .map((a) => `${a.id}:${a.value ?? ''}`)
    .sort()
    .join('|');
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `cd backend && npx jest triage-parse --silent`
Expected: PASS (3 tests)

- [ ] **Step 5: Método IA en ai.service.ts**

Agregar a `AiService`:
```typescript
async triageAlertas(
  alerts: Array<{ id: string; severity: string; area: string; title: string; message: string; metadata: { value?: number; unit?: string; min_value?: number; max_value?: number } }>,
): Promise<string | null> {
  if (!this.client) return null;
  const systemPrompt = `Sos ingeniero senior de un ingenio azucarero (La Corona, Tucumán).
Recibís TODAS las alertas activas a la vez. Tu trabajo: agrupar las que comparten causa raíz,
priorizar y recomendar. Considerá correlaciones (vapor↔gas, temperatura↔caudal vapor, etc).
Salida JSON estricto:
{ "alerts": [ { "id": "<id>", "severidad_recalibrada": "info|warn|critical",
  "grupo_causa": "<clave corta común a alertas relacionadas>", "prioridad": <1=mayor>,
  "titular": "<frase ejecutiva>", "recomendacion": "<acción concreta>" } ] }
No bajes una severidad por debajo de la informada si ya es crítica.`;
  const userPrompt = `Alertas activas:\n${alerts.map((a) => {
    const m = a.metadata ?? {};
    return `- id=${a.id} [${a.severity}] ${a.area}: ${a.title} (valor ${m.value ?? '—'}${m.unit ? ' ' + m.unit : ''}, rango ${m.min_value ?? '—'}..${m.max_value ?? '—'})`;
  }).join('\n')}`;
  try {
    const res = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    return res.choices[0]?.message?.content ?? null;
  } catch (err) {
    this.logger.error(`triageAlertas failed: ${(err as Error).message}`);
    return null;
  }
}
```

- [ ] **Step 6: AlertTriageService (cron)**

`backend/src/modules/alerts/alert-triage.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';
import { parseTriage, alertsHash } from './triage-parse';
import { sevOrder } from './severity';

@Injectable()
export class AlertTriageService {
  private readonly logger = new Logger(AlertTriageService.name);
  private lastHash = '';

  constructor(
    private readonly supabase: SupabaseService,
    private readonly ai: AiService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { timeZone: 'America/Argentina/Buenos_Aires' })
  async triage(): Promise<void> {
    if (!this.ai.isAvailable()) return;
    const alerts = this.supabase.schema('alerts');
    const { data, error } = await alerts.from('active')
      .select('id, severity, area, title, message, metadata')
      .is('resolved_at', null);
    if (error || !data?.length) { this.lastHash = ''; return; }

    const hash = alertsHash(data.map((a) => ({ id: a.id, value: (a.metadata as { value?: number })?.value })));
    if (hash === this.lastHash) return; // sin cambios → no gastar tokens

    const raw = await this.ai.triageAlertas(data as Parameters<AiService['triageAlertas']>[0]);
    if (!raw) return;
    const triage = parseTriage(raw);

    for (const a of data) {
      const t = triage[a.id];
      if (!t) continue;
      // piso: no bajar de critical si ya es critical
      const finalSev = sevOrder(t.severidad) < sevOrder(a.severity) ? t.severidad : a.severity;
      const meta = { ...(a.metadata as object), triage: t };
      await alerts.from('active').update({ severity: finalSev, metadata: meta }).eq('id', a.id);
    }
    this.lastHash = hash;
    this.logger.log(`triage aplicado a ${data.length} alertas`);
  }
}
```

- [ ] **Step 7: Registrar provider**

En `alerts.module.ts`: importar `AlertTriageService` y agregarlo a `providers`. Si `AiService` no resuelve por DI, importar `AiModule` en `imports` (verificar que `AiModule` exporte `AiService`).

- [ ] **Step 8: Verificar**

Run: `cd backend && npx jest triage-parse --silent && npx tsc --noEmit`
Expected: EXIT 0.
Manual: con alertas activas y `OPENAI_API_KEY` seteada, esperar ≤60s → las filas tienen `metadata.triage` con `grupo`/`prioridad`/`recomendacion`. Segundo ciclo sin cambios no debe loggear "triage aplicado" (hash igual).

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/alerts/triage-parse.ts backend/src/modules/alerts/triage-parse.spec.ts backend/src/modules/alerts/alert-triage.service.ts backend/src/modules/ai/ai.service.ts backend/src/modules/alerts/alerts.module.ts
git commit -m "feat(alertas): triage IA batch que agrupa, prioriza y recomienda

Cron 60s: 1 llamada gpt-4o-mini con todas las alertas activas + contexto.
Guarda triage en metadata. Hash anti-costo: solo llama si cambió el set."
```

---

### Task 3: TTS lee resumen agrupado

**Files:**
- Modify: `backend/src/modules/alerts/alerts.service.ts` (`generarAudioAlertas`)

- [ ] **Step 1: Usar triage en el texto TTS**

En `generarAudioAlertas`, ampliar el `select` a incluir `metadata` (ya lo trae). Antes de construir `text`, agrupar por `metadata.triage.grupo` cuando exista. Construir encabezado por grupo:
```typescript
// agrupar
const groups = new Map<string, typeof sorted>();
for (const a of sorted) {
  const g = (a.metadata as { triage?: { grupo?: string } })?.triage?.grupo ?? a.area;
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g)!.push(a);
}
```
Si hay grupos con >1 alerta, el texto menciona el grupo y su causa común; si no, cae al texto actual por alerta. Mantener el cap de 3 ítems hablados.

- [ ] **Step 2: Verificar**

Run: `cd backend && npx tsc --noEmit`
Expected: EXIT 0.
Manual: con 2+ alertas del mismo `grupo`, el audio dice "varias alertas en <grupo>" en vez de leerlas sueltas.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/alerts/alerts.service.ts
git commit -m "feat(alertas): TTS lee resumen agrupado por causa del triage IA"
```

---

## FASE 1 — Notificaciones PWA Push

### Task 4: Backend notifications + web-push driver

**Files:**
- Create: módulo `notifications` completo + `throttle.ts`/`.spec.ts`
- Modify: `backend/src/config/env.ts`, `backend/package.json` (dep `web-push`)
- DB: tabla `push_subscriptions`

- [ ] **Step 1: Instalar dep + migración**

Run: `cd backend && npm i web-push && npm i -D @types/web-push`
Migración MCP `create_push_subscriptions`:
```sql
CREATE TABLE IF NOT EXISTS industrial.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL,
  role text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON industrial.push_subscriptions TO service_role;
```

- [ ] **Step 2: Test anti-spam**

`backend/src/modules/notifications/throttle.spec.ts`:
```typescript
import { Throttle } from './throttle';

describe('Throttle', () => {
  it('permite el primer envío y bloquea repetido dentro de la ventana', () => {
    const t = new Throttle(30 * 60_000);
    const now = Date.now();
    expect(t.allow('s1', now)).toBe(true);
    expect(t.allow('s1', now + 1000)).toBe(false);
  });
  it('permite de nuevo pasada la ventana', () => {
    const t = new Throttle(30 * 60_000);
    const now = Date.now();
    expect(t.allow('s1', now)).toBe(true);
    expect(t.allow('s1', now + 31 * 60_000)).toBe(true);
  });
});
```

- [ ] **Step 3: Correr y ver fallar**

Run: `cd backend && npx jest throttle --silent`
Expected: FAIL.

- [ ] **Step 4: Implementar throttle**

`backend/src/modules/notifications/throttle.ts`:
```typescript
export class Throttle {
  private last = new Map<string, number>();
  constructor(private readonly windowMs: number) {}
  allow(key: string, now = Date.now()): boolean {
    const prev = this.last.get(key);
    if (prev != null && now - prev < this.windowMs) return false;
    this.last.set(key, now);
    return true;
  }
}
```

- [ ] **Step 5: Correr y ver pasar**

Run: `cd backend && npx jest throttle --silent`
Expected: PASS (2 tests)

- [ ] **Step 6: env VAPID**

En `backend/src/config/env.ts` agregar (siguiendo el patrón existente del archivo) las keys `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (opcionales, default `''`).

- [ ] **Step 7: WebPushDriver + service + controller**

`backend/src/modules/notifications/web-push.driver.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { SupabaseService } from '../supabase/supabase.service';

export interface PushPayload { title: string; body: string; severity: string; url: string; }

@Injectable()
export class WebPushDriver {
  private readonly logger = new Logger(WebPushDriver.name);
  private ready = false;
  constructor(private readonly config: ConfigService, private readonly supabase: SupabaseService) {
    const pub = config.get<string>('VAPID_PUBLIC_KEY');
    const priv = config.get<string>('VAPID_PRIVATE_KEY');
    const subj = config.get<string>('VAPID_SUBJECT') || 'mailto:admin@ingenio.local';
    if (pub && priv) { webpush.setVapidDetails(subj, pub, priv); this.ready = true; }
    else this.logger.warn('VAPID keys vacías — push deshabilitado');
  }
  async send(payload: PushPayload): Promise<void> {
    if (!this.ready) return;
    const { data } = await this.supabase.schema('industrial').from('push_subscriptions').select('endpoint, keys');
    for (const sub of data ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys } as webpush.PushSubscription,
          JSON.stringify(payload),
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await this.supabase.schema('industrial').from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }
  }
}
```
`notifications.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { WebPushDriver, PushPayload } from './web-push.driver';
import { Throttle } from './throttle';

@Injectable()
export class NotificationsService {
  private readonly throttle = new Throttle(30 * 60_000);
  constructor(private readonly driver: WebPushDriver) {}
  /** Envía respetando anti-spam por sensor (source). */
  async notify(source: string, payload: PushPayload): Promise<void> {
    if (!this.throttle.allow(source)) return;
    await this.driver.send(payload);
  }
}
```
`notifications.controller.ts`:
```typescript
import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly supabase: SupabaseService) {}
  @Post('subscribe')
  @HttpCode(200)
  async subscribe(@Body() body: { endpoint: string; keys: Record<string, string>; role?: string }) {
    if (!body?.endpoint || !body?.keys) return { ok: false };
    await this.supabase.schema('industrial').from('push_subscriptions')
      .upsert({ endpoint: body.endpoint, keys: body.keys, role: body.role ?? null }, { onConflict: 'endpoint' });
    return { ok: true };
  }
}
```
`notifications.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { WebPushDriver } from './web-push.driver';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, WebPushDriver],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```
Registrar `NotificationsModule` en `app.module.ts` imports.

- [ ] **Step 8: Verificar**

Run: `cd backend && npx jest throttle --silent && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/notifications backend/src/config/env.ts backend/package.json backend/package-lock.json backend/src/app.module.ts
git commit -m "feat(notif): módulo notifications con driver PWA web-push y anti-spam

Tabla push_subscriptions, VAPID, throttle 1/sensor/30min. Capa abstracta
lista para sumar email/WhatsApp después."
```

---

### Task 5: Disparar push en alta/escalado de alerta

**Files:**
- Modify: `backend/src/modules/alerts/threshold-evaluator.service.ts`
- Modify: `backend/src/modules/alerts/alerts.module.ts`

- [ ] **Step 1: Inyectar NotificationsService**

Importar `NotificationsModule` en `alerts.module.ts` imports. En `ThresholdEvaluatorService` constructor agregar `private readonly notif: NotificationsService`.

- [ ] **Step 2: Notificar al abrir (los 3 tipos) y al escalar**

Tras insertar `toOpen` (Task previa), por cada alerta nueva llamar:
```typescript
for (const a of toOpen) {
  await this.notif.notify(a.source, {
    title: `${a.severity === 'critical' ? '🔴' : a.severity === 'warn' ? '🟠' : '🔵'} ${a.area}`,
    body: a.title,
    severity: a.severity,
    url: '/alertas',
  });
}
```
Tras aplicar `toEscalate`, notificar la escalada con severity `critical`.

- [ ] **Step 3: Verificar**

Run: `cd backend && npx tsc --noEmit`
Expected: EXIT 0.
Manual (tras Task 6/suscripción): forzar una alerta nueva → llega push al dispositivo suscripto; segunda alerta del mismo sensor dentro de 30min no re-notifica.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/alerts/threshold-evaluator.service.ts backend/src/modules/alerts/alerts.module.ts
git commit -m "feat(notif): disparar push al abrir alerta (3 tipos) y al escalar a crítica"
```

---

### Task 6: Frontend PWA — manifest, service worker, suscripción

**Files:**
- Create: `frontend/public/manifest.json`, `frontend/public/sw.js`, `frontend/src/lib/push.ts`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: manifest.json**

`frontend/public/manifest.json`:
```json
{
  "name": "Ingenio Cloud — Monitoreo",
  "short_name": "Ingenio",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0A0E1A",
  "theme_color": "#0A0E1A",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" }]
}
```
(Usar un ícono existente en `public/` o agregar `icon-192.png`.)

- [ ] **Step 2: service worker**

`frontend/public/sw.js`:
```javascript
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Alerta', {
      body: data.body || '',
      tag: data.severity || 'alert',
      data: { url: data.url || '/alertas' },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

- [ ] **Step 3: helper de suscripción**

`frontend/src/lib/push.ts`:
```typescript
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function subscribePush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  const reg = await navigator.serviceWorker.register('/sw.js');
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
  const json = sub.toJSON();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/notifications/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  return res.ok;
}
```

- [ ] **Step 4: link manifest en layout**

En `frontend/src/app/layout.tsx`, agregar al `metadata` export `manifest: '/manifest.json'` (o `<link rel="manifest">` en el head).

- [ ] **Step 5: Verificar**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: build OK.
Manual: abrir dashboard en celu/Chrome → DevTools Application → Service Worker registrado tras tocar "Activar notificaciones" (UI en Task 9).

- [ ] **Step 6: Commit**

```bash
git add frontend/public/manifest.json frontend/public/sw.js frontend/src/lib/push.ts frontend/src/app/layout.tsx
git commit -m "feat(pwa): manifest, service worker y helper de suscripción web push"
```

---

## FASE 1 — Comportamiento del modal

### Task 7: Modal por severidad (info=voz / warn=8s / critical=persistente)

**Files:**
- Create: `frontend/src/lib/hooks/useAlertModalBehavior.ts`
- Create: `frontend/src/components/industrial/AlertGroup.tsx`
- Modify: `frontend/src/components/industrial/AlertasModalAuto.tsx`

- [ ] **Step 1: Hook de comportamiento**

`useAlertModalBehavior.ts`: dada la lista de alertas (con severidad recalibrada por triage en `metadata.triage.severidad` si existe, si no la cruda normalizada), expone `{ isOpen, close }`. Reglas:
```typescript
const WARNING_MODAL_OPEN_MS = 8_000;
const WARNING_REPEAT_MS = 5 * 60_000;
```
- Severidad efectiva por alerta = `metadata.triage.severidad ?? normalizeSeverity(severity)`.
- `dominant` = la más alta presente.
- Si `dominant === 'info'` → nunca abre (solo voz, que la maneja `useAlertAudio`).
- Si `dominant === 'warn'` → al detectar warn nueva abre; timer 8s cierra; si sigue activa, reabre cada 5min (timestamp del último show).
- Si `dominant === 'critical'` → abre y queda persistente hasta cierre manual; al cerrar, redisplay 5min si sigue.

- [ ] **Step 2: AlertGroup component**

`AlertGroup.tsx`: recibe `{ grupo: string; alerts: ActiveAlert[] }`, muestra encabezado del grupo (titular del triage si hay) y lista los `AlertItem`. Ordena por `prioridad` del triage.

- [ ] **Step 3: Integrar en AlertasModalAuto**

Reemplazar la lógica de apertura actual (`openModal`/`closeModal`/effects) por `useAlertModalBehavior`. Agrupar `sorted` por `metadata.triage.grupo` y renderizar `AlertGroup`. Mostrar `metadata.triage.recomendacion` en el `AlertItem` (sección destacada) si existe, antes del botón de análisis on-demand. Mantener el botón "Activar sonido" (audioBlocked) y los toggles.

- [ ] **Step 4: Verificar**

Run: `cd frontend && npx tsc --noEmit`
Expected: EXIT 0.
Manual: 
- Alerta info → no abre modal, suena voz.
- Alerta warn → modal abre ~8s, cierra solo; reaparece a los 5min si persiste.
- Alerta critical → modal persiste hasta cerrar.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/hooks/useAlertModalBehavior.ts frontend/src/components/industrial/AlertGroup.tsx frontend/src/components/industrial/AlertasModalAuto.tsx
git commit -m "feat(alertas): comportamiento de modal por severidad + agrupación por causa

info=solo voz, warn=modal 8s con repetición 5min, critical=persistente.
Muestra recomendación del triage IA y agrupa por causa raíz."
```

---

## FASE 2 — Panel config e historial

### Task 8: Partir alertas/page.tsx en paneles

**Files:**
- Create: `frontend/src/app/alertas/_hooks/useAlertasConfig.ts`
- Create: `_components/AvisosConfigPanel.tsx`, `ThresholdsPanel.tsx`, `HistorialPanel.tsx`
- Modify: `frontend/src/app/alertas/page.tsx`

- [ ] **Step 1: Extraer**

Mover a `useAlertasConfig.ts` el estado/fetch de sensors+thresholds+history y los toggles de audio (LS_*). Mover los 3 paneles a componentes en `_components/`. `page.tsx` queda como orquestador (~120 líneas): TopBar, gradiente, password gate, y los 3 paneles. Mantener el password gate y `runProtected`.

- [ ] **Step 2: Verificar**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: build OK, comportamiento idéntico al actual (sin regresión visual).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/alertas
git commit -m "refactor(alertas): partir page.tsx (748 líneas) en paneles y hook"
```

---

### Task 9: ThresholdsPanel pro + UI suscripción push

**Files:**
- Modify: `_components/ThresholdsPanel.tsx`, `AvisosConfigPanel.tsx`

- [ ] **Step 1: Umbrales agrupados por área**

En `ThresholdsPanel`: agrupar `filteredSensors` por `area` en secciones colapsables (estado abierto/cerrado por área). Cada fila agrega: badge de estado en vivo (en rango / fuera / sin lectura) calculado con el valor actual vs min/max, y la nota/descripción del umbral editable. Agregar 2 inputs opcionales por fila: `escalate_after_min`, `escalate_drift_pct` (placeholder "default"). Incluirlos en el `saveThresholds` payload (ya manda el row entero).

- [ ] **Step 2: Botón de notificaciones en AvisosConfigPanel**

Agregar una cuarta tarjeta toggle "Notificaciones en este dispositivo" que llama `subscribePush()` de `@/lib/push` y muestra estado (suscripto / pedir permiso). No requiere password (es por-dispositivo).

- [ ] **Step 3: Verificar**

Run: `cd frontend && npx tsc --noEmit`
Expected: EXIT 0.
Manual: secciones colapsan; guardar override de escalado persiste (verificar fila en `alert_thresholds`); botón notificaciones registra SW y crea fila en `push_subscriptions`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/alertas/_components/ThresholdsPanel.tsx frontend/src/app/alertas/_components/AvisosConfigPanel.tsx
git commit -m "feat(alertas): umbrales agrupados por área, estado en vivo, override escalado y alta de notificaciones"
```

---

### Task 10: Backend — paginación historial + resumen IA

**Files:**
- Modify: `backend/src/modules/alerts/alerts.controller.ts`, `alerts.service.ts`, `ai.service.ts`

- [ ] **Step 1: Exponer offset/total**

`listHistory` ya recibe `offset` y devuelve `total`. Verificar que el controller pase `offset` (ya lo hace). Agregar endpoint:
```typescript
@Get('history/resumen')
historyResumen(@Query('limit') limit?: string) {
  return this.svc.resumenHistorial(limit ? parseInt(limit, 10) : 100);
}
```

- [ ] **Step 2: resumenHistorial en service + ai**

`alerts.service.ts` `resumenHistorial(limit)`: trae las últimas `limit` resueltas, arma payload agregado (conteo por área/severidad/turno, duración media) y llama `ai.resumenHistorial(payload)`. `ai.service.ts` agrega `resumenHistorial(payload)` con prompt que devuelve `{ resumen, patrones: string[], recomendaciones: string[] }` (mismo patrón de parse JSON existente).

- [ ] **Step 3: Verificar**

Run: `cd backend && npx tsc --noEmit`
Expected: EXIT 0.
Manual: `GET /api/alerts/history/resumen` devuelve JSON con resumen.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/alerts/alerts.controller.ts backend/src/modules/alerts/alerts.service.ts backend/src/modules/ai/ai.service.ts
git commit -m "feat(alertas): endpoint resumen IA del historial + paginación offset/total"
```

---

### Task 11: HistorialPanel — paginación server-side + filtros

**Files:**
- Modify: `frontend/src/app/alertas/_components/HistorialPanel.tsx`, `useAlertasConfig.ts`

- [ ] **Step 1: Paginación**

Cambiar `fetchHistory` para aceptar `offset` y exponer paginador (botones anterior/siguiente, página actual, total). Page size 25. Estado `page` en el panel.

- [ ] **Step 2: Filtros**

Agregar filtros cliente: turno (05/13/21 calculado desde `detected_at`), área, severidad. (El backend ya filtra por resueltas; filtros adicionales sobre la página traída o agregar query params si se requiere server-side — para volumen actual, cliente sobre páginas alcanza.)

- [ ] **Step 3: Verificar**

Run: `cd frontend && npx tsc --noEmit`
Expected: EXIT 0.
Manual: paginar avanza offset; filtros acotan la tabla.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/alertas/_components/HistorialPanel.tsx frontend/src/app/alertas/_hooks/useAlertasConfig.ts
git commit -m "feat(alertas): historial paginado server-side con filtros por turno/área/severidad"
```

---

### Task 12: Gráficos del historial

**Files:**
- Create: `frontend/src/app/alertas/_components/HistorialCharts.tsx`
- Modify: `HistorialPanel.tsx`

- [ ] **Step 1: Charts**

`HistorialCharts.tsx` con Recharts (ya en stack — verificar dep en `frontend/package.json`, si falta `npm i recharts`):
- BarChart alertas por turno (05/13/21).
- AreaChart duración media por día.
- BarChart horizontal top-5 sensores con más alertas.
- Grid/heatmap simple hora×día (celdas coloreadas por densidad).
Tooltip custom (glass) según CLAUDE.md. Derivar datasets de la lista de historial cargada.

- [ ] **Step 2: Resumen IA**

Botón "Analizar período con IA" que llama `/alerts/history/resumen` y muestra `resumen`/`patrones`/`recomendaciones` en un bloque.

- [ ] **Step 3: Verificar**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: build OK.
Manual: gráficos renderizan con datos reales; resumen IA aparece al pedirlo.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/alertas/_components/HistorialCharts.tsx frontend/src/app/alertas/_components/HistorialPanel.tsx frontend/package.json
git commit -m "feat(alertas): gráficos de historial por turno/área/sensor + resumen IA del período"
```

---

## DEPLOY

### Task 13: Flag autoplay kiosko + env docs

**Files:**
- Modify: `ingenio-cloud/docs/DEPLOY*` o `plan/11_DEPLOY_VPS_DOCKER.md`, `.env.example` (front y back)

- [ ] **Step 1: Documentar flag + envs**

Agregar a la doc de deploy: la pantalla de la sala de monitoreo debe lanzar Chrome/Chromium con `--autoplay-policy=no-user-gesture-required --kiosk <URL>`. Documentar nuevas envs: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (backend) y `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (frontend). Incluir `npx web-push generate-vapid-keys` como paso de setup.

- [ ] **Step 2: Commit**

```bash
git add ingenio-cloud/docs ingenio-cloud/frontend/.env.example ingenio-cloud/backend/.env.example
git commit -m "docs(deploy): flag autoplay kiosko + envs VAPID para push"
```

---

## Self-Review (cobertura del spec)

| Spec § | Task |
|---|---|
| §1 Comportamiento por severidad | Task 0 (vocab), Task 7 (modal) |
| §2 Auto-escalado 5min/10% | Task 1 |
| §3 Triage IA batch + TTS agrupado | Task 2, Task 3 |
| §4 PWA push (capa abstracta) | Task 4, 5, 6, 9 (UI alta) |
| §5.1 Config UX | Task 8, Task 9 |
| §5.2 Historial pro + gráficos + resumen IA | Task 10, 11, 12 |
| §6 Audio (Fase 0) | hecho + Task 13 (flag) |
| Push 3 tipos | Task 5 (notifica info/warn/critical) |

Sin placeholders. Tipos consistentes: `Severity = 'info'|'warn'|'critical'` en back (`severity.ts`) y front (`lib/severity.ts`); `TriageEntry` definido en Task 2 y consumido en Task 3/7; `PushPayload` definido en Task 4 y usado en Task 5.
