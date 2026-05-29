#!/usr/bin/env bash
# Rollback instantáneo a la última versión estable (imágenes :stable que dejó deploy.sh).
# No rebuildeа: restaura las imágenes y reinicia. El branch de desarrollo queda intacto.
set -euo pipefail

cd "$(dirname "$0")/.."   # raíz del repo

BACK=ingenio-cloud/backend
FRONT=ingenio-cloud/frontend

if ! docker image inspect "$BACK:stable" >/dev/null 2>&1; then
  echo "ERROR: no existe $BACK:stable. ¿Corriste scripts/deploy.sh antes? Sin backup no hay rollback automático." >&2
  exit 1
fi

echo "==> Restaurando imágenes estables (:stable -> :latest)"
docker tag "$BACK:stable"  "$BACK:latest"
docker tag "$FRONT:stable" "$FRONT:latest"

echo "==> Levantando versión estable (sin rebuild)"
docker compose up -d --no-build ingenio-backend ingenio-frontend

echo
echo "==> Rollback hecho. Versión estable corriendo. El branch de desarrollo sigue intacto para corregir."
docker compose ps ingenio-backend ingenio-frontend
