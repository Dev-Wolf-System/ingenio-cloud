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

## 6.bis — Refinamiento v2 (referencia "Molienda Online" + datos confirmados)

El usuario aportó mockups de la "Molienda Online" legacy como REFERENCIA de información,
**no para copiar literal**: tomamos las mismas secciones/datos y los mostramos **mejor,
premium, con nuestra paleta/estilo** (más limpio, jerarquía clara, no denso/anticuado).

**Fuentes de datos CONFIRMADAS (ya no pendientes):**
- **Comparativo de caña** (Caña Bruta, Trash Pond, Trash Kg, Caña Neta, Rto Pond, Brix Pond,
  Pol Pond, Pureza Pond) → `legacy.muestras_lab` (cols: peso_bruto, neto_cana, trash,
  trash_real, pol, brix, pureza, rendimiento, azucar_producido, nrocierre, fecha_industrial).
  Ponderado por `neto_cana`. Columnas **Actual / Últ. Cierre / Acumulado** = día corriente /
  último `nrocierre` / zafra.
- **Tabla movimientos de caña** (NRO PESADA, GRUPO, CAÑERO, NRO MUESTRA, CAÑA BRUTA, TRASH,
  BRIX, POL…) → `legacy.muestras_lab` (numero_pesada, grupo, razon_social, numero_analisis,
  peso_bruto, trash, brix, pol, variedad).
- **Modal Análisis de Azúcar** → `legacy.especiales`: params COLOR(`color_icumsa`),
  TURBIDEZ(`turbidez`), HUMEDAD(`humedad`), CENIZAS(`cenizas`), SEDIMENTO(`sediment_test`),
  SO2(`so2_ppm`), GRANULOMETRÍA. Tipos (columnas) por `proceso_codigo`: C.CORTA=`Cinta Corta`,
  C.LARGA=`Cinta Larga`, EMBOLSADO=`Envases`/`ProduccionBolsas`, CRUDO=(confirmar; placeholder
  si no aparece). **Estado Silos** → `proceso_codigo='SILO'` (silo, destino CAÑERO/REF/VACIO,
  calidad). **Cal/Soda/ART** → `proceso_codigo='Soda_Cal'` + ART de `legacy.destileria_cubas`/
  `production.v_destileria_analisis` (art_porciento). Selector por hora (`hora_lectura`) +
  promedio del día.
- **Resumen Fábrica (jugos)** → `legacy.lab_general` (Jugo Mixto, Clarificado, Melado…).
- **Tiempo real molienda/producción** → reuso `MoliendaProduccionHora` (sin cambios).
- **Botones "Ind. Fabricación/Trapiche/Caldera/Usina/Destilería"** del mockup → reinterpretarlos
  premium (no obligatorio copiarlos); evaluar si son accesos a modales por área o indicadores.
  Definir en build (placeholder si no aporta dato nuevo ya disponible).
- **Footer** (Paradas/Total/Últ Pesada/Pol Bagazo/Pol Cachaza/Agua Imbibición; En Canchón/
  Prom Hora/Prom Día) → datos ya disponibles en el dashboard/vistas; integrar premium.

**Premium (cómo mejorar vs el legacy):** tarjetas glass con jerarquía, números tabulares
grandes con `lg:`/`xl:`, tablas con buena densidad + sticky header + scroll, tooltips glass,
estados de tendencia (↑↓) en el comparativo, modales con la estética de los del dashboard.
Mantener mobile usable (base) + agrandar en pantallas grandes.

**Backend nuevo (read-only):** sumar al módulo `molienda-cloud` endpoints
`/comparativa-cana` (agrega muestras_lab ponderado por día/cierre/zafra),
`/movimientos-cana` (filas de muestras_lab del día), `/azucar` (especiales por proceso+hora +
silos + soda_cal + ART). Sin tocar vistas existentes.

## 6.ter — Layout v3 (espejo del dashboard + Paradas)

El layout de Molienda Cloud debe **reflejar el dashboard principal** (reusar sus piezas), con cambios puntuales. **No modificar los componentes del dashboard**: si hay que variar el KpiHero, hacer una **variante propia** en `moliendacloud/` que reuse los tiles, no editar el original.

- **KPI Hero**: mantener los MISMOS tiles del dashboard EXCEPTO el de **Advertencias/alertas**, que se reemplaza por un tile **"Paradas del día corriente"**.
  - Molienda en curso y Consumo de gas: mantener sus **modales del dashboard** (reuso).
  - Tile **Paradas** → abre **modal de Paradas** (ver abajo).
- **Barra de estado del Trapiche** (parado/funcionando) a lo largo, arriba o abajo, igual que en el dashboard (reuso del componente correspondiente).
- **Debajo del hero**: fila con **Molienda y Producción en tiempo real** (reuso `MoliendaProduccionHora`, **mismo tamaño que en el dashboard**) y, **a la par**, el **Comparativo de caña**. (Usar el patrón `HeightMatchedGrid` del dashboard.)
- **A lo ancho debajo**: tabla **detalle de movimientos de camiones con caña** (`MovimientosCana`).

### Modal de Paradas (nuevo, inteligente)
Fuente: paradas vía `fn_paradas_turno(desde,hasta)` (ya usado en el panel de análisis de alertas) + `legacy.lab_general`/`especiales` proceso 'Paradas*'. Contenido:
- Detalle de paradas del **día corriente** con **gráficos** + análisis **MTBF/MTTR** (reusar la lógica de confiabilidad ya hecha en `backend/.../analisis/aggregate.ts` → `reliabilidad`).
- **Selector** turno/día/zafra + días/turnos anteriores (offset), igual patrón que el panel de análisis de alertas (`rangoPeriodo`).
- **Paradas por área/sección**; la **IA clasifica** a qué área/categoría pertenece cada parada + **análisis IA** del período y **gráficos inteligentes** (barras por área, duración, Pareto de motivos, etc.).
- Estética premium, paleta INDUSTRIAL_DARK, modales como los del dashboard.

Reutilizar al máximo lo construido para el panel de análisis de alertas (`/alertas/analisis`): `rangoPeriodo`, `reliabilidad`, prompts IA de interpretación, componentes de gráficos.

## 7. Fuera de alcance (ahora)
- Login / RBAC / niveles de acceso (futuro, solo previsto).
- Cablear datos cuyo mapeo de negocio no esté confirmado (van como placeholder).
- Cambiar la URL final (hoy `/moliendacloud`, se moverá a futuro).
