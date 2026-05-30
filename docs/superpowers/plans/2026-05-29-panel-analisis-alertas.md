# Panel de Análisis de Alertas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar config de historial/análisis y construir `/alertas/analisis`: un panel premium con KPIs+tendencia, insight IA automático, comparativas Turno/Día/Zafra, sensores reincidentes+MTBF, correlaciones, cruce alertas↔paradas, e historial paginado.

**Architecture:** Un endpoint backend `GET /alerts/analisis?periodo=` computa todo server-side (agregados deterministas en TS sobre filas de `alerts.active` + paradas vía RPC `fn_paradas_turno`), más un insight IA (gpt-4o-mini) cacheado 60min. El frontend es una ruta Next nueva con un hook React Query y componentes focalizados. `/alertas` se limpia (solo config) con CTA al análisis.

**Tech Stack:** NestJS, Supabase JS, OpenAI gpt-4o-mini, Next.js 14 App Router, React Query, Recharts (target ES2017 ya fijado), Jest (solo lógica pura; UI/cron vía `tsc --noEmit` + `next lint` + verificación manual — el repo no tiene tests de UI).

**Convención de verificación (aprendida del deploy):**
- Backend lógica pura → Jest.
- Backend wiring → `cd backend && npx tsc --noEmit`.
- Frontend → `cd frontend && rm -f tsconfig.tsbuildinfo && npx tsc --noEmit && npx next lint && npm run build` (borrar tsbuildinfo: la caché oculta errores ES5/iteración que el build de Docker sí cacha).
- **ES5/iteración**: nunca `for...of`/spread sobre Map/Set/string iterators → usar `Array.from(...)`. Target ya es ES2017 pero mantené el patrón por consistencia.
- Commits en español (subject+body), keywords conventional en inglés.

---

## Datos de referencia (ya verificados)

- `alerts.active` columns: `id, severity('info'|'warn'|'critical'), area, source, title, message, suggested_action, metadata jsonb, detected_at, resolved_at`. Hay 482 resueltas.
- `source` formato: `threshold::<area>::<key>`.
- Paradas: `SELECT * FROM public.fn_paradas_turno(ts_inicio timestamptz, ts_fin timestamptz)` → filas `{ fecha_industrial date, desde_hora time, hasta_hora time, motivo text, maquina text, origen_descripcion text }`. Acepta ventana arbitraria.
- Turnos: 05–13 (Mañana), 13–21 (Tarde), 21–05 (Noche). Día industrial: hora<8 pertenece al día anterior (igual que `v_*_bloques`).
- Helper severidad: `backend/src/modules/alerts/severity.ts` (`normalizeSeverity`, `sevOrder`).
- Patrón AI/parse: `backend/src/modules/ai/ai.service.ts` (`analizarResumenGuardia`/`resumenHistorial` con `tryExtractJson`). Caché: `AlertsService` usa `Map` (`causaCache`, `voiceCache`).

---

## File Structure

**Backend — crear:**
- `backend/src/modules/alerts/analisis/periodo.ts` — cálculo puro de rangos de período (turno/día/zafra + período anterior).
- `backend/src/modules/alerts/analisis/periodo.spec.ts`
- `backend/src/modules/alerts/analisis/aggregate.ts` — funciones puras: kpis, series, sensores+MTBF, correlaciones, cruce paradas.
- `backend/src/modules/alerts/analisis/aggregate.spec.ts`
- `backend/src/modules/alerts/analisis/analisis.types.ts` — interfaces de respuesta.
- `backend/src/modules/alerts/alerts-analisis.service.ts` — orquesta: query Supabase + paradas RPC + aggregate + IA + caché.

**Backend — modificar:**
- `backend/src/modules/alerts/alerts.controller.ts` — `GET analisis`.
- `backend/src/modules/ai/ai.service.ts` — `analizarPeriodoAlertas()`.
- `backend/src/modules/alerts/alerts.module.ts` — registrar `AlertsAnalisisService`.

**Frontend — crear (`frontend/src/app/alertas/analisis/`):**
- `page.tsx`, `_hooks/useAnalisis.ts`, `_types.ts`
- `_components/PeriodSelector.tsx`, `KpiRow.tsx`, `InsightCard.tsx`, `ComparativaTurnos.tsx`, `TendenciaDiaria.tsx`, `TopSensores.tsx`, `Heatmap.tsx`, `Correlaciones.tsx`, `AlertasParadas.tsx`, `HistorialTabla.tsx`

**Frontend — modificar:**
- `frontend/src/app/alertas/page.tsx` — quitar `HistorialCharts`+`HistorialPanel`, agregar CTA.
- `frontend/src/app/alertas/_hooks/useAlertasConfig.ts` — quitar estado de historial (migra a useAnalisis).
- Eliminar `frontend/src/app/alertas/_components/HistorialCharts.tsx` (canibalizado).
- Mover `HistorialPanel.tsx` → `analisis/_components/HistorialTabla.tsx` (o reusar).

---

## FASE A — Backend

### Task 1: Cálculo de rangos de período (puro)

**Files:**
- Create: `backend/src/modules/alerts/analisis/periodo.ts`, `periodo.spec.ts`

- [ ] **Step 1: Test**

`periodo.spec.ts`:
```typescript
import { rangoPeriodo, Periodo } from './periodo';

describe('rangoPeriodo', () => {
  const ref = new Date('2026-05-29T15:30:00-03:00'); // 15:30 ART → turno Tarde (13-21), día 29

  it('turno: ventana del turno actual + anterior', () => {
    const r = rangoPeriodo('turno', ref);
    expect(r.desde.getHours()).toBe(13);
    expect(r.hasta.getTime() - r.desde.getTime()).toBe(8 * 3600_000);
    expect(r.prevDesde!.getHours()).toBe(5);
  });
  it('dia: día industrial corriente + anterior', () => {
    const r = rangoPeriodo('dia', ref);
    // día industrial arranca 05:00; ventana 24h
    expect(r.hasta.getTime() - r.desde.getTime()).toBe(24 * 3600_000);
    expect(r.prevDesde).not.toBeNull();
  });
  it('zafra: desde inicio zafra (param) sin comparativa', () => {
    const r = rangoPeriodo('zafra', ref, new Date('2026-05-01T00:00:00-03:00'));
    expect(r.desde.toISOString()).toContain('2026-05-01');
    expect(r.prevDesde).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `cd backend && npx jest periodo --silent; echo $?`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

`periodo.ts`:
```typescript
export type Periodo = 'turno' | 'dia' | 'zafra';

export interface Rango {
  desde: Date;
  hasta: Date;
  prevDesde: Date | null;
  prevHasta: Date | null;
  etiqueta: string;
}

/** Inicio del turno (05/13/21) que contiene a `d` (hora local). */
function inicioTurno(d: Date): Date {
  const h = d.getHours();
  const base = new Date(d);
  base.setMinutes(0, 0, 0);
  if (h >= 5 && h < 13) base.setHours(5);
  else if (h >= 13 && h < 21) base.setHours(13);
  else if (h >= 21) base.setHours(21);
  else { base.setDate(base.getDate() - 1); base.setHours(21); }
  return base;
}

/** Inicio del día industrial (05:00; hora<5 → día anterior). */
function inicioDiaIndustrial(d: Date): Date {
  const base = new Date(d);
  base.setMinutes(0, 0, 0);
  if (d.getHours() < 5) base.setDate(base.getDate() - 1);
  base.setHours(5);
  return base;
}

export function rangoPeriodo(periodo: Periodo, ref = new Date(), zafraInicio?: Date): Rango {
  if (periodo === 'turno') {
    const desde = inicioTurno(ref);
    const hasta = new Date(desde.getTime() + 8 * 3600_000);
    const prevDesde = new Date(desde.getTime() - 8 * 3600_000);
    return { desde, hasta, prevDesde, prevHasta: desde, etiqueta: 'Turno actual' };
  }
  if (periodo === 'dia') {
    const desde = inicioDiaIndustrial(ref);
    const hasta = new Date(desde.getTime() + 24 * 3600_000);
    const prevDesde = new Date(desde.getTime() - 24 * 3600_000);
    return { desde, hasta, prevDesde, prevHasta: desde, etiqueta: 'Día industrial' };
  }
  // zafra
  const desde = zafraInicio ?? new Date(ref.getFullYear(), 0, 1);
  return { desde, hasta: ref, prevDesde: null, prevHasta: null, etiqueta: 'Zafra' };
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `cd backend && npx jest periodo --silent; echo $?`
Expected: exit 0 (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/alerts/analisis/periodo.ts backend/src/modules/alerts/analisis/periodo.spec.ts
git commit -m "feat(analisis): cálculo puro de rangos de período turno/día/zafra

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Tipos de respuesta

**Files:**
- Create: `backend/src/modules/alerts/analisis/analisis.types.ts`

- [ ] **Step 1: Crear tipos** (no requiere test — son interfaces)

`analisis.types.ts`:
```typescript
export interface AlertaRow {
  id: string; severity: string; area: string; source: string;
  title: string; detected_at: string; resolved_at: string | null;
}

export interface ParadaRow {
  inicio: string; fin: string | null; minutos: number | null;
  motivo: string; maquina: string | null; origen: string | null;
  alertas_relacionadas: Array<{ id: string; titulo: string; severidad: string; detected_at: string; offset_min: number }>;
}

export interface Kpis {
  total: number;
  por_severidad: { info: number; warn: number; critical: number };
  por_area: Record<string, number>;
  duracion_media_min: number;
  duracion_max_min: number;
  mtbf_min: number | null;
}

export interface Comparativa {
  total_prev: number | null;
  delta_pct: number | null;
  por_severidad_prev: { info: number; warn: number; critical: number } | null;
}

export interface SensorStat {
  area: string; key: string; titulo: string;
  n: number; mtbf_min: number | null; duracion_media_min: number;
}

export interface Correlacion { a: string; b: string; juntas: number; ventana_min: number; }

export interface Insight { resumen: string; patrones: string[]; recomendaciones: string[]; cached: boolean; generado_at: string; }

export interface AnalisisResponse {
  periodo: 'turno' | 'dia' | 'zafra';
  rango: { desde: string; hasta: string; etiqueta: string };
  kpis: Kpis;
  comparativa: Comparativa | null;
  series: {
    por_turno: Array<{ turno: 'Mañana' | 'Tarde' | 'Noche'; n: number }>;
    por_dia: Array<{ dia: string; n: number; duracion_media_min: number }>;
    heatmap: Array<{ dow: number; hora: number; n: number }>;
  };
  sensores: SensorStat[];
  correlaciones: Correlacion[];
  paradas: ParadaRow[];
  insight: Insight | null;
}
```

- [ ] **Step 2: Verificar + commit**

Run: `cd backend && npx tsc --noEmit; echo $?` → 0
```bash
git add backend/src/modules/alerts/analisis/analisis.types.ts
git commit -m "feat(analisis): tipos de respuesta del panel de análisis

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Agregados puros (kpis, series, sensores, correlaciones, cruce paradas)

**Files:**
- Create: `backend/src/modules/alerts/analisis/aggregate.ts`, `aggregate.spec.ts`

- [ ] **Step 1: Test**

`aggregate.spec.ts`:
```typescript
import { computeKpis, sensoresStats, correlaciones, cruzarParadas } from './aggregate';
import type { AlertaRow, ParadaRow } from './analisis.types';

const mk = (id: string, sev: string, area: string, key: string, det: string, res: string | null): AlertaRow => ({
  id, severity: sev, area, source: `threshold::${area}::${key}`, title: key, detected_at: det, resolved_at: res,
});

describe('aggregate', () => {
  const alerts: AlertaRow[] = [
    mk('1', 'warn', 'energia', 'presion', '2026-05-29T13:00:00-03:00', '2026-05-29T13:10:00-03:00'),
    mk('2', 'critical', 'energia', 'temp', '2026-05-29T13:05:00-03:00', '2026-05-29T13:40:00-03:00'),
    mk('3', 'warn', 'energia', 'presion', '2026-05-29T15:00:00-03:00', null),
  ];

  it('kpis: totales, severidad, duración', () => {
    const k = computeKpis(alerts);
    expect(k.total).toBe(3);
    expect(k.por_severidad.warn).toBe(2);
    expect(k.por_severidad.critical).toBe(1);
    expect(k.duracion_media_min).toBeGreaterThan(0); // promedia las 2 resueltas (10 y 35) = 22.5
    expect(k.duracion_media_min).toBe(22.5);
  });

  it('sensores: agrupa por area::key con conteo', () => {
    const s = sensoresStats(alerts);
    const presion = s.find((x) => x.key === 'presion')!;
    expect(presion.n).toBe(2);
  });

  it('correlaciones: pares dentro de ventana', () => {
    // id1 (13:00) y id2 (13:05) están a 5min → correlacionados con ventana 15
    const c = correlaciones(alerts, 15);
    expect(c.length).toBeGreaterThanOrEqual(1);
    expect(c[0].juntas).toBeGreaterThanOrEqual(1);
  });

  it('cruzarParadas: asocia alertas en [inicio-30, fin+10]', () => {
    const paradas: ParadaRow[] = [{
      inicio: '2026-05-29T13:20:00-03:00', fin: '2026-05-29T13:50:00-03:00', minutos: 30,
      motivo: 'x', maquina: 'cald', origen: 'Calderas', alertas_relacionadas: [],
    }];
    const out = cruzarParadas(alerts, paradas, 30, 10);
    // id2 (13:05) está dentro de [12:50, 14:00] → relacionada
    expect(out[0].alertas_relacionadas.length).toBeGreaterThanOrEqual(1);
    expect(out[0].alertas_relacionadas[0].offset_min).toBeDefined();
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `cd backend && npx jest aggregate --silent; echo $?` → FAIL.

- [ ] **Step 3: Implementar**

`aggregate.ts`:
```typescript
import { normalizeSeverity } from '../severity';
import type { AlertaRow, ParadaRow, Kpis, SensorStat, Correlacion } from './analisis.types';

const min = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000;

export function computeKpis(alerts: AlertaRow[]): Kpis {
  const por_severidad = { info: 0, warn: 0, critical: 0 };
  const por_area: Record<string, number> = {};
  const durs: number[] = [];
  for (const a of alerts) {
    por_severidad[normalizeSeverity(a.severity)]++;
    por_area[a.area] = (por_area[a.area] ?? 0) + 1;
    if (a.resolved_at) durs.push(min(a.detected_at, a.resolved_at));
  }
  const sorted = [...alerts].map((a) => new Date(a.detected_at).getTime()).sort((x, y) => x - y);
  let mtbf: number | null = null;
  if (sorted.length > 1) {
    let sum = 0;
    for (let i = 1; i < sorted.length; i++) sum += (sorted[i] - sorted[i - 1]) / 60_000;
    mtbf = Number((sum / (sorted.length - 1)).toFixed(1));
  }
  return {
    total: alerts.length,
    por_severidad,
    por_area,
    duracion_media_min: durs.length ? Number((durs.reduce((a, b) => a + b, 0) / durs.length).toFixed(1)) : 0,
    duracion_max_min: durs.length ? Number(Math.max(...durs).toFixed(1)) : 0,
    mtbf_min: mtbf,
  };
}

export function sensoresStats(alerts: AlertaRow[]): SensorStat[] {
  const groups = new Map<string, AlertaRow[]>();
  for (const a of alerts) {
    const k = `${a.area}::${a.source.split('::').pop() ?? a.title}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  }
  return Array.from(groups.entries()).map(([k, rows]) => {
    const [area, key] = k.split('::');
    const times = rows.map((r) => new Date(r.detected_at).getTime()).sort((x, y) => x - y);
    let mtbf: number | null = null;
    if (times.length > 1) {
      let s = 0; for (let i = 1; i < times.length; i++) s += (times[i] - times[i - 1]) / 60_000;
      mtbf = Number((s / (times.length - 1)).toFixed(1));
    }
    const durs = rows.filter((r) => r.resolved_at).map((r) => min(r.detected_at, r.resolved_at!));
    return {
      area, key, titulo: key.replace(/_/g, ' '),
      n: rows.length, mtbf_min: mtbf,
      duracion_media_min: durs.length ? Number((durs.reduce((a, b) => a + b, 0) / durs.length).toFixed(1)) : 0,
    };
  }).sort((a, b) => b.n - a.n);
}

export function correlaciones(alerts: AlertaRow[], ventanaMin: number): Correlacion[] {
  const pares = new Map<string, number>();
  const key = (a: AlertaRow) => `${a.area}:${a.source.split('::').pop() ?? a.title}`;
  for (let i = 0; i < alerts.length; i++) {
    for (let j = i + 1; j < alerts.length; j++) {
      if (min(alerts[i].detected_at, alerts[j].detected_at) > ventanaMin) continue;
      const ka = key(alerts[i]); const kb = key(alerts[j]);
      if (ka === kb) continue;
      const pk = [ka, kb].sort().join(' ↔ ');
      pares.set(pk, (pares.get(pk) ?? 0) + 1);
    }
  }
  return Array.from(pares.entries())
    .map(([pk, juntas]) => { const [a, b] = pk.split(' ↔ '); return { a, b, juntas, ventana_min: ventanaMin }; })
    .sort((x, y) => y.juntas - x.juntas)
    .slice(0, 10);
}

export function cruzarParadas(alerts: AlertaRow[], paradas: ParadaRow[], antesMin: number, despuesMin: number): ParadaRow[] {
  return paradas.map((p) => {
    const ini = new Date(p.inicio).getTime();
    const fin = p.fin ? new Date(p.fin).getTime() : ini;
    const desde = ini - antesMin * 60_000;
    const hasta = fin + despuesMin * 60_000;
    const rel = alerts
      .filter((a) => { const t = new Date(a.detected_at).getTime(); return t >= desde && t <= hasta; })
      .map((a) => ({
        id: a.id, titulo: a.title, severidad: normalizeSeverity(a.severity),
        detected_at: a.detected_at,
        offset_min: Number(((new Date(a.detected_at).getTime() - ini) / 60_000).toFixed(0)),
      }));
    return { ...p, alertas_relacionadas: rel };
  });
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `cd backend && npx jest aggregate --silent; echo $?` → 0 (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/alerts/analisis/aggregate.ts backend/src/modules/alerts/analisis/aggregate.spec.ts
git commit -m "feat(analisis): agregados puros — kpis, sensores+MTBF, correlaciones, cruce paradas

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Insight IA del período

**Files:**
- Modify: `backend/src/modules/ai/ai.service.ts`

- [ ] **Step 1: Agregar método** (sin test unitario — llama API externa; se valida por tsc + manual, igual que `resumenHistorial`)

En `AiService`:
```typescript
async analizarPeriodoAlertas(payload: {
  periodo: string; etiqueta: string;
  kpis: { total: number; por_severidad: Record<string, number>; por_area: Record<string, number>; duracion_media_min: number; mtbf_min: number | null };
  comparativa: { total_prev: number | null; delta_pct: number | null } | null;
  sensores: Array<{ titulo: string; n: number; mtbf_min: number | null }>;
  correlaciones: Array<{ a: string; b: string; juntas: number }>;
  paradas: Array<{ motivo: string; minutos: number | null; alertas_relacionadas: number }>;
}): Promise<{ resumen: string; patrones: string[]; recomendaciones: string[] } | null> {
  if (!this.client) return null;
  const systemPrompt = `Sos ingeniero senior de un ingenio azucarero (La Corona, Tucumán).
Analizás el período de alertas e INTERPRETÁS (no listás): destacá el cambio vs período
anterior, el sensor más problemático, correlaciones relevantes, y especialmente SI alguna
PARADA de fábrica se relaciona con alertas previas (causa probable). Español rioplatense.
Salida JSON estricto: { resumen (2-4 oraciones), patrones (array 3-5), recomendaciones (array 2-4 priorizadas) }`;
  const userPrompt = `Período: ${payload.etiqueta}
KPIs: ${JSON.stringify(payload.kpis)}
Comparativa vs anterior: ${JSON.stringify(payload.comparativa)}
Top sensores: ${payload.sensores.slice(0, 5).map((s) => `${s.titulo} (${s.n}x, MTBF ${s.mtbf_min ?? '—'}min)`).join('; ')}
Correlaciones: ${payload.correlaciones.slice(0, 5).map((c) => `${c.a}+${c.b} (${c.juntas}x)`).join('; ') || 'ninguna'}
Paradas: ${payload.paradas.map((p) => `${p.motivo} (${p.minutos ?? '?'}min, ${p.alertas_relacionadas} alertas cerca)`).join('; ') || 'ninguna'}`;
  try {
    const res = await this.client.chat.completions.create({
      model: this.model, response_format: { type: 'json_object' }, temperature: 0.4, max_tokens: 600,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    });
    const content = res.choices[0]?.message?.content ?? '';
    if (!content.trim()) return null;
    let c = content.trim();
    if (c.startsWith('```')) c = c.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const s = c.indexOf('{'); const e = c.lastIndexOf('}');
    if (s === -1 || e === -1) return null;
    const p = JSON.parse(c.slice(s, e + 1)) as { resumen?: string; patrones?: string[]; recomendaciones?: string[] };
    return {
      resumen: p.resumen ?? 'Sin análisis disponible.',
      patrones: Array.isArray(p.patrones) ? p.patrones : [],
      recomendaciones: Array.isArray(p.recomendaciones) ? p.recomendaciones : [],
    };
  } catch (err) {
    this.logger.error(`analizarPeriodoAlertas failed: ${(err as Error).message}`);
    return null;
  }
}
```

- [ ] **Step 2: Verificar + commit**

Run: `cd backend && npx tsc --noEmit; echo $?` → 0
```bash
git add backend/src/modules/ai/ai.service.ts
git commit -m "feat(analisis): método IA analizarPeriodoAlertas (interpreta + cruza paradas)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Servicio orquestador + caché

**Files:**
- Create: `backend/src/modules/alerts/alerts-analisis.service.ts`
- Modify: `backend/src/modules/alerts/alerts.module.ts`

- [ ] **Step 1: Implementar servicio**

`alerts-analisis.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';
import { rangoPeriodo, Periodo } from './analisis/periodo';
import { computeKpis, sensoresStats, correlaciones, cruzarParadas } from './analisis/aggregate';
import type { AlertaRow, ParadaRow, AnalisisResponse, Insight } from './analisis/analisis.types';

const VENTANA_CORR_MIN = 15;
const PARADA_ANTES_MIN = 30;
const PARADA_DESPUES_MIN = 10;
const INSIGHT_TTL_MS = 60 * 60_000;

@Injectable()
export class AlertsAnalisisService {
  private readonly logger = new Logger(AlertsAnalisisService.name);
  private insightCache = new Map<string, { data: Insight; ts: number }>();

  constructor(private readonly supabase: SupabaseService, private readonly ai: AiService) {}

  async analisis(periodo: Periodo, refresh = false): Promise<AnalisisResponse> {
    const rango = rangoPeriodo(periodo);
    const alertsSchema = this.supabase.schema('alerts');

    const fetchAlerts = async (desde: Date, hasta: Date): Promise<AlertaRow[]> => {
      const { data, error } = await alertsSchema.from('active')
        .select('id, severity, area, source, title, detected_at, resolved_at')
        .gte('detected_at', desde.toISOString())
        .lt('detected_at', hasta.toISOString());
      if (error) { this.logger.warn(`analisis alerts fail: ${error.message}`); return []; }
      return (data ?? []) as AlertaRow[];
    };

    const alerts = await fetchAlerts(rango.desde, rango.hasta);

    // Comparativa
    let comparativa: AnalisisResponse['comparativa'] = null;
    if (rango.prevDesde && rango.prevHasta) {
      const prev = await fetchAlerts(rango.prevDesde, rango.prevHasta);
      const kp = computeKpis(prev);
      const delta = kp.total > 0 ? Number((((alerts.length - kp.total) / kp.total) * 100).toFixed(1)) : null;
      comparativa = { total_prev: kp.total, delta_pct: delta, por_severidad_prev: kp.por_severidad };
    }

    // Paradas (RPC)
    let paradas: ParadaRow[] = [];
    try {
      const { data, error } = await this.supabase.sb.rpc('fn_paradas_turno', {
        ts_inicio: rango.desde.toISOString(), ts_fin: rango.hasta.toISOString(),
      });
      if (!error && Array.isArray(data)) {
        paradas = (data as Array<{ fecha_industrial: string; desde_hora: string; hasta_hora: string; motivo: string; maquina: string | null; origen_descripcion: string | null }>)
          .map((p) => {
            const dia = p.fecha_industrial.slice(0, 10);
            const mkTs = (hhmm: string) => {
              const hh = parseInt(hhmm.slice(0, 2), 10);
              const d = new Date(`${dia}T${hhmm}-03:00`);
              if (hh < 8) d.setDate(d.getDate() + 1); // convención día industrial
              return d.toISOString();
            };
            const inicio = mkTs(p.desde_hora);
            const fin = p.hasta_hora ? mkTs(p.hasta_hora) : null;
            const minutos = fin ? Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60_000) : null;
            return { inicio, fin, minutos, motivo: p.motivo, maquina: p.maquina, origen: p.origen_descripcion, alertas_relacionadas: [] };
          });
      }
    } catch (err) {
      this.logger.warn(`analisis paradas fail: ${(err as Error).message}`);
    }
    paradas = cruzarParadas(alerts, paradas, PARADA_ANTES_MIN, PARADA_DESPUES_MIN);

    // Series
    const turnoDe = (iso: string): 'Mañana' | 'Tarde' | 'Noche' => {
      const h = new Date(iso).getHours();
      return h >= 5 && h <= 12 ? 'Mañana' : h >= 13 && h <= 20 ? 'Tarde' : 'Noche';
    };
    const porTurnoMap = new Map<string, number>([['Mañana', 0], ['Tarde', 0], ['Noche', 0]]);
    const porDiaMap = new Map<string, { n: number; durs: number[] }>();
    const heatMap = new Map<string, number>();
    for (const a of alerts) {
      porTurnoMap.set(turnoDe(a.detected_at), (porTurnoMap.get(turnoDe(a.detected_at)) ?? 0) + 1);
      const d = new Date(a.detected_at);
      const diaKey = a.detected_at.slice(0, 10);
      if (!porDiaMap.has(diaKey)) porDiaMap.set(diaKey, { n: 0, durs: [] });
      const pd = porDiaMap.get(diaKey)!; pd.n++;
      if (a.resolved_at) pd.durs.push((new Date(a.resolved_at).getTime() - d.getTime()) / 60_000);
      const hk = `${d.getDay()}:${d.getHours()}`;
      heatMap.set(hk, (heatMap.get(hk) ?? 0) + 1);
    }
    const series = {
      por_turno: Array.from(porTurnoMap.entries()).map(([turno, n]) => ({ turno: turno as 'Mañana' | 'Tarde' | 'Noche', n })),
      por_dia: Array.from(porDiaMap.entries()).map(([dia, v]) => ({ dia, n: v.n, duracion_media_min: v.durs.length ? Number((v.durs.reduce((a, b) => a + b, 0) / v.durs.length).toFixed(1)) : 0 })).sort((a, b) => a.dia.localeCompare(b.dia)),
      heatmap: Array.from(heatMap.entries()).map(([k, n]) => { const [dow, hora] = k.split(':').map(Number); return { dow, hora, n }; }),
    };

    const kpis = computeKpis(alerts);
    const sensores = sensoresStats(alerts);
    const corr = correlaciones(alerts, VENTANA_CORR_MIN);

    // Insight IA (caché por período)
    let insight: Insight | null = null;
    const cacheKey = periodo;
    const cached = this.insightCache.get(cacheKey);
    if (!refresh && cached && Date.now() - cached.ts < INSIGHT_TTL_MS) {
      insight = { ...cached.data, cached: true };
    } else if (this.ai.isAvailable()) {
      const r = await this.ai.analizarPeriodoAlertas({
        periodo, etiqueta: rango.etiqueta, kpis, comparativa: comparativa ? { total_prev: comparativa.total_prev, delta_pct: comparativa.delta_pct } : null,
        sensores, correlaciones: corr,
        paradas: paradas.map((p) => ({ motivo: p.motivo, minutos: p.minutos, alertas_relacionadas: p.alertas_relacionadas.length })),
      });
      if (r) {
        insight = { ...r, cached: false, generado_at: new Date().toISOString() };
        this.insightCache.set(cacheKey, { data: insight, ts: Date.now() });
      }
    }

    return {
      periodo,
      rango: { desde: rango.desde.toISOString(), hasta: rango.hasta.toISOString(), etiqueta: rango.etiqueta },
      kpis, comparativa, series, sensores, correlaciones: corr, paradas, insight,
    };
  }
}
```

NOTA: verificar que `this.supabase.sb.rpc(...)` es el accessor correcto (mirar cómo `reportes-data.service.ts` llama `fn_paradas_turno`: usa `this.supabase.sb.rpc('fn_paradas_turno', {...})`). Ajustar si el accessor difiere.

- [ ] **Step 2: Registrar en módulo**

En `alerts.module.ts`: importar `AlertsAnalisisService`, agregarlo a `providers`.

- [ ] **Step 3: Verificar**

Run: `cd backend && npx tsc --noEmit; echo $?` → 0

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/alerts/alerts-analisis.service.ts backend/src/modules/alerts/alerts.module.ts
git commit -m "feat(analisis): servicio orquestador — agregados + paradas RPC + insight IA cacheado

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Endpoint

**Files:**
- Modify: `backend/src/modules/alerts/alerts.controller.ts`

- [ ] **Step 1: Agregar ruta**

En el constructor inyectar `private readonly analisisSvc: AlertsAnalisisService` (import desde `./alerts-analisis.service`). Agregar:
```typescript
/** GET /api/alerts/analisis?periodo=turno|dia|zafra&refresh=1 */
@Get('analisis')
analisis(@Query('periodo') periodo?: string, @Query('refresh') refresh?: string) {
  const p = (['turno', 'dia', 'zafra'] as const).includes(periodo as never) ? periodo as 'turno' | 'dia' | 'zafra' : 'dia';
  return this.analisisSvc.analisis(p, refresh === '1');
}
```
Colocar ANTES de `@Get(':id/analisis-causa')` para evitar colisión de rutas.

- [ ] **Step 2: Verificar**

Run: `cd backend && npx tsc --noEmit; echo $?` → 0
Manual (tras deploy): `GET /api/alerts/analisis?periodo=dia` devuelve JSON con kpis/series/sensores/correlaciones/paradas/insight.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/alerts/alerts.controller.ts
git commit -m "feat(analisis): endpoint GET /alerts/analisis

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## FASE B — Frontend

### Task 7: Tipos + hook de datos

**Files:**
- Create: `frontend/src/app/alertas/analisis/_types.ts`, `_hooks/useAnalisis.ts`

- [ ] **Step 1: Tipos espejo**

`_types.ts`: copiar las interfaces de `AnalisisResponse` (y sub-tipos) del backend `analisis.types.ts` (mismas props). Exportar `Periodo = 'turno'|'dia'|'zafra'`.

- [ ] **Step 2: Hook**

`_hooks/useAnalisis.ts`:
```typescript
'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AnalisisResponse, Periodo } from '../_types';

async function fetchAnalisis(periodo: Periodo, refresh = false): Promise<AnalisisResponse | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/alerts/analisis?periodo=${periodo}${refresh ? '&refresh=1' : ''}`);
  if (!res.ok) return null;
  return res.json();
}

export function useAnalisis() {
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const q = useQuery({
    queryKey: ['alerts', 'analisis', periodo],
    queryFn: () => fetchAnalisis(periodo),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const regenerar = () => fetchAnalisis(periodo, true).then(() => q.refetch());
  return { periodo, setPeriodo, data: q.data, loading: q.isLoading, regenerar };
}
```

- [ ] **Step 3: Verificar + commit**

Run: `cd frontend && rm -f tsconfig.tsbuildinfo && npx tsc --noEmit; echo $?` → 0
```bash
git add frontend/src/app/alertas/analisis/_types.ts frontend/src/app/alertas/analisis/_hooks/useAnalisis.ts
git commit -m "feat(analisis): tipos y hook de datos del panel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Componentes de presentación (premium)

**Files:**
- Create: `frontend/src/app/alertas/analisis/_components/{PeriodSelector,KpiRow,InsightCard,ComparativaTurnos,TendenciaDiaria,TopSensores,Heatmap,Correlaciones,AlertasParadas}.tsx`

Cada uno es un componente puro de presentación que recibe su slice de `AnalisisResponse` por props. Reusar `PremiumPanel`, la paleta `C` y `GlassTooltip` (extraer `GlassTooltip` y `C` de `HistorialCharts.tsx` a un archivo compartido `analisis/_components/chart-kit.tsx` antes de borrar HistorialCharts).

- [ ] **Step 1: chart-kit compartido**

Crear `analisis/_components/chart-kit.tsx` con `export const C = {...}` (paleta de `HistorialCharts`) y `export function GlassTooltip(...)` (copiado de `HistorialCharts`). Iteraciones sobre Map/objetos: usar `Array.from`/`Object.entries`.

- [ ] **Step 2: PeriodSelector**

Segmented control. Props: `{ value: Periodo; onChange: (p: Periodo) => void }`. 3 botones Turno/Día/Zafra, el activo resaltado (estilo pill, paleta primary). Sin lógica de datos.

- [ ] **Step 3: KpiRow**

Props: `{ kpis; comparativa }`. Render 4-5 tarjetas: Total (con `delta_pct` ↑↓ color), Críticas, Advertencias, Duración media, MTBF. Cada tarjeta: valor grande tabular, label uppercase, chip de tendencia si hay comparativa (verde baja / rojo sube para alertas). Usar `PremiumPanel` o cards glass.

- [ ] **Step 4: InsightCard**

Props: `{ insight; loading; onRegenerar }`. Card glass destacada (borde primary glow). Muestra `resumen` (párrafo), `patrones` como chips, `recomendaciones` como lista priorizada con íconos. Header con ícono cerebro, sello "en caché" si `insight.cached`, botón "Regenerar". Si `insight===null`: estado "IA no disponible". Si `loading`: skeleton.

- [ ] **Step 5: ComparativaTurnos**

Props: `{ series.por_turno; comparativa }`. BarChart (Recharts) por turno (Mañana/Tarde/Noche) con conteo. `ResponsiveContainer`, `GlassTooltip`. Empty state si sin datos.

- [ ] **Step 6: TendenciaDiaria**

Props: `{ series.por_dia }`. AreaChart de `n` por día + línea de `duracion_media_min`. Si solo hay 1 día (período turno/día), mostrar barras simples o un mensaje "vista diaria disponible en Zafra".

- [ ] **Step 7: TopSensores**

Props: `{ sensores }`. BarChart horizontal top ~8 por `n`, con MTBF y duración en tooltip/etiqueta. Colores por severidad dominante si disponible (si no, paleta).

- [ ] **Step 8: Heatmap**

Props: `{ series.heatmap }`. Grilla CSS 7 (días) × 24 (horas), intensidad por `n` (rgba alpha escalado al max). Tooltip nativo `title`. NO usar librería.

- [ ] **Step 9: Correlaciones**

Props: `{ correlaciones }`. Lista de pares `a ↔ b` con badge de `juntas` veces y la ventana. Empty state "sin correlaciones en el período".

- [ ] **Step 10: AlertasParadas**

Props: `{ paradas }`. Por cada parada: card con motivo, máquina, duración (min), y debajo las `alertas_relacionadas` (chips con severidad + `offset_min` relativo, ej "−12 min" antes / "+5 min" después). Resaltar (borde ámbar/rojo) las paradas con alertas relacionadas. Empty state "sin paradas en el período".

- [ ] **Step 11: Verificar + commit**

Run: `cd frontend && rm -f tsconfig.tsbuildinfo && npx tsc --noEmit && npx next lint; echo $?` → 0
```bash
git add frontend/src/app/alertas/analisis/_components
git commit -m "feat(analisis): componentes premium del panel (KPIs, insight, gráficos, paradas)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: HistorialTabla (migrar el historial)

**Files:**
- Create: `frontend/src/app/alertas/analisis/_components/HistorialTabla.tsx`
- Create: `frontend/src/app/alertas/analisis/_hooks/useHistorial.ts`

- [ ] **Step 1: Hook de historial paginado**

`useHistorial.ts`: copiar la lógica de paginación server-side de `useAlertasConfig` (PAGE_SIZE=25, historyPage, fetchHistory(limit, offset) a `/alerts/history`, historyPageCount). Aislado del config.

- [ ] **Step 2: Tabla**

`HistorialTabla.tsx`: portar `HistorialPanel.tsx` (tabla columnas Sev/Área/Alerta/Valor/Inicio/Normalización/Duración + filtros turno/área/severidad + paginador). Recibe del hook. Mismo estilo.

- [ ] **Step 3: Verificar + commit**

Run: `cd frontend && rm -f tsconfig.tsbuildinfo && npx tsc --noEmit; echo $?` → 0
```bash
git add frontend/src/app/alertas/analisis/_components/HistorialTabla.tsx frontend/src/app/alertas/analisis/_hooks/useHistorial.ts
git commit -m "feat(analisis): historial paginado migrado al panel de análisis

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Página `/alertas/analisis`

**Files:**
- Create: `frontend/src/app/alertas/analisis/page.tsx`

- [ ] **Step 1: Orquestador**

`page.tsx` ('use client'): TopBar (`plant="Sala de Monitoreo · Análisis de Alertas"`), header con breadcrumbs "← Configuración" (`/alertas`) y "← Dashboard" (`/`), `PeriodSelector` (de `useAnalisis`), y el layout vertical:
`KpiRow → InsightCard → (ComparativaTurnos + TendenciaDiaria en grid 2-col lg) → TopSensores → Heatmap → Correlaciones → AlertasParadas → HistorialTabla`.
Loading: skeletons por sección. Cada componente recibe su slice de `data`.

- [ ] **Step 2: Verificar**

Run: `cd frontend && rm -f tsconfig.tsbuildinfo && npx tsc --noEmit && npx next lint && npm run build; echo $?` → 0
Manual: navegar a `/alertas/analisis` → carga con insight IA visible, selector cambia período.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/alertas/analisis/page.tsx
git commit -m "feat(analisis): página /alertas/analisis (panel premium completo)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Limpiar `/alertas` + CTA

**Files:**
- Modify: `frontend/src/app/alertas/page.tsx`, `frontend/src/app/alertas/_hooks/useAlertasConfig.ts`
- Delete: `frontend/src/app/alertas/_components/HistorialCharts.tsx`, `HistorialPanel.tsx`

- [ ] **Step 1: Quitar de page.tsx**

En `frontend/src/app/alertas/page.tsx`: eliminar imports y render de `<HistorialCharts />` y `<HistorialPanel />`. Agregar en el header (junto a los botones) un Link CTA:
```tsx
<Link href="/alertas/analisis" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-md border-2 border-primary-light/35 text-primary-light hover:bg-bg-hover transition-all">
  Ver análisis e historial →
</Link>
```

- [ ] **Step 2: Limpiar el hook**

En `useAlertasConfig.ts`: eliminar el estado y funciones de historial (history, historyTotal, historyLoading, historyPage, reloadHistory, fetchHistory, pageRef, historyPageCount) ya migrados a `useHistorial`. Quitar del return. Ajustar `page.tsx` para no desestructurar lo eliminado.

- [ ] **Step 3: Borrar componentes muertos**

```bash
git rm frontend/src/app/alertas/_components/HistorialCharts.tsx frontend/src/app/alertas/_components/HistorialPanel.tsx
```
(Confirmar que `GlassTooltip`/`C` ya fueron movidos a `chart-kit.tsx` en Task 8.)

- [ ] **Step 4: Verificar**

Run: `cd frontend && rm -f tsconfig.tsbuildinfo && npx tsc --noEmit && npx next lint && npm run build; echo $?` → 0
Manual: `/alertas` queda solo config con CTA; sin restos rotos.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/app/alertas
git commit -m "refactor(alertas): /alertas solo config + CTA al análisis; borrar historial viejo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (cobertura del spec)

| Spec § | Task |
|---|---|
| §1 Routing (config vs análisis + CTA) | Task 10, 11 |
| §2 Período Turno/Día/Zafra + comparativa | Task 1, 5, Task 8 (PeriodSelector) |
| §3 Endpoint único + agregados + paradas + insight + caché | Task 1-6 |
| §3 MTBF, correlaciones, cruce paradas | Task 3 |
| §3 Insight IA interpretativo + cruce paradas | Task 4, 5 |
| §4 KPIs+tendencia | Task 8 (KpiRow) |
| §4 Insight auto-cargado | Task 8 (InsightCard) + Task 7 (hook auto-fetch) |
| §4 Gráficos premium | Task 8 |
| §4 Alertas↔Paradas | Task 8 (AlertasParadas) |
| §4 Historial migrado | Task 9 |
| §4 Limpieza /alertas | Task 11 |

Sin placeholders (código real en cada step). Tipos consistentes: `AnalisisResponse`/sub-tipos definidos en Task 2, espejados en Task 7, consumidos en Task 8-10. Funciones `computeKpis/sensoresStats/correlaciones/cruzarParadas` definidas en Task 3 y usadas en Task 5. `rangoPeriodo`/`Periodo` en Task 1 usados en Task 5/6. Verificación frontend siempre con `rm -f tsconfig.tsbuildinfo` (lección del deploy: caché ocultaba errores).

Punto a validar en ejecución (no bloqueante): accessor exacto del RPC (`this.supabase.sb.rpc` vs otro) — Task 5 Step 1 nota; replicar el de `reportes-data.service.ts`.
