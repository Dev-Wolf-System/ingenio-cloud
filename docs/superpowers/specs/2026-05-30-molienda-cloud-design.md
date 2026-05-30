# Molienda Cloud — Diseño (maqueta inicial)

> Estado: DISEÑO (maqueta) · 2026-05-30 · branch `feat/molienda-cloud`
> Nueva plataforma dentro del MISMO ecosistema/app, en la ruta `/moliendacloud`.
> **El dashboard principal (`/`) y todas sus vistas/datos NO se tocan — debe quedar
> intacto y funcionando igual.** Reutilizamos vistas/endpoints existentes en modo
> SOLO LECTURA; no se modifica ninguna vista usada por el dashboard.

---

## 0. Objetivo y alcance

Molienda Cloud = panel enfocado en el **movimiento/logística de la molienda** (camiones,
balanza, canchón, calidad de caña, jugos, azúcar), no en el monitoreo de fábrica. La
molienda sigue siendo en tiempo real. Mismo formato, paleta y estructura que el dashboard
(reutilizar componentes), con KPIs hero re-enfocados.

**Fase actual = MAQUETA + diseño**: armar el layout y los componentes, conectando datos
donde ya hay vistas, y dejando placeholders claros donde faltan. Se nutre de a poco.

**Futuro (NO ahora, solo tenerlo presente):** login + RBAC (niveles de acceso,
restricciones por usuario) que segurizará toda la plataforma. El diseño no debe impedirlo
(ruta aislada, layout propio).

**Integridad (regla dura):** no modificar `page.tsx` del dashboard, ni sus componentes, ni
las vistas que consume. Componentes reutilizados se importan tal cual (read-only). Si un
componente necesita variar, se hace una copia/variante nueva, no se edita el original.

---

## 1. Routing e integración

- Nueva ruta Next App Router: `frontend/src/app/moliendacloud/page.tsx` (+ subcarpeta
  `_components`, `_hooks`). Convive en la misma app/deploy.
- **Sin link desde el dashboard** — se accede solo por URL `…/moliendacloud`.
- Dentro de Molienda Cloud SÍ hay un botón "→ Dashboard de Monitoreo" (a `/`).
- Reutiliza: `TopBar`, paleta/tokens (`var(--*)`, theme claro/oscuro), `PremiumPanel`,
  patrón de `KpiHero`, y el componente de molienda+producción en tiempo real.

---

## 2. Layout / secciones (de arriba hacia abajo)

1. **TopBar** `plant="Molienda Cloud"` + botón "→ Dashboard de Monitoreo".
2. **KPI Hero (re-enfocado a movimientos)** — misma estética que el hero actual, tiles:
   - **Movimientos por balanza** con **selector tipo pastilla**: Caña · Alcohol · Cachaza ·
     Varios (categoría no definida). Muestra conteo/tn del tipo seleccionado.
   - **Tiempo última pasada** (desde la última `salida_at` de balanza) y **tiempo de espera**
     (promedio entre pasadas / cola).
   - **Camiones en canchón** (actual).
   - (Mantener 4-6 tiles, mismo estilo hero.)
3. **Molienda y Producción en tiempo real** — **copiar tal cual** lo del dashboard
   (`MoliendaProduccionHora`, con sus datos y endpoints actuales, sin modificar).
4. **Hora × hora — llegada de camiones al canchón** (barras/área por hora).
5. **Comparativo de caña (Día actual · Día anterior · Zafra)** — tabla/tarjetas con:
   Molienda, Trash ponderado, Trash Kg, Caña Neta, Rto. ponderado, Brix ponderado,
   Pol ponderado, Pureza ponderada.
6. **Promedios de molienda**: promedio **en curso** + promedio **diario**.
7. **Botón → Modal "Análisis de Azúcar"** (lab): todos los análisis de azúcar con
   **selector de horario**, + promedio diario de cada análisis.
8. **Botón → Modal "Resumen de Fábrica"**: promedios de **jugos**.

Orden y agrupación visual a refinar en build; mantener la grilla/altura-pareja del dashboard.

---

## 3. Fuentes de datos (disponible vs pendiente)

**Ya disponible (vistas/tablas existentes — reusar SOLO LECTURA):**
- `production.v_camiones_canchon`, `production.v_canchon_resumen` → camiones en canchón / resumen.
- `production.v_descarga_balanza_hora` → hora×hora de balanza/canchón.
- `production.v_molienda_bloques` → molienda hora×hora y por bloque (turno/día/zafra).
- `public.v_molienda_turno_actual` → promedio molienda turno (⚠ bug aparte: hoy null si el
  lab no cargó; se resuelve por separado, no bloquea la maqueta).
- `legacy.movimientos` → pasadas de balanza: `tipo_pesada` (C=caña; A/L = otros),
  `neto_cana`, `trash`, `trash_real`, `peso_neto`, `salida_at`, `fecha_industrial`, etc.
  → movimientos por tipo, caña neta, trash kg, tiempos de pasada/espera.
- `legacy.lab_general` (`brix_manual/automatico`, `pol_*`, `pureza`, `kilos`, `hora_lectura`,
  `proceso_codigo`) → jugos (Jugo Mixto, Clarificado, Melado…), azúcar (Azúcar de 3era…),
  brix/pol/pureza por proceso.

**Pendiente de confirmar / construir (mapeo de negocio — se define con el usuario):**
- **Categorías de movimiento** Caña/Alcohol/Cachaza/Varios → cómo se derivan de
  `movimientos` (¿`tipo_pesada`? ¿`destino_descripcion`? hoy se conoce C=caña, A/L sin
  `neto_cana`). Confirmar el mapeo exacto antes de cablear el selector.
- **Comparativo de caña**: Trash ponderado/Kg y Caña Neta salen de `movimientos`;
  **Brix/Pol/Pureza/Rto ponderado de caña** — no hay proceso "Caña" en lab; probablemente
  derivar de jugo de 1era presión u otra fuente. Confirmar fuente/fórmula del rendimiento ponderado.
- **Análisis de Azúcar**: qué `proceso_codigo` representan el producto azúcar y qué métricas
  (color/humedad/granulometría suelen no estar en lab_general; hay pol/pureza). Confirmar.
- **Tiempo de espera**: definición exacta (cola en canchón vs gap entre pasadas).

Donde el dato no esté confirmado, el componente se maqueta con **placeholder/estado vacío
claro** ("dato pendiente") y se nutre después. **No inventar valores.**

---

## 4. Backend

- Endpoints nuevos SOLO LECTURA en un módulo nuevo (p.ej. `modules/molienda-cloud/`) que
  consultan las vistas existentes; no se crean ni modifican vistas usadas por el dashboard.
- Si hace falta una vista nueva (p.ej. movimientos por tipo, comparativo de caña), se crea
  con nombre nuevo (`v_mc_*`) sin tocar las existentes (y la migración la corre el owner).
- Reutilizar endpoints actuales del dashboard para molienda/producción tiempo real (mismos).

---

## 5. Frontend — estructura

```
frontend/src/app/moliendacloud/
  page.tsx                 # orquestador (TopBar + secciones)
  _hooks/                  # hooks de datos (React Query) por sección
  _components/
    MovimientosHero.tsx    # KPI hero re-enfocado + selector tipo pastilla
    CanchonHoraChart.tsx   # hora×hora llegada camiones
    ComparativaCana.tsx    # día/día/zafra (molienda, trash, caña neta, rto, brix, pol, pureza)
    PromediosMolienda.tsx  # en curso + diario
    AnalisisAzucarModal.tsx
    ResumenFabricaModal.tsx
```
Reusa `MoliendaProduccionHora` del dashboard (import directo, sin copiar/modificar) para la
sección de tiempo real. Paleta/tema vía tokens existentes.

---

## 6. Criterios de éxito (maqueta)
- `/moliendacloud` carga con la estética del dashboard, sin romper `/` ni sus datos.
- Secciones con datos reales donde hay vista; placeholders claros donde falta.
- Botón a Dashboard funciona; sin link inverso desde el dashboard.
- Cero cambios en vistas/componentes del dashboard principal.
- Base lista para sumar login/RBAC en el futuro (ruta y layout aislados).

## 7. Fuera de alcance (ahora)
- Login / RBAC / niveles de acceso (futuro, solo previsto).
- Cablear datos cuyo mapeo de negocio no esté confirmado (van como placeholder).
- Cambiar la URL final (hoy `/moliendacloud`, se moverá a futuro).
