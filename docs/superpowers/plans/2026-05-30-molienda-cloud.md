# Molienda Cloud — Implementation Plan (maqueta)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Maquetar la plataforma `/moliendacloud` (movimientos/logística de molienda) con la estética del dashboard, reutilizando vistas/endpoints existentes SOLO LECTURA, sin tocar el dashboard principal ni sus vistas; datos reales donde hay vista, placeholders claros donde el mapeo está pendiente.

**Architecture:** Ruta Next App Router nueva (`app/moliendacloud`) en la misma app. Backend: un módulo `molienda-cloud` read-only que consulta vistas existentes (`production.v_canchon_resumen`, `v_camiones_canchon`, `v_descarga_balanza_hora`, `v_molienda_bloques`) y `legacy.movimientos`/`lab_general`. No se crean ni modifican vistas usadas por el dashboard. Componente de molienda+producción en tiempo real se REUSA importándolo (sin copiar/editar).

**Tech Stack:** NestJS (read-only endpoints), Supabase JS, Next.js 14 App Router, React Query, Recharts, paleta INDUSTRIAL_DARK + tokens de tema (`var(--*)`).

**Reglas duras (integridad):**
- NO modificar `frontend/src/app/page.tsx`, sus componentes, ni las vistas que consume. Reusar read-only.
- Si falta una vista, crear con nombre NUEVO `v_mc_*` (migración la corre el owner) — no tocar existentes.
- Verificación frontend SIEMPRE: `cd frontend && rm -f tsconfig.tsbuildinfo && npx tsc --noEmit && npx eslint "src/app/moliendacloud/**/*.{ts,tsx}"` (lección: `next lint`/`npm run build` local no replican el eslint de Docker). Target ES2017; nunca `for...of`/spread sobre Map/Set → `Array.from`.
- No inventar datos: donde el mapeo de negocio no esté confirmado → empty state "dato pendiente".

**Datos confirmados disponibles:** `production.v_canchon_resumen`, `v_camiones_canchon`, `v_descarga_balanza_hora`, `v_molienda_bloques`, `public.v_molienda_turno_actual`; `legacy.movimientos` (tipo_pesada C=caña, A/L otros; neto_cana, trash, trash_real, peso_neto, salida_at, fecha_industrial); `legacy.lab_general` (brix_*, pol_*, pureza, kilos, hora_lectura, proceso_codigo).

**Pendiente de mapeo (placeholder en maqueta, confirmar con usuario):** categorías Caña/Alcohol/Cachaza/Varios desde movimientos; Brix/Pol/Pureza/Rto ponderado de caña; métricas de azúcar; definición de "tiempo de espera".

---

## File Structure

**Backend — crear (módulo read-only):**
- `backend/src/modules/molienda-cloud/molienda-cloud.module.ts`
- `backend/src/modules/molienda-cloud/molienda-cloud.service.ts` — queries a vistas existentes.
- `backend/src/modules/molienda-cloud/molienda-cloud.controller.ts` — endpoints `/api/molienda-cloud/*`.
- Modificar `backend/src/app.module.ts` — registrar el módulo.

**Frontend — crear:**
- `frontend/src/app/moliendacloud/page.tsx`
- `frontend/src/app/moliendacloud/_types.ts`
- `frontend/src/app/moliendacloud/_hooks/useMoliendaCloud.ts`
- `frontend/src/app/moliendacloud/_components/MovimientosHero.tsx`
- `frontend/src/app/moliendacloud/_components/CanchonHoraChart.tsx`
- `frontend/src/app/moliendacloud/_components/ComparativaCana.tsx`
- `frontend/src/app/moliendacloud/_components/PromediosMolienda.tsx`
- `frontend/src/app/moliendacloud/_components/AnalisisAzucarModal.tsx`
- `frontend/src/app/moliendacloud/_components/ResumenFabricaModal.tsx`

**Frontend — reusar (NO modificar):** `@/components/layout/TopBar`, `@/components/industrial/MoliendaProduccionHora`, `@/components/industrial/PremiumPanel`.

---

## FASE A — Backend read-only

### Task 1: Módulo + endpoints de datos disponibles

**Files:** crear los 3 archivos del módulo + registrar en `app.module.ts`.

- [ ] **Step 1: Service** `molienda-cloud.service.ts`

Patrón: leer cómo otros services usan `this.supabase.schema('production').from('...')` y `this.supabase.sb.rpc(...)`. Implementar métodos read-only:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MoliendaCloudService {
  private readonly logger = new Logger(MoliendaCloudService.name);
  constructor(private readonly supabase: SupabaseService) {}

  /** Resumen de canchón (vista existente, read-only). */
  async canchon() {
    const { data, error } = await this.supabase.schema('production').from('v_canchon_resumen').select('*');
    if (error) { this.logger.warn(`canchon: ${error.message}`); return { stale: true, data: null }; }
    return { data: (data ?? [])[0] ?? null };
  }

  /** Llegada de camiones por hora (vista existente). */
  async balanzaHora() {
    const { data, error } = await this.supabase.schema('production').from('v_descarga_balanza_hora').select('*');
    if (error) { this.logger.warn(`balanzaHora: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  /** Movimientos del día por tipo_pesada (agg). Mapeo a categorías queda en el front por ahora. */
  async movimientosTipo() {
    const { data, error } = await this.supabase.schema('legacy').from('movimientos')
      .select('tipo_pesada, peso_neto, neto_cana, salida_at')
      .gte('salida_at', new Date(Date.now() - 24 * 3600_000).toISOString());
    if (error) { this.logger.warn(`movimientosTipo: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  /** Molienda por bloque (turno/día/zafra) — vista existente, para promedios y comparativo parcial. */
  async moliendaBloques() {
    const { data, error } = await this.supabase.schema('production').from('v_molienda_bloques').select('*');
    if (error) { this.logger.warn(`moliendaBloques: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  /** Lab por proceso + rango horario opcional (para modales azúcar/jugos). */
  async lab(procesos: string[], desde?: string, hasta?: string) {
    let q = this.supabase.schema('legacy').from('lab_general')
      .select('proceso_codigo, fecha_industrial, hora_lectura, kilos, brix_manual, brix_automatico, pol_manual, pol_automatico, pureza')
      .in('proceso_codigo', procesos)
      .order('hora_lectura', { ascending: true });
    if (desde) q = q.gte('hora_lectura', desde);
    if (hasta) q = q.lte('hora_lectura', hasta);
    const { data, error } = await q.limit(2000);
    if (error) { this.logger.warn(`lab: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }
}
```
NOTA: verificar el accessor real (`this.supabase.schema(...).from(...)`) mirando un service existente (p.ej. `guardia.service.ts`). Ajustar si difiere.

- [ ] **Step 2: Controller** `molienda-cloud.controller.ts`
```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { MoliendaCloudService } from './molienda-cloud.service';

@Controller('molienda-cloud')
export class MoliendaCloudController {
  constructor(private readonly svc: MoliendaCloudService) {}

  @Get('canchon') canchon() { return this.svc.canchon(); }
  @Get('balanza-hora') balanzaHora() { return this.svc.balanzaHora(); }
  @Get('movimientos-tipo') movimientosTipo() { return this.svc.movimientosTipo(); }
  @Get('molienda-bloques') moliendaBloques() { return this.svc.moliendaBloques(); }

  /** GET /api/molienda-cloud/lab?procesos=Jugo Mixto,Clarificado&desde=06:00&hasta=14:00 */
  @Get('lab')
  lab(@Query('procesos') procesos?: string, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    const list = (procesos ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return this.svc.lab(list, desde, hasta);
  }
}
```

- [ ] **Step 3: Module** `molienda-cloud.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { MoliendaCloudController } from './molienda-cloud.controller';
import { MoliendaCloudService } from './molienda-cloud.service';

@Module({ controllers: [MoliendaCloudController], providers: [MoliendaCloudService] })
export class MoliendaCloudModule {}
```
Registrar `MoliendaCloudModule` en `app.module.ts` imports (SupabaseModule es @Global, no requiere import extra).

- [ ] **Step 4: Verificar** `cd backend && npx tsc --noEmit; echo $?` → 0. Manual: `GET /api/molienda-cloud/canchon` y `/balanza-hora` devuelven JSON.

- [ ] **Step 5: Commit**
```bash
git add backend/src/modules/molienda-cloud backend/src/app.module.ts
git commit -m "feat(molienda-cloud): módulo backend read-only sobre vistas existentes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## FASE B — Frontend maqueta

### Task 2: Tipos + hook + scaffold de página

**Files:** `_types.ts`, `_hooks/useMoliendaCloud.ts`, `page.tsx`.

- [ ] **Step 1: `_types.ts`** — interfaces de las respuestas (CanchonResumen, BalanzaHora[], MovimientoRow[], MoliendaBloque[], LabRow[]). Definir según el `select` del service (campos exactos a confirmar al correr; usar `Record<string, unknown>`-tolerante donde la forma de la vista no esté 100% confirmada, p.ej. `CanchonResumen = Record<string, number | string | null>`).

- [ ] **Step 2: `_hooks/useMoliendaCloud.ts`** — React Query a los endpoints:
```typescript
'use client';
import { useQuery } from '@tanstack/react-query';
const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
const get = (p: string) => fetch(`${apiUrl}/molienda-cloud/${p}`).then((r) => (r.ok ? r.json() : null));
export function useCanchon() { return useQuery({ queryKey: ['mc','canchon'], queryFn: () => get('canchon'), refetchInterval: 30_000 }); }
export function useBalanzaHora() { return useQuery({ queryKey: ['mc','balanza-hora'], queryFn: () => get('balanza-hora'), refetchInterval: 60_000 }); }
export function useMovimientosTipo() { return useQuery({ queryKey: ['mc','mov-tipo'], queryFn: () => get('movimientos-tipo'), refetchInterval: 30_000 }); }
export function useMoliendaBloques() { return useQuery({ queryKey: ['mc','mol-bloques'], queryFn: () => get('molienda-bloques'), refetchInterval: 60_000 }); }
```

- [ ] **Step 3: `page.tsx`** — orquestador scaffold:
```tsx
'use client';
import Link from 'next/link';
import { IconLayoutDashboard } from '@tabler/icons-react';
import { TopBar } from '@/components/layout/TopBar';
import { MoliendaProduccionHora } from '@/components/industrial/MoliendaProduccionHora';
import { MovimientosHero } from './_components/MovimientosHero';
import { CanchonHoraChart } from './_components/CanchonHoraChart';
import { ComparativaCana } from './_components/ComparativaCana';
import { PromediosMolienda } from './_components/PromediosMolienda';
import { AnalisisAzucarModal } from './_components/AnalisisAzucarModal';
import { ResumenFabricaModal } from './_components/ResumenFabricaModal';

export default function MoliendaCloudPage() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,229,160,0.05), transparent 70%)' }} />
      <div className="relative z-10 flex flex-col flex-1">
        <TopBar plant="Molienda Cloud" />
        <div className="px-3 sm:px-4 pt-2">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary-light px-3 py-1.5 rounded-md border border-border hover:bg-bg-hover transition-colors">
            <IconLayoutDashboard size={16} /> Dashboard de Monitoreo
          </Link>
        </div>
        <MovimientosHero />
        <MoliendaProduccionHora />
        <main className="px-3 sm:px-4 py-2 space-y-3 sm:space-y-4 max-w-[1600px] mx-auto w-full">
          <CanchonHoraChart />
          <ComparativaCana />
          <PromediosMolienda />
          <div className="flex flex-wrap gap-2">
            <AnalisisAzucarModal />
            <ResumenFabricaModal />
          </div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar** `cd frontend && rm -f tsconfig.tsbuildinfo && npx tsc --noEmit && npx eslint "src/app/moliendacloud/**/*.{ts,tsx}"; echo $?` → 0 (los componentes aún no existen → este step va DESPUÉS de crearlos en Tasks 3-8; por ahora crear `page.tsx` puede romper imports — alternativa: crear page.tsx al final, o stubs vacíos primero). **DECISIÓN: crear stubs mínimos de cada componente en este task** (cada uno `export function X() { return <PremiumPanel.../> placeholder }`) para que compile, y completarlos en Tasks 3-8.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/app/moliendacloud
git commit -m "feat(molienda-cloud): scaffold ruta /moliendacloud + hook + stubs de secciones

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: MovimientosHero (KPI hero re-enfocado + selector pastilla)
**Files:** `_components/MovimientosHero.tsx`
- [ ] **Step 1:** Replicar la estética del hero del dashboard (tiles tipo `PremiumTile`/glass, tabular-nums). Selector pastilla con 4 opciones: Caña · Alcohol · Cachaza · Varios. Mapeo desde `movimientos-tipo` (`tipo_pesada`): C→Caña; **A/L/otros → marcar como "pendiente de mapeo"** (mostrar conteo crudo por tipo_pesada con etiqueta provisoria + nota "categorías a confirmar"). Tiles: nº/tn del tipo elegido, **tiempo última pasada** (`max(salida_at)` → "hace X min"), camiones en canchón (de `useCanchon`). **Tiempo de espera**: placeholder "definición pendiente" (no inventar). Usar tokens de tema.
- [ ] **Step 2:** Verificar tsc+eslint (comando de arriba) → 0.
- [ ] **Step 3:** Commit `feat(molienda-cloud): MovimientosHero con selector por tipo (mapeo provisorio)`.

### Task 4: CanchonHoraChart (hora×hora llegada camiones)
**Files:** `_components/CanchonHoraChart.tsx`
- [ ] **Step 1:** `PremiumPanel` + Recharts BarChart de `v_descarga_balanza_hora` (eje hora, valor camiones/tn). Glass tooltip + paleta + empty state. Confirmar nombres de columnas de la vista al implementar (consultar la vista; si difieren, mapear).
- [ ] **Step 2:** Verificar tsc+eslint → 0. **Step 3:** Commit.

### Task 5: ComparativaCana (día actual / anterior / zafra)
**Files:** `_components/ComparativaCana.tsx`
- [ ] **Step 1:** Tabla/tarjetas con columnas Día actual · Día anterior · Zafra y filas: Molienda, Trash Kg, Caña Neta (estos 3 derivables de `movimientos`/`v_molienda_bloques`), y Trash ponderado, Rto ponderado, Brix/Pol/Pureza ponderado → **placeholder "dato pendiente"** (fuente/fórmula a confirmar). Estructura completa visible, celdas pendientes claramente marcadas.
- [ ] **Step 2:** Verificar → 0. **Step 3:** Commit.

### Task 6: PromediosMolienda (en curso + diario)
**Files:** `_components/PromediosMolienda.tsx`
- [ ] **Step 1:** Dos tarjetas grandes: promedio molienda **en curso** y **diario**, derivadas de `v_molienda_bloques` (bloque turno_actual / dia_corriente) vía `useMoliendaBloques`. tabular-nums, tokens de tema.
- [ ] **Step 2:** Verificar → 0. **Step 3:** Commit.

### Task 7: AnalisisAzucarModal
**Files:** `_components/AnalisisAzucarModal.tsx`
- [ ] **Step 1:** Botón + modal (patrón de los modales existentes, p.ej. `MoliendaEstadoModal`). Fetch `/molienda-cloud/lab?procesos=<azúcar>&desde&hasta` con **selector de horario**. Tabla de análisis + fila de **promedio diario** por métrica (brix/pol/pureza/kilos). Qué `proceso_codigo` = azúcar → **placeholder/configurable** (usar "Azúcar de 3era" como provisorio + nota "procesos a confirmar").
- [ ] **Step 2:** Verificar → 0. **Step 3:** Commit.

### Task 8: ResumenFabricaModal (jugos)
**Files:** `_components/ResumenFabricaModal.tsx`
- [ ] **Step 1:** Botón + modal. Fetch `/molienda-cloud/lab?procesos=Jugo Mixto,Clarificado,Melado,...`. Mostrar promedios de brix/pol/pureza por jugo. Empty state.
- [ ] **Step 2:** Verificar → 0. **Step 3:** Commit.

---

## Self-Review (cobertura del spec)
| Spec § | Task |
|---|---|
| §1 ruta /moliendacloud + botón a dashboard, sin link inverso | Task 2 |
| §2.2 KPI hero movimientos + selector pastilla + tiempos + canchón | Task 3 |
| §2.3 molienda+producción tiempo real (reuso) | Task 2 (import MoliendaProduccionHora) |
| §2.4 hora×hora canchón | Task 4 |
| §2.5 comparativo día/día/zafra | Task 5 |
| §2.6 promedios molienda | Task 6 |
| §2.7 modal análisis azúcar | Task 7 |
| §2.8 modal resumen fábrica jugos | Task 8 |
| §3 datos disponibles vs placeholder | Task 1 (endpoints) + cada componente marca pendientes |
| §4 backend read-only, sin tocar vistas | Task 1 |
| integridad dashboard intacto | ninguna task modifica page.tsx/componentes/vistas del dashboard |

Sin placeholders de plan (los "dato pendiente" en UI son empty-states intencionales de la maqueta, marcados por el spec como mapeo de negocio a confirmar — no son TBDs de implementación). Tipos: endpoints de Task 1 consumidos por hook Task 2 y componentes Tasks 3-8. Verificación frontend siempre con `rm -f tsconfig.tsbuildinfo` + `npx eslint` directo.

## Pendientes para nutrir después (con el usuario)
- Mapeo categorías Caña/Alcohol/Cachaza/Varios (tipo_pesada/destino).
- Fuente/fórmula Brix/Pol/Pureza/Rto ponderado de caña + Trash ponderado.
- Procesos `lab_general` que representan azúcar + métricas de calidad de azúcar.
- Definición de "tiempo de espera".
- Bug aparte: `v_molienda_turno_actual` null cuando el lab no cargó (no bloquea esta maqueta).
