# 10 — Pendientes humano (bloqueantes + decisiones)

Lista priorizada de lo que requiere intervención humana para no bloquear ejecución del plan.

---

## 🔴 P0 — Bloqueantes inmediatos (antes Día 1)

| # | Pendiente | Bloquea | Cómo resolver |
|---|---|---|---|
| 1 | **Decidir hosting dev inicial** — ¿VPS de inmediato o dev local primero, luego VPS? | Día 1 | Recomiendo: **local + Supabase cloud staging** primero (rapidez), luego VPS Día 10. |
| 2 | **Repo GitHub** — ¿privado existe? ¿crear nuevo? | Día 1 | Crear `ingenio-cloud-web` privado. Confirmar org/owner. |
| 3 | **Subdominio servidor** | ✅ DEFINIDO | Frontend: `ingcloud.srv878399.hstgr.cloud` · API: `api.ingcloud.srv878399.hstgr.cloud` · Futuros derivados según necesidad. Hostinger VPS srv878399. Confirmar wildcard DNS *.ingcloud.srv878399.hstgr.cloud o crear A records individuales. |
| 4 | **Credenciales Supabase** (cloud staging o self-hosted local) | Día 4 | Si cloud: crear proyecto. Si self-hosted: usar Docker Compose existente del plan v3.0. |
| 5 | **`N8N_WEBHOOK_SECRET`** generado y compartido con admin n8n | Día 6 | Generar con `openssl rand -hex 32`. |
| 6 | **Acceso MSSQL CORONA** — confirmar `fs1` password aún válido | Día 6 | Sí, ya está documentado en `BDs MMSQL/CLAUDE.md`. |

---

## 🟡 P1 — Datos del cliente (durante desarrollo)

| # | Pendiente | Para Día | Detalle |
|---|---|---|---|
| 7 | **Setpoints reales por sensor** (32 variables) | Día 2-5 | Lista actual en `05_VARIABLES_Y_DATOS.md` con placeholders. Pedir a jefe de planta: min/max/warn de cada uno. |
| 8 | **Clarificación variables ambiguas** (ver lista abajo) | Día 5 | 6 variables tienen dudas — ver sección 1.1 |
| 9 | **URL + auth HTTP molienda promedio** | Día 6 | Endpoint externo ya existente. Necesitamos URL + headers auth. |
| 10 | **Query SQL exacta MSSQL gas turno previo** | Día 6 | Necesario nombre exacto tabla + columnas. Probablemente `pr_ezi_laboratorio_gral` con `codigoproceso='Gas'` filtrado por fecha turno. Validar con MCP. |
| 11 | **Query SQL exacta MSSQL paradas turno previo** | Día 6 | `pr_ezi_*` con `codigoproceso LIKE 'Paradas%'`. Confirmar estructura `motivo` + `duracion`. |
| 12 | **Configurar flow n8n metrics-energy + metrics-production** | Día 6 | Documentado formato esperado en `06_INTEGRACION_DATOS.md` sec 2.1. n8n admin debe armar el flow. |
| 13 | **Configurar flow n8n cierre turno → velocidad molino** | Día 6 | Cron 05:01 / 13:01 / 21:01 → query InfluxDB → POST webhook. |

### 1.1 Variables ambiguas a clarificar

```
□ presion_alta_baja
  - ¿1 sensor o 2? ¿Si 2, los mostramos como Alta y Baja separados?

□ nivel_melado_1_2
  - ¿"Melado 1/2" significa Melado 1 y Melado 2 (2 sensores)?
  - ¿O es un solo sensor llamado "melado 1/2"?

□ caudal_vino_destilado + caudal_buen_gusto
  - ¿Son dos productos distintos a medir por separado?
  - ¿O un total combinado?

□ color_humedad_azucar
  - ¿2 sensores: color ICUMSA + humedad %?
  - ¿O viene como objeto JSON único?

□ vapor_destileria_k2
  - Variable usada para determinar si K2 funcionando. ¿Es el caudal de vapor a destilería o presión de vapor?

□ Producción azúcar diaria
  - ¿Se cuenta por bolsas o por toneladas?
  - ¿Cuándo se "cierra" el día? (00:00 ART = corte natural)
```

---

## 🟢 P2 — Decisiones de producto (durante desarrollo)

| # | Pendiente | Para Día | Detalle |
|---|---|---|---|
| 14 | **Branding** | ✅ DEFINIDO | Nombre: **Ingenio Cloud**. Logo: `Media/Logo - Ingenio Cloud.png`. Paleta ajustada a azules logo (#1E5A87/#2E7AB5/#4A9CD8 + accent cyan #4FBFE5). Convertir PNG → SVG si posible para escalado infinito. |
| 15 | **Usuario admin inicial** | Día 8 | Email + nombre para crear primer user Supabase Auth |
| 16 | **Roles iniciales necesarios** | Día 8 | ¿Solo "Admin" para piloto? ¿O ya separar Operador / Supervisor? |
| 17 | **Comportamiento auto-rotación TV** | Día 7 | ¿Activar siempre que haya alerta crítica? ¿Tiempo zoom (5s default)? ¿Frecuencia (90s default)? |
| 18 | **Mensaje copilot placeholder** S0 | Día 3 | Texto fijo mientras no esté Vigía. Sugerencia: "Vigía proactivo en desarrollo — disponible Sprint 1". |
| 19 | **Modo claro** ¿se ofrece o no? | Día 9 | Default dark obligatorio. ¿Toggle a claro en mobile/PC? |
| 20 | **Idioma** español-AR únicamente o preparar pt-BR ya | Día 1 | Recomiendo solo es-AR ahora, infra next-intl preparada. |

---

## 🔵 P3 — Operación / producción

| # | Pendiente | Para Día | Detalle |
|---|---|---|---|
| 21 | **VPS specs producción** | Día 10 | Si vamos a deploy producción inmediato, confirmar VPS. Sino piloto local primero. |
| 22 | **Ventana cutover con La Corona** | Día 10 | Para ir productivo con el panel real. Coordinar con planta. |
| 23 | **Monitoring quien recibe alertas operacionales** | Día 10 | Si la app falla, ¿WhatsApp a quién? |
| 24 | **Backup destino** | Día 10 | Backblaze B2 según v3.0. Confirmar bucket + credenciales. |
| 25 | **SSL provider** | Día 10 | Let's Encrypt via Traefik (recomendado). Confirmar dominio + DNS Cloudflare. |
| 26 | **Política de retención metrics_history** | Día 10 | ¿Cuánto histórico guardamos? 90 días raw + downsamples más largo? |

---

## 📊 Resumen visual

```
P0 BLOQUEANTES (6 ítems)
  ────────────────────────────────────► Día 1
P1 DATOS CLIENTE (7 ítems)
  ────────────────► durante Días 2-6
P2 DECISIONES PRODUCTO (7 ítems)
  ────────────────► durante Días 3-9
P3 OPERACIÓN (6 ítems)
  ────────────────────────────────────► Día 10+
```

---

## Acciones inmediatas humano (esta semana)

### Hoy / Mañana:
- [ ] Aprobar plan completo (revisar 10 docs en `plan/`)
- [ ] Decidir: ¿comenzamos local-first o VPS desde Día 1?
- [ ] Confirmar nombre del repo + crear en GitHub
- [ ] Generar `N8N_WEBHOOK_SECRET`

### Esta semana:
- [ ] Conseguir lista de setpoints reales de los 32 sensores
- [ ] Aclarar 6 variables ambiguas con jefe de planta
- [ ] Conseguir URL HTTP de molienda promedio
- [ ] Identificar tablas/columnas exactas MSSQL gas + paradas

### Próxima semana:
- [ ] Coordinar con admin n8n configuración de flows
- [ ] Definir branding + dominio
- [ ] Crear usuarios iniciales La Corona

---

## Plan de comunicación

**Cuando algo se desbloquea:** humano avisa por chat directo en sesión Claude Code → continúo desde donde quedó.

**Cuando hay duda técnica:** Claude pregunta en sesión, espera respuesta antes de avanzar.

**Cuando se valida visualmente:** humano comparte screenshot o feedback verbal → ajustes en próxima iteración.

---

## Riesgos identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Setpoints reales muy distintos a placeholders → muchas falsas alarmas en producción | Alta | Medio | Iterar con jefe de turno primera semana real |
| MSSQL queries lentas (CORONA tiene 2270 tablas, índices viejos) | Media | Medio | Cache server-side persistente + timeout 10s + fallback "datos no disponibles" |
| Webhooks n8n no se configuran a tiempo | Media | Alto | Mock data realista mientras tanto, no bloquear desarrollo UI |
| Latencia Realtime > 5s (red planta) | Baja | Medio | Usar EMQX → Node-RED batch 5s explícito, no 1s |
| TV mode falla en Smart TV específico | Media | Bajo | Usar Chromebox o mini-PC dedicado, no Smart TV |
| Operador rechaza interfaz nueva | Baja | Alto | Co-diseño + iteración semanal + opt-in features |

---

**Volver al índice:** [`README.md`](./README.md)
