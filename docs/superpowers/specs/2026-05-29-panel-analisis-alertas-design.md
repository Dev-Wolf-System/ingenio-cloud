# Panel de Análisis de Alertas — Diseño

> Estado: APROBADO (diseño) · 2026-05-29
> Alcance: separar configuración de historial/análisis; nueva página `/alertas/analisis`
> premium con KPIs, insight IA automático, comparativas Turno/Día/Zafra, sensores
> reincidentes + MTBF, correlaciones entre alertas, cruce con paradas, e historial paginado.
> Branch base: `feat/alertas-inteligentes` (ya deployado y estable).

---

## 0. Contexto y problema

`/alertas` hoy apila todo en una sola página: Avisos + Umbrales + Gráficos (`HistorialCharts`)
+ Historial (`HistorialPanel`). Problemas reportados:
- **Tedioso**: config de umbrales/avisos mezclada con historial.
- **No analiza**: los gráficos no interpretan nada y el resumen IA está escondido detrás de
  un botón → el operador "no ve análisis".
- Se siente genérico, no premium.

Hay **482 alertas resueltas** en `alerts.active` (datos sobran). Objetivo: un panel de
análisis profesional, automático e interpretativo, separado de la config.

---

## 1. Estructura / routing

- **`/alertas`** queda **solo configuración**: `AvisosConfigPanel` + `ThresholdsPanel`.
  Se le quitan `HistorialCharts` y `HistorialPanel`. Se agrega un CTA en el header:
  "Ver análisis e historial →" que enlaza a `/alertas/analisis`.
- **`/alertas/analisis`** (ruta nueva) = panel premium completo (este spec).
  Header propio con breadcrumb "← Configuración de alertas" y "← Dashboard".

Ambas rutas comparten `usePasswordSession` solo donde se modifican datos (la config sigue
protegida; el análisis es de solo lectura, sin gate).

---

## 2. Período (selector segmentado)

Control segmentado arriba del panel: **Turno · Día · Zafra**. Default = **Día**.

| Período | Ventana | Comparativa |
|---|---|---|
| **Turno** | turno actual (05–13 / 13–21 / 21–05) | vs turno anterior |
| **Día** | día industrial corriente | vs día anterior |
| **Zafra** | acumulado de zafra | vs zafra previa si hay datos; si no, sin comparativa |

El cambio de período recalcula todo (KPIs, comparativa, gráficos, insight IA).

---

## 3. Backend — endpoint único de análisis

`GET /api/alerts/analisis?periodo=turno|dia|zafra`

Devuelve TODO computado server-side (un solo round-trip). Estructura de respuesta:

```ts
interface AnalisisResponse {
  periodo: 'turno' | 'dia' | 'zafra';
  rango: { desde: string; hasta: string; etiqueta: string };
  kpis: {
    total: number;
    por_severidad: { info: number; warn: number; critical: number };
    por_area: Record<string, number>;
    duracion_media_min: number;
    duracion_max_min: number;
    mtbf_min: number | null;          // tiempo medio entre alertas del período
  };
  comparativa: {
    total_prev: number | null;
    delta_pct: number | null;          // % cambio vs período anterior
    por_severidad_prev: { info: number; warn: number; critical: number } | null;
  } | null;
  series: {
    por_turno: Array<{ turno: 'Mañana' | 'Tarde' | 'Noche'; n: number }>;
    por_dia: Array<{ dia: string; n: number; duracion_media_min: number }>;
    heatmap: Array<{ dow: number; hora: number; n: number }>;  // día-semana × hora
  };
  sensores: Array<{
    area: string; key: string; titulo: string;
    n: number; mtbf_min: number | null; duracion_media_min: number;
  }>;                                  // ranking desc por n (top ~10)
  correlaciones: Array<{
    a: string; b: string; juntas: number; ventana_min: number;
  }>;                                  // pares que co-ocurren en ventana ≤ N min
  paradas: Array<{
    inicio: string; fin: string | null; minutos: number | null; motivo: string;
    alertas_relacionadas: Array<{ id: string; titulo: string; severidad: string; detected_at: string; offset_min: number }>;
  }>;
  insight: {
    resumen: string;
    patrones: string[];
    recomendaciones: string[];
    cached: boolean;
    generado_at: string;
  } | null;
}
```

### Cómputo (servicio `AlertsAnalisisService`, módulo `alerts`)
- **Fuente alertas**: `alerts.active` (todas, resueltas + activa). Filtra por `detected_at`
  dentro del rango del período.
- **MTBF**: promedio de gaps entre `detected_at` consecutivos del período.
- **Comparativa**: misma agregación sobre el período inmediatamente anterior.
- **Series**: agrupaciones por turno (helper `getCurrentShift`/derivado de hora), por día,
  y heatmap dow×hora.
- **Sensores**: agrupar por `source`/`area::key`, contar, MTBF y duración media por sensor.
- **Correlaciones**: para cada par de sensores, contar cuántas veces alarman con
  `|detected_at_a − detected_at_b| ≤ VENTANA_MIN` (default 15 min). Top pares por frecuencia.
- **Paradas**: obtener paradas del período. Fuente: RPC `fn_paradas_turno` (existe, por
  turno) para período=turno; para día/zafra, agregar las paradas de los turnos del rango
  (iterar turnos o, si hace falta, una consulta más amplia a la fuente subyacente de paradas
  — definir en el plan según disponibilidad). Para cada parada, **cruce temporal**: alertas
  cuyo `detected_at` cae en `[inicio − 30min, fin/inicio + 10min]`, con `offset_min` relativo
  al inicio de la parada.
- **Insight IA**: `ai.analizarPeriodoAlertas(payload)` con gpt-4o-mini. Recibe los agregados
  (KPIs, comparativa, top sensores, correlaciones, paradas+cruce) y devuelve
  `{ resumen, patrones[], recomendaciones[] }`. Prompt: ingeniero senior de ingenio; debe
  **interpretar** (no listar): destacar el cambio vs período anterior, el sensor más
  problemático, correlaciones relevantes, y **si alguna parada se relaciona con alertas
  previas**. Español rioplatense, JSON estricto (mismo patrón de parse robusto existente).

### Caché de costo
Insight IA cacheado por `periodo` con TTL ~60 min (Map en memoria del servicio, como
`causaCache`/`voiceCache` ya existentes). El endpoint devuelve `insight.cached=true` si
sirve de caché. Query param `?refresh=1` fuerza regeneración (botón "Regenerar"). El resto
del payload (agregados deterministas) se computa siempre fresco (es barato, es SQL).

### Degradación
Si IA no disponible → `insight: null` (los agregados y gráficos igual se muestran). Si una
fuente falla (paradas), ese bloque va vacío con marca `stale`, el resto se sirve.

---

## 4. Frontend — `/alertas/analisis` (UX/UI senior, premium)

Tema dark industrial (paleta del proyecto), jerarquía visual clara, nada genérico.
Componentes nuevos en `frontend/src/app/alertas/analisis/`:

- `page.tsx` — orquestador: TopBar, breadcrumbs, selector de período, layout.
- `_hooks/useAnalisis.ts` — React Query a `/alerts/analisis?periodo=`, maneja período + refresh.
- `_components/PeriodSelector.tsx` — segmented control Turno/Día/Zafra.
- `_components/KpiRow.tsx` — fila de KPIs grandes con tendencia (↑↓ %, color semántico, sparkline mini).
- `_components/InsightCard.tsx` — card glass destacada arriba: narrativa IA + chips de
  patrones + lista priorizada de recomendaciones. Auto-cargada. Botón "Regenerar" + sello "en caché".
- `_components/ComparativaTurnos.tsx` — BarChart agrupado (período vs anterior por turno/severidad).
- `_components/TendenciaDiaria.tsx` — AreaChart de alertas/día + duración media.
- `_components/TopSensores.tsx` — BarChart horizontal: top sensores con n + MTBF + duración.
- `_components/Heatmap.tsx` — grilla dow×hora (CSS, intensidad por conteo).
- `_components/Correlaciones.tsx` — lista de pares co-ocurrentes con su frecuencia.
- `_components/AlertasParadas.tsx` — timeline/lista: cada parada con sus alertas
  relacionadas alrededor y veredicto (offset temporal); resalta cuando hay relación.
- `_components/HistorialTabla.tsx` — historial paginado (migra `HistorialPanel` actual con
  filtros turno/área/severidad) al fondo del panel.

Orden vertical: Selector → KpiRow → InsightCard → [ComparativaTurnos | TendenciaDiaria] →
TopSensores → Heatmap → Correlaciones → AlertasParadas → HistorialTabla.

Reusa: `PremiumPanel`, glass tooltip, paleta `C`, Recharts (ya en stack, target ES2017 ya fijado).

### Limpieza en `/alertas`
- `page.tsx`: quitar `<HistorialCharts />` y `<HistorialPanel />`; quitar del hook
  `useAlertasConfig` el estado de historial si ya no se usa ahí (mover a `useAnalisis`).
  `HistorialCharts.tsx` se reemplaza por los componentes nuevos del panel de análisis
  (se elimina o se canibaliza su lógica de derivación).
- Agregar CTA "Ver análisis e historial →" en el header de `/alertas`.

---

## 5. Routing de agentes (model-routing)
- **opus**: prompt del insight IA (interpretativo + cruce paradas), diseño del endpoint y del payload.
- **sonnet**: servicio de cómputo (agregados SQL/TS), componentes UI, gráficos, hook, migración de historial.
- **haiku**: lecturas puntuales.

## 6. Dependencias / prerequisitos
- OpenAI key activa (ya lo está).
- Recharts (ya instalado). target ES2017 (ya fijado).
- Acceso a la fuente de paradas para día/zafra (validar en el plan: `fn_paradas_turno` por
  turno + agregación, o consulta a la tabla/vista subyacente).

## 7. Criterios de éxito
- `/alertas` queda limpio (solo config) con CTA al análisis.
- `/alertas/analisis` carga con **insight IA visible sin tocar nada** (auto, cacheado).
- Selector Turno/Día/Zafra recalcula todo, con comparativa y % de cambio.
- Top sensores con MTBF, correlaciones, y bloque Alertas↔Paradas que muestra relaciones reales.
- Historial paginado con filtros, mudado al panel.
- Se ve premium, no genérico; sin doble-conteo ni datos inventados (todo de `alerts.active` + paradas reales).

## 8. Fuera de alcance
- Agente Vigía (anomaly 3σ, predictor ML) — fase futura; este panel es la base donde vivirá.
- Editar/anotar alertas históricas.
- Exportar PDF del análisis (posible follow-up).
