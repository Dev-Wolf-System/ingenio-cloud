# Dev local — Setup + correr backend + frontend

> Probar el proyecto localmente antes de deploy a VPS Hostinger.

---

## 1. Pre-requisitos

- Node.js 20 LTS (`node --version` → v20.x)
- npm 10+ (incluido con Node 20)
- Conexión a Supabase production (uses `ingenio-supabase.srv878399.hstgr.cloud`)
- **Opcional MSSQL CORONA**: Tailscale activo en máquina dev (sino fallback a "datos no disponibles")
- WSL2 (si Windows) o nativo Linux/Mac

## 2. Variables de entorno

**Ya están listas:**

- `backend/.env.local` — credenciales reales Supabase + JWT dev + MSSQL config
- `frontend/.env.local` — API URL local + anon key Supabase

Si falta `MSSQL_PASSWORD` → backend levanta en "modo degradado" (endpoints `/api/guardia/gas-previo` y `/api/guardia/paradas` devuelven `{ error: "MSSQL no disponible" }`).

## 3. Levantar backend

```bash
cd ingenio-cloud/backend
npm run start:dev
```

Resultado esperado:
```
[Nest] LOG [SupabaseService] Supabase client initialised → https://ingenio-supabase.srv878399.hstgr.cloud
[Nest] LOG [MssqlService] MSSQL connected → 192.168.0.177/CORONA   ← solo si MSSQL_PASSWORD definido
[Nest] LOG [Bootstrap] 🚀 Ingenio backend listening on :3001
```

### Test endpoints backend

```bash
# Health
curl http://localhost:3001/api/health

# Snapshot métricas
curl http://localhost:3001/api/metrics/snapshot

# Catálogo sensores (35)
curl http://localhost:3001/api/metrics/catalog

# Guardia KPIs (cache vacío inicial → consulta upstream)
curl http://localhost:3001/api/guardia/molienda
curl http://localhost:3001/api/guardia/gas-previo
curl http://localhost:3001/api/guardia/paradas
curl http://localhost:3001/api/guardia/vel-molino

# Alertas activas (vacío inicial)
curl http://localhost:3001/api/alerts/active
```

### Test webhook ingesta (simular Node-RED)

```bash
# Webhook secret dev: dev-n8n-webhook-secret-32chars
curl -X POST http://localhost:3001/api/webhooks/ingest/metrics-energy \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev-n8n-webhook-secret-32chars" \
  -d '{
    "source": "manual",
    "metrics": [
      { "sensor_id": "caudal_caldera_2", "value": 62.3 },
      { "sensor_id": "caudal_caldera_3", "value": 58.1 },
      { "sensor_id": "caudal_caldera_6", "value": 65.0 },
      { "sensor_id": "presion_alta_baja", "value": 19.2 },
      { "sensor_id": "presion_escape", "value": 2.1 },
      { "sensor_id": "presion_vg1", "value": 8.4 },
      { "sensor_id": "temp_agua_alimentacion", "value": 105.2 },
      { "sensor_id": "presion_agua_alimentacion", "value": 14.2 },
      { "sensor_id": "potencia_weg", "value": 6.8 },
      { "sensor_id": "potencia_siemens", "value": 5.6 },
      { "sensor_id": "gas_actual", "value": 320 },
      { "sensor_id": "gas_acumulado_dia", "value": 4820 }
    ]
  }'

# Esperado: { "ingested": 14, "timestamp": "..." }
# (12 enviados + 2 calculados auto: caudal_total_vapor + generacion_total)
```

```bash
# Producción
curl -X POST http://localhost:3001/api/webhooks/ingest/metrics-production \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev-n8n-webhook-secret-32chars" \
  -d '{
    "metrics": [
      { "sensor_id": "nivel_jugo_pesado", "value": 78 },
      { "sensor_id": "ph_jugo", "value": 6.5 },
      { "sensor_id": "sulfitado", "value": 105 },
      { "sensor_id": "temp_ultimo_calentador", "value": 104.2 },
      { "sensor_id": "pol_cachaza", "value": 1.3 },
      { "sensor_id": "nivel_jugo_clarificado", "value": 62 },
      { "sensor_id": "caudal_jugo_clarificado", "value": 285 },
      { "sensor_id": "caudal_jugo_destileria", "value": 32 },
      { "sensor_id": "nivel_melado_tratado", "value": 45 },
      { "sensor_id": "nivel_melado_1_2", "value": 50 },
      { "sensor_id": "nivel_cristalizador_1ra", "value": 71 },
      { "sensor_id": "produccion_azucar_diaria", "value": 9739 },
      { "sensor_id": "color_azucar_icumsa", "value": 95 },
      { "sensor_id": "humedad_azucar", "value": 0.05 },
      { "sensor_id": "caudal_alcohol", "value": 2800 },
      { "sensor_id": "caudal_vino_destilado", "value": 850 },
      { "sensor_id": "caudal_buen_gusto", "value": 120 },
      { "sensor_id": "vapor_destileria_k2", "value": 2.4 },
      { "sensor_id": "nivel_agua_foza", "value": 55 },
      { "sensor_id": "aire_destileria", "value": 6.2 },
      { "sensor_id": "promedio_molienda_actual", "value": 6629 }
    ]
  }'
```

```bash
# Vel primer molino (1x turno)
curl -X POST http://localhost:3001/api/webhooks/ingest/shift/mill-speed \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev-mill-speed-secret-32chars" \
  -d '{
    "shift": "morning",
    "shift_date": "2026-05-15",
    "promedio_rpm": 4.8,
    "samples": [
      { "timestamp": "2026-05-15T05:01:00-03:00", "rpm": 4.7 },
      { "timestamp": "2026-05-15T06:00:00-03:00", "rpm": 4.9 }
    ]
  }'
```

## 4. Levantar frontend

```bash
cd ingenio-cloud/frontend
npm run dev
```

Resultado:
```
▲ Next.js 14.2.x
- Local:    http://localhost:3000
✓ Ready in 2.3s
```

Abrir browser: <http://localhost:3000>

## 5. Flujo completo de prueba

```bash
# Terminal 1: backend
cd ingenio-cloud/backend && npm run start:dev

# Terminal 2: frontend
cd ingenio-cloud/frontend && npm run dev

# Terminal 3: simular webhook (datos aparecen en panel realtime)
curl -X POST http://localhost:3001/api/webhooks/ingest/metrics-energy \
  -H "x-webhook-secret: dev-n8n-webhook-secret-32chars" \
  -H "Content-Type: application/json" \
  -d '{"metrics":[{"sensor_id":"caudal_caldera_2","value":62.3}]}'
```

Verás el panel actualizar en tiempo real vía Supabase Realtime subscription.

## 6. Build production local

```bash
# Backend
cd ingenio-cloud/backend
npm run build
node dist/main.js          # corre con env de prod

# Frontend
cd ingenio-cloud/frontend
npm run build
npm run start              # corre standalone build
```

## 7. Docker local (opcional)

```bash
# Build images localmente (sin levantar stack completo)
cd ingenio-cloud
docker build -t ingenio-backend:local ./backend
docker build -t ingenio-frontend:local \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001/api \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://ingenio-supabase.srv878399.hstgr.cloud \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  ./frontend

# Run individual
docker run --rm -p 3001:3001 --env-file ./backend/.env.local ingenio-backend:local
docker run --rm -p 3000:3000 ingenio-frontend:local
```

## 8. Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| Backend `Supabase client initialised` pero queries fallan | Tabla no existe / RLS bloquea | Verificar migrations aplicadas vía Supabase MCP |
| `MSSQL connect failed` | Sin Tailscale o password vacío | Activar Tailscale, completar `MSSQL_PASSWORD` |
| Frontend muestra todo `—` | Backend no responde o sin datos en `metrics_live` | Levantar backend + enviar webhook test |
| `401 unauthorized` en webhooks | Secret mal | Verificar header `x-webhook-secret` exacto |
| Realtime no actualiza | Subscription cerrada / RLS | Inspeccionar Network tab websockets |

## 9. Pre-deploy checklist

Antes de hacer push a VPS:

- [ ] `npm run build` backend sin errores
- [ ] `npm run build` frontend sin errores
- [ ] `npx tsc --noEmit` ambos sin errores
- [ ] Webhook ingesta funciona end-to-end (panel actualiza)
- [ ] `.env` raíz monorepo completo con secrets producción
- [ ] `git status` no muestra ningún `.env.local` (gitignored)

## 10. Próximos pasos deploy

1. SSH a VPS Hostinger
2. `cd /opt && git clone <repo> ingenio-cloud && cd ingenio-cloud`
3. `cp .env.example .env && nano .env` (completar secrets prod)
4. `docker compose --env-file ./.env build`
5. `docker compose --env-file ./.env up -d`
6. Verificar SSL en `https://ingcloud.srv878399.hstgr.cloud` + `https://api.ingcloud.srv878399.hstgr.cloud/api/health`
