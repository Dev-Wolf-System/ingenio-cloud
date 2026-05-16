# 11 — Deploy VPS con Docker Compose

> **Decisión arquitectónica:** Estructura split `backend/` + `frontend/` mirrorando patrón AVAX. Traefik en red externa `n8n_evoapi` (compartida con stack existente n8n + Evolution API). Supabase en red externa `supabase_network`.

---

## 1. Decisión: split backend + frontend (no monolito)

Aunque para sólo el dashboard sería viable un Next.js monolito con API routes, **separamos backend y frontend** desde día 1 por:

1. **Coherencia con stack existente** AVAX en VPS
2. **Preparación Sprint 1+** — agente FastAPI Python se agregará como tercer servicio sin disrupción
3. **Webhooks ingesta independiente del SSR** — backend NestJS dedicado para `/api/webhooks/n8n/*` con menor latencia
4. **MSSQL pool reutilizable** — conexión pool en backend, no recrearla en cada API route Next.js
5. **Escalado independiente** — frontend horizontal con CDN, backend vertical con pool DB
6. **Ops alineadas** — mismo patrón Traefik labels, mismas redes Docker

---

## 2. Estructura monorepo

```
ingenio-cloud/
├── backend/                      # NestJS API (TypeScript, port 3001)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── webhooks/         # ingesta n8n
│   │   │   ├── guardia/          # KPIs 1x turno
│   │   │   ├── metrics/          # snapshot + history queries
│   │   │   ├── alerts/           # CRUD alertas
│   │   │   ├── mssql/            # cliente CORONA legacy
│   │   │   ├── supabase/         # service client wrapper
│   │   │   └── health/
│   │   ├── common/
│   │   │   ├── guards/           # webhook secret guard
│   │   │   ├── interceptors/     # logging, rate limit
│   │   │   ├── validators/       # zod schemas
│   │   │   └── filters/          # exception filters
│   │   ├── config/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── nest-cli.json
│
├── frontend/                     # Next.js 14 App Router (port 3000)
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── stores/
│   │   ├── types/
│   │   └── styles/
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   └── tailwind.config.ts
│
├── shared/                       # tipos compartidos backend+frontend
│   ├── types/
│   └── schemas/                  # zod schemas comunes
│
├── infra/
│   ├── docker-compose.yml
│   ├── traefik/                  # ya gestionado por stack existente
│   └── scripts/
│       ├── deploy.sh
│       ├── backup-db.sh
│       └── seed.sh
│
├── docs/                         # link al plan/
├── .env.example                  # template VPS production
├── .env.dev.example              # template dev local
├── .gitignore
├── README.md
└── pnpm-workspace.yaml          # opcional, ya monorepo
```

---

## 3. docker-compose.yml (production VPS)

```yaml
# infra/docker-compose.yml
services:
  ingenio-backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
    container_name: ingenio-backend
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3001
      # Supabase (red supabase_network)
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
      - DB_HOST=supabase-db
      - DB_PORT=5432
      - DB_USERNAME=${DB_USERNAME}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_DATABASE=${DB_DATABASE}
      # JWT internal
      - JWT_SECRET=${JWT_SECRET}
      - JWT_EXPIRATION=${JWT_EXPIRATION}
      - JWT_REFRESH_EXPIRATION=${JWT_REFRESH_EXPIRATION}
      # URLs
      - FRONTEND_URL=https://${DOMAIN_NAME}
      - BACKEND_URL=https://api.${DOMAIN_NAME}/api
      # Webhooks n8n
      - N8N_WEBHOOK_SECRET=${N8N_WEBHOOK_SECRET}
      - MILL_SPEED_WEBHOOK_SECRET=${MILL_SPEED_WEBHOOK_SECRET}
      # MSSQL CORONA legacy (read-only)
      - MSSQL_HOST=${MSSQL_HOST}
      - MSSQL_PORT=${MSSQL_PORT}
      - MSSQL_DATABASE=${MSSQL_DATABASE}
      - MSSQL_USER=${MSSQL_USER}
      - MSSQL_PASSWORD=${MSSQL_PASSWORD}
      - MSSQL_ENCRYPT=false
      - MSSQL_TRUST_SERVER_CERTIFICATE=true
      # External HTTP molienda
      - MOLIENDA_HTTP_URL=${MOLIENDA_HTTP_URL}
      - MOLIENDA_HTTP_AUTH=${MOLIENDA_HTTP_AUTH}
      # IA (preparado Sprint 1+)
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GOOGLE_AI_API_KEY=${GOOGLE_AI_API_KEY}
      # Comms
      - EVOLUTION_API_URL=${EVOLUTION_API_URL}
      - EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
      - RESEND_API_KEY=${RESEND_API_KEY}
      - MAIL_FROM=${MAIL_FROM}
      # Observabilidad
      - LANGFUSE_PUBLIC_KEY=${LANGFUSE_PUBLIC_KEY}
      - LANGFUSE_SECRET_KEY=${LANGFUSE_SECRET_KEY}
      - LANGFUSE_HOST=${LANGFUSE_HOST}
      # Timezone
      - TZ=America/Argentina/Buenos_Aires
    labels:
      - traefik.enable=true
      - traefik.docker.network=n8n_evoapi
      - traefik.http.routers.ingenio-api.rule=Host(`api.${DOMAIN_NAME}`)
      - traefik.http.routers.ingenio-api.tls=true
      - traefik.http.routers.ingenio-api.entrypoints=web,websecure
      - traefik.http.routers.ingenio-api.tls.certresolver=mytlschallenge
      - traefik.http.services.ingenio-api.loadbalancer.server.port=3001
      - traefik.http.middlewares.ingenio-api-headers.headers.STSSeconds=315360000
      - traefik.http.middlewares.ingenio-api-headers.headers.browserXSSFilter=true
      - traefik.http.middlewares.ingenio-api-headers.headers.contentTypeNosniff=true
      # SSLRedirect omitido — TLS ya está en router; SSLRedirect causaba 403 en edge cases
      # CORS manejado por NestJS (origin: configurable)
      - traefik.http.routers.ingenio-api.middlewares=ingenio-api-headers@docker
    networks:
      - n8n_evoapi
      - supabase_network

  ingenio-frontend:
    build:
      context: ../frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_API_URL=https://api.${DOMAIN_NAME}/api
        - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
        - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
        - NEXT_PUBLIC_APP_NAME=Ingenio Cloud
        - NEXT_PUBLIC_DEFAULT_TENANT_SLUG=lacorona
        - NEXT_PUBLIC_DEFAULT_PLANT_SLUG=planta-sur
    container_name: ingenio-frontend
    restart: always
    environment:
      - NODE_ENV=production
      - TZ=America/Argentina/Buenos_Aires
    labels:
      - traefik.enable=true
      - traefik.http.services.ingenio-web.loadbalancer.server.port=3000
      # Router principal — solo dominio sin www
      - traefik.http.routers.ingenio-web.rule=Host(`${DOMAIN_NAME}`)
      - traefik.http.routers.ingenio-web.tls=true
      - traefik.http.routers.ingenio-web.entrypoints=web,websecure
      - traefik.http.routers.ingenio-web.tls.certresolver=mytlschallenge
      - traefik.http.middlewares.ingenio-web-headers.headers.SSLRedirect=true
      - traefik.http.middlewares.ingenio-web-headers.headers.STSSeconds=315360000
      - traefik.http.middlewares.ingenio-web-headers.headers.browserXSSFilter=true
      - traefik.http.middlewares.ingenio-web-headers.headers.contentTypeNosniff=true
      - traefik.http.routers.ingenio-web.middlewares=ingenio-web-headers@docker
      # NOTA: omitido router www → subdominios Hostinger srv-XXXXXX.hstgr.cloud no usan prefijo www
      # Si en el futuro se compra dominio propio (ej. ingeniocloud.app), reactivar bloque www-redirect:
      # - traefik.http.routers.ingenio-www.rule=Host(`www.${DOMAIN_NAME}`)
      # - traefik.http.routers.ingenio-www.tls=true
      # - traefik.http.routers.ingenio-www.entrypoints=web,websecure
      # - traefik.http.routers.ingenio-www.tls.certresolver=mytlschallenge
      # - traefik.http.middlewares.ingenio-www-redirect.redirectregex.regex=^https?://www\.(.*)
      # - traefik.http.middlewares.ingenio-www-redirect.redirectregex.replacement=https://$${1}
      # - traefik.http.middlewares.ingenio-www-redirect.redirectregex.permanent=true
      # - traefik.http.routers.ingenio-www.middlewares=ingenio-www-redirect@docker
    networks:
      - n8n_evoapi

networks:
  n8n_evoapi:
    external: true
  supabase_network:
    external: true
```

---

## 4. Dockerfile backend (NestJS)

```dockerfile
# backend/Dockerfile
# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN pnpm build && pnpm prune --prod

# ---- Stage 2: Runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Argentina/Buenos_Aires
RUN apk add --no-cache tzdata curl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3001/health || exit 1

USER node
CMD ["node", "dist/main.js"]
```

---

## 5. Dockerfile frontend (Next.js 14 standalone)

```dockerfile
# frontend/Dockerfile
# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Build-time public env vars
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_DEFAULT_TENANT_SLUG
ARG NEXT_PUBLIC_DEFAULT_PLANT_SLUG

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_DEFAULT_TENANT_SLUG=$NEXT_PUBLIC_DEFAULT_TENANT_SLUG
ENV NEXT_PUBLIC_DEFAULT_PLANT_SLUG=$NEXT_PUBLIC_DEFAULT_PLANT_SLUG

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- Stage 2: Runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Argentina/Buenos_Aires
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache tzdata curl

# Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

USER node
CMD ["node", "server.js"]
```

**Importante** en `frontend/next.config.mjs`:
```javascript
const config = {
  output: 'standalone',
  reactStrictMode: true,
  // ...
};
```

---

## 6. .env.example (template VPS production)

```bash
# =============================================================================
# Ingenio Cloud — VPS Production
# Copiar a /opt/ingenio-cloud/.env en VPS, completar valores reales
# NUNCA commitear .env real al repo
# =============================================================================

# ---------- Dominio ----------
DOMAIN_NAME=ingcloud.srv878399.hstgr.cloud                  # Frontend: https://${DOMAIN_NAME}
                                              # API:      https://api.${DOMAIN_NAME}

# ---------- Supabase (red externa supabase_network) ----------
SUPABASE_URL=http://kong:8000
NEXT_PUBLIC_SUPABASE_URL=https://supabase.${DOMAIN_NAME}
NEXT_PUBLIC_SUPABASE_ANON_KEY=                # anon JWT
SUPABASE_SERVICE_ROLE_KEY=                    # service_role JWT
SUPABASE_JWT_SECRET=                          # shared secret

# Postgres directo (Drizzle migrations)
DB_HOST=supabase-db
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=                                  # POSTGRES_PASSWORD del stack supabase
DB_DATABASE=postgres

# ---------- JWT interno (auth refresh) ----------
JWT_SECRET=                                   # openssl rand -hex 64
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# ---------- Webhooks ----------
N8N_WEBHOOK_SECRET=                           # openssl rand -hex 32
MILL_SPEED_WEBHOOK_SECRET=                    # openssl rand -hex 32

# ---------- MSSQL CORONA legacy (read-only) ----------
# Acceso via Tailscale: ya estás conectado al host
MSSQL_HOST=192.168.0.177
MSSQL_PORT=1433
MSSQL_DATABASE=CORONA
MSSQL_USER=fs1
MSSQL_PASSWORD=                               # ASK humano
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true

# ---------- HTTP externo molienda ----------
MOLIENDA_HTTP_URL=                            # URL endpoint listo (n8n actual)
MOLIENDA_HTTP_AUTH=                           # Bearer / basic / sin auth

# ---------- IA APIs (Sprint 1+) ----------
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=

# ---------- Comms (existentes) ----------
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=
RESEND_API_KEY=                               # opcional
MAIL_FROM=alertas@${DOMAIN_NAME}

# ---------- Observabilidad (Langfuse self-hosted) ----------
LANGFUSE_PUBLIC_KEY=                          # Sprint 1+
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://langfuse.${DOMAIN_NAME}

# ---------- Defaults aplicación ----------
NEXT_PUBLIC_APP_NAME=Ingenio Cloud
NEXT_PUBLIC_DEFAULT_TENANT_SLUG=lacorona
NEXT_PUBLIC_DEFAULT_PLANT_SLUG=planta-sur
```

---

## 7. .env.dev.example (template desarrollo local)

```bash
# =============================================================================
# Ingenio Cloud — Desarrollo local (NO se sube al VPS)
# Copiar a backend/.env.local y frontend/.env.local
# =============================================================================

NODE_ENV=development
PORT=3001                                     # backend
TZ=America/Argentina/Buenos_Aires

# Supabase cloud staging (cuenta dev) o local Docker
SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...           # anon dev
SUPABASE_SERVICE_ROLE_KEY=eyJ...               # service_role dev
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters

DB_HOST=localhost
DB_PORT=54322
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres

# JWT
JWT_SECRET=dev-jwt-secret-cambiar-en-prod
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# URLs locales
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001/api
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Webhooks (dev)
N8N_WEBHOOK_SECRET=dev-webhook-secret-cambiar
MILL_SPEED_WEBHOOK_SECRET=dev-mill-secret

# MSSQL CORONA — via Tailscale desde dev machine (ya configurado en CLAUDE.md MSSQL)
MSSQL_HOST=192.168.0.177
MSSQL_PORT=1433
MSSQL_DATABASE=CORONA
MSSQL_USER=fs1
MSSQL_PASSWORD=
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true

# HTTP molienda (mockear con localhost mientras no se tiene la URL real)
MOLIENDA_HTTP_URL=http://localhost:3001/api/__mock/molienda
MOLIENDA_HTTP_AUTH=

# IA (vacío en dev)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=

# Comms
EVOLUTION_API_URL=
EVOLUTION_API_KEY=

# Defaults
NEXT_PUBLIC_APP_NAME=Ingenio Cloud (DEV)
NEXT_PUBLIC_DEFAULT_TENANT_SLUG=lacorona
NEXT_PUBLIC_DEFAULT_PLANT_SLUG=planta-sur
```

---

## 8. .gitignore (raíz monorepo)

```gitignore
# ─── Env files (NUNCA commitear) ───
.env
.env.local
.env.production
.env.development
backend/.env*
frontend/.env*
!**/.env.example
!**/.env.*.example

# ─── Node ───
node_modules/
.pnpm-store/
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# ─── Next.js ───
.next/
out/
.vercel/
next-env.d.ts

# ─── NestJS ───
dist/

# ─── Builds ───
build/
*.tsbuildinfo

# ─── IDE ───
.vscode/
.idea/
*.swp
.DS_Store

# ─── Tests ───
coverage/
.nyc_output/
test-results/
playwright-report/
playwright/.cache/

# ─── Docker ───
**/.dockerignore.local

# ─── Secrets / claves ───
*.pem
*.key
*.p12
secrets/
```

---

## 9. .dockerignore (backend y frontend)

```
node_modules
.next
dist
.git
.gitignore
.env*
!.env.example
README.md
test
coverage
playwright-report
.vscode
.idea
*.log
.DS_Store
```

---

## 10. Workflow de deploy

### 10.1 Primera vez en VPS

```bash
# En VPS, dentro de carpeta del proyecto (ej. /opt/ingenio-cloud/)

# 1. Clonar repo
git clone git@github.com:dev-wolf/ingenio-cloud.git .

# 2. Crear .env desde template
cp .env.example .env
nano .env                              # completar credenciales reales

# 3. Verificar redes externas existen
docker network ls | grep -E "n8n_evoapi|supabase_network"
# Si no existen, crearlas (deberían estar ya por stack n8n y supabase):
# docker network create n8n_evoapi
# docker network create supabase_network

# 4. Build inicial + up
cd infra
docker compose --env-file ../.env build
docker compose --env-file ../.env up -d

# 5. Verificar logs
docker compose logs -f ingenio-backend
docker compose logs -f ingenio-frontend

# 6. Verificar Traefik resolvió SSL
curl -I https://api.ingcloud.srv878399.hstgr.cloud/health
curl -I https://ingcloud.srv878399.hstgr.cloud
```

### 10.2 Actualización (CI/CD GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/ingenio-cloud
            git fetch --all
            git reset --hard origin/main
            cd infra
            docker compose --env-file ../.env build --pull
            docker compose --env-file ../.env up -d --remove-orphans
            docker compose --env-file ../.env logs --tail=50
            docker image prune -af
```

### 10.3 Script manual `infra/scripts/deploy.sh`

```bash
#!/bin/bash
# Uso: ./deploy.sh [--rebuild]
set -e

cd "$(dirname "$0")/.."
echo "▶ Pulling latest from main..."
git fetch --all
git reset --hard origin/main

cd infra
if [[ "$1" == "--rebuild" ]]; then
  echo "▶ Rebuilding images from scratch..."
  docker compose --env-file ../.env build --no-cache --pull
else
  echo "▶ Building images (cached)..."
  docker compose --env-file ../.env build --pull
fi

echo "▶ Restarting services..."
docker compose --env-file ../.env up -d --remove-orphans

echo "▶ Pruning old images..."
docker image prune -af

echo "▶ Health check..."
sleep 10
curl -fsS "https://api.${DOMAIN_NAME}/health" || echo "⚠ backend health failed"
curl -fsS "https://${DOMAIN_NAME}" -o /dev/null || echo "⚠ frontend failed"

echo "✓ Deploy completo"
```

---

## 11. Acceso a MSSQL CORONA desde VPS

CORONA vive en `192.168.0.177` (LAN ingenio). VPS necesita acceso. Opciones:

### Opción A — Tailscale (recomendado)
- VPS conectado a tailnet existente (mismo que ya usa MCP `mssql` en `100.87.222.50`)
- Backend container hereda red host via `network_mode: host` o tailscale-funnel
- **Mejor opción** para producción

### Opción B — VPN site-to-site
- Túnel WireGuard / OpenVPN VPS ↔ ingenio LAN
- Más infraestructura

### Opción C — MSSQL expuesto público (NO recomendado)
- Solo si está aislado y bien protegido
- Falta SSL real en SQL Server 2008 R2
- ❌ Evitar

### Configuración Tailscale para backend container

```yaml
# en docker-compose.yml backend service:
services:
  ingenio-backend:
    # ...
    network_mode: "service:tailscale"     # comparte stack con sidecar tailscale
  
  tailscale:
    image: tailscale/tailscale:latest
    container_name: ingenio-tailscale
    hostname: ingenio-vps
    environment:
      - TS_AUTHKEY=${TAILSCALE_AUTHKEY}
      - TS_STATE_DIR=/var/lib/tailscale
      - TS_EXTRA_ARGS=--advertise-tags=tag:server
    volumes:
      - tailscale_state:/var/lib/tailscale
      - /dev/net/tun:/dev/net/tun
    cap_add:
      - NET_ADMIN
      - NET_RAW
    restart: unless-stopped
```

**Alternativa simple:** instalar `tailscale` directamente en VPS host (no en container), backend usa `extra_hosts` para resolver `mssql.local → 100.87.222.50`:

```yaml
ingenio-backend:
  extra_hosts:
    - "corona-mssql:100.87.222.50"
  environment:
    - MSSQL_HOST=corona-mssql
```

**Decisión a tomar Día 1** según preferencia operacional. Tailscale en host VPS = más simple.

---

## 12. Estructura backend NestJS recomendada

```
backend/
├── src/
│   ├── main.ts                  # bootstrap
│   ├── app.module.ts
│   ├── config/
│   │   ├── env.validation.ts    # zod validation
│   │   └── env.ts               # tipado config
│   ├── modules/
│   │   ├── webhooks/
│   │   │   ├── webhooks.module.ts
│   │   │   ├── webhooks.controller.ts   # POST /api/webhooks/n8n/*
│   │   │   ├── webhooks.service.ts
│   │   │   └── dto/
│   │   ├── guardia/
│   │   │   ├── guardia.module.ts
│   │   │   ├── guardia.controller.ts    # GET /api/guardia/*
│   │   │   ├── guardia.service.ts
│   │   │   └── shift-cache.service.ts
│   │   ├── metrics/
│   │   │   ├── metrics.controller.ts    # GET /api/metrics/snapshot
│   │   │   └── metrics.service.ts
│   │   ├── alerts/
│   │   ├── mssql/
│   │   │   ├── mssql.module.ts
│   │   │   ├── mssql.service.ts         # pool + queries SELECT only
│   │   │   └── queries/
│   │   │       ├── gas-previo.sql
│   │   │       └── paradas-previo.sql
│   │   ├── supabase/
│   │   │   ├── supabase.module.ts
│   │   │   └── supabase.service.ts      # service role client
│   │   └── health/
│   │       └── health.controller.ts
│   └── common/
│       ├── guards/
│       │   └── webhook-secret.guard.ts
│       ├── interceptors/
│       │   ├── logging.interceptor.ts
│       │   └── rate-limit.interceptor.ts
│       ├── filters/
│       │   └── all-exceptions.filter.ts
│       └── validators/
│           └── zod.pipe.ts
├── test/
├── Dockerfile
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## 13. Comandos útiles VPS

```bash
# Ver logs en vivo
docker compose -f infra/docker-compose.yml logs -f --tail=100 ingenio-backend
docker compose -f infra/docker-compose.yml logs -f --tail=100 ingenio-frontend

# Reiniciar solo backend
docker compose -f infra/docker-compose.yml restart ingenio-backend

# Rebuild sin cache
docker compose -f infra/docker-compose.yml build --no-cache ingenio-frontend
docker compose -f infra/docker-compose.yml up -d --force-recreate ingenio-frontend

# Ver Traefik routers para confirmar SSL
docker exec -it traefik traefik healthcheck
curl -s http://localhost:8080/api/http/routers | jq '.[].name'

# Exec into container
docker exec -it ingenio-backend sh
docker exec -it ingenio-frontend sh

# Ver uso recursos
docker stats ingenio-backend ingenio-frontend

# Backup envvars actuales del container
docker exec ingenio-backend env | grep -v "_KEY\|PASSWORD\|SECRET" > /tmp/backend-env-snapshot.txt
```

---

## 14. Plantilla `.env.production` lista para copiar al VPS

```bash
# =============================================================================
# COPIAR ESTE BLOQUE EN /opt/ingenio-cloud/.env DEL VPS
# Llenar valores marcados con ⚠
# =============================================================================

# Dominio
DOMAIN_NAME=ingcloud.srv878399.hstgr.cloud                  # ⚠ confirmar dominio final

# Supabase (compartido con stack supabase_network existente)
SUPABASE_URL=http://kong:8000
NEXT_PUBLIC_SUPABASE_URL=https://supabase.ingcloud.srv878399.hstgr.cloud
NEXT_PUBLIC_SUPABASE_ANON_KEY=                # ⚠ desde Supabase Studio
SUPABASE_SERVICE_ROLE_KEY=                    # ⚠ desde Supabase Studio
SUPABASE_JWT_SECRET=                          # ⚠ desde .env supabase
DB_HOST=supabase-db
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=                                  # ⚠ POSTGRES_PASSWORD supabase
DB_DATABASE=postgres

# JWT
JWT_SECRET=                                   # ⚠ openssl rand -hex 64
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Webhooks
N8N_WEBHOOK_SECRET=                           # ⚠ openssl rand -hex 32
MILL_SPEED_WEBHOOK_SECRET=                    # ⚠ openssl rand -hex 32

# MSSQL CORONA (acceso via Tailscale en host VPS)
MSSQL_HOST=192.168.0.177
MSSQL_PORT=1433
MSSQL_DATABASE=CORONA
MSSQL_USER=fs1
MSSQL_PASSWORD=                               # ⚠ ASK humano
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true

# HTTP externo molienda
MOLIENDA_HTTP_URL=                            # ⚠ URL real
MOLIENDA_HTTP_AUTH=                           # ⚠ si aplica

# IA APIs
OPENAI_API_KEY=                               # ⚠
ANTHROPIC_API_KEY=                            # ⚠ opc
GOOGLE_AI_API_KEY=                            # ⚠ opc

# Comms
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=                            # ⚠ desde Evolution stack
RESEND_API_KEY=                               # ⚠ opc
MAIL_FROM=alertas@ingcloud.srv878399.hstgr.cloud

# Observabilidad (Sprint 1+)
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://langfuse.ingcloud.srv878399.hstgr.cloud

# Defaults
NEXT_PUBLIC_APP_NAME=Ingenio Cloud
NEXT_PUBLIC_DEFAULT_TENANT_SLUG=lacorona
NEXT_PUBLIC_DEFAULT_PLANT_SLUG=planta-sur
```

---

## 15. Checklist pre-deploy producción

### Antes del primer `docker compose up`

- [ ] Subdominio `ingcloud.srv878399.hstgr.cloud` activo en Hostinger srv878399 (✓ confirmado)
- [ ] DNS subdominio principal resuelve a IP VPS (✓ por defecto Hostinger lo asigna)
- [ ] Subdominio `api.ingcloud.srv878399.hstgr.cloud` apunta a VPS (CNAME a ingcloud.srv878399.hstgr.cloud o A record)
- [ ] Subdominios derivados futuros: `langfuse.ingcloud.srv878399.hstgr.cloud`, `agent.ingcloud.srv878399.hstgr.cloud`, `supabase.ingcloud.srv878399.hstgr.cloud`
- [ ] Nota: en Hostinger srv-format el redirect www no aplica (no hay www en subdominios srv) — se puede omitir router `ingenio-www`
- [ ] Redes `n8n_evoapi` y `supabase_network` existen en Docker
- [ ] Traefik del stack existente está corriendo y tiene `mytlschallenge` certresolver configurado
- [ ] Supabase self-hosted está corriendo y accesible en `supabase-db:5432` desde otros containers de la red
- [ ] `.env` completo con todas las credenciales reales
- [ ] Tailscale instalado en VPS host para acceso MSSQL CORONA (o VPN alternativa)
- [ ] Backup strategy configurada (snapshot VPS + pg_dump Supabase a B2)
- [ ] Healthcheck endpoint `/health` responde en backend
- [ ] Healthcheck endpoint `/api/health` responde en frontend

### Durante deploy

- [ ] `docker compose build` sin errores
- [ ] `docker compose up -d` levanta sin restart loops
- [ ] Logs backend muestran "Listening on 3001" + "Connected to MSSQL" + "Supabase ready"
- [ ] Logs frontend muestran "Ready in Xms"
- [ ] `curl -I https://api.ingcloud.srv878399.hstgr.cloud/health` → 200 OK con SSL válido
- [ ] `curl -I https://ingcloud.srv878399.hstgr.cloud` → 200 OK
- [ ] `curl -I https://www.ingcloud.srv878399.hstgr.cloud` → 301 a sin-www
- [ ] Realtime Supabase subscribe funcional desde browser

### Post-deploy

- [ ] Login funcional
- [ ] Dashboard carga con datos seed
- [ ] Webhook test con payload válido → BD actualiza → panel refleja
- [ ] Webhook test con secret inválido → 401
- [ ] Métricas Realtime updating sin recargar página
- [ ] KPIs guardia cargan + cache valid hasta próximo turno
- [ ] TV mode `/tv` fullscreen funciona
- [ ] PWA mobile installable
- [ ] Sin errores en console browser
- [ ] Lighthouse > 85 producción

---

## 16. Stack de red completo del VPS (referencia)

```
┌─────────────────────────────────────────────────────────────┐
│ VPS HOST                                                    │
│                                                             │
│ ┌──── Tailscale (acceso MSSQL CORONA via LAN) ───────────┐ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌──── Traefik (proxy global, externo) ───────────────────┐ │
│ │  → resolve mytlschallenge Let's Encrypt                 │ │
│ │  → ingcloud.srv878399.hstgr.cloud → ingenio-frontend:3000             │ │
│ │  → api.ingcloud.srv878399.hstgr.cloud → ingenio-backend:3001          │ │
│ │  → langfuse.ingcloud.srv878399.hstgr.cloud → langfuse-web (futuro)    │ │
│ │  → supabase.ingcloud.srv878399.hstgr.cloud → kong (Supabase API)      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌──── Red Docker: n8n_evoapi (compartida con stack n8n) ─┐ │
│ │  - ingenio-backend                                      │ │
│ │  - ingenio-frontend                                     │ │
│ │  - n8n                                                  │ │
│ │  - evolution-api                                        │ │
│ │  - traefik                                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌──── Red Docker: supabase_network ──────────────────────┐ │
│ │  - ingenio-backend (cross-network)                      │ │
│ │  - supabase-db                                          │ │
│ │  - kong, gotrue, realtime, storage-api, studio          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 17. Migración Sprint 1+ (agregar agente Python)

Cuando llegue Sprint 1 con Vigía Mesh, agregamos servicio sin tocar lo existente:

```yaml
# infra/docker-compose.yml — APPEND
  ingenio-agent:
    build:
      context: ../agent
      dockerfile: Dockerfile
    container_name: ingenio-agent
    restart: always
    environment:
      - PYTHON_ENV=production
      - PORT=8000
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - INFLUXDB_URL=${INFLUXDB_URL}
      - INFLUXDB_TOKEN=${INFLUXDB_TOKEN}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - LANGFUSE_PUBLIC_KEY=${LANGFUSE_PUBLIC_KEY}
      - LANGFUSE_SECRET_KEY=${LANGFUSE_SECRET_KEY}
    labels:
      - traefik.enable=true
      - traefik.docker.network=n8n_evoapi
      - traefik.http.routers.ingenio-agent.rule=Host(`agent.${DOMAIN_NAME}`)
      - traefik.http.routers.ingenio-agent.tls=true
      - traefik.http.routers.ingenio-agent.entrypoints=web,websecure
      - traefik.http.routers.ingenio-agent.tls.certresolver=mytlschallenge
      - traefik.http.services.ingenio-agent.loadbalancer.server.port=8000
    networks:
      - n8n_evoapi
      - supabase_network
```

Cero disrupción al stack existente. Estructura escalable.

---

**Volver al índice:** [`README.md`](./README.md)
