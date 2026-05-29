#!/usr/bin/env bash
# Deploy seguro: respalda las imágenes actuales como :stable, buildeа y levanta lo nuevo.
# Correr en la VPS, desde cualquier ruta (el script se ubica solo en la raíz del repo).
# Si algo falla tras este deploy: scripts/rollback.sh
set -euo pipefail

cd "$(dirname "$0")/.."   # raíz del repo (donde está docker-compose.yml)

BACK=ingenio-cloud/backend
FRONT=ingenio-cloud/frontend

echo "==> 1/3 Respaldando imágenes actuales como :stable (punto de retorno)"
if docker image inspect "$BACK:latest" >/dev/null 2>&1; then
  docker tag "$BACK:latest" "$BACK:stable"
  echo "    backend:latest -> backend:stable"
else
  echo "    (no hay $BACK:latest previo — primer deploy)"
fi
if docker image inspect "$FRONT:latest" >/dev/null 2>&1; then
  docker tag "$FRONT:latest" "$FRONT:stable"
  echo "    frontend:latest -> frontend:stable"
else
  echo "    (no hay $FRONT:latest previo — primer deploy)"
fi

echo "==> 2/3 Build de la versión nueva"
docker compose build ingenio-backend ingenio-frontend

echo "==> 3/3 Levantando versión nueva"
docker compose up -d ingenio-backend ingenio-frontend

echo
echo "==> Deploy hecho. VERIFICÁ la app (ver docs/DEPLOY_ALERTAS.md)."
echo "    Si falla:  scripts/rollback.sh"
docker compose ps ingenio-backend ingenio-frontend
