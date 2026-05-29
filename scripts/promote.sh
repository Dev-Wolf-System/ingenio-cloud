#!/usr/bin/env bash
# Promover la versión actual (:latest) a línea base estable (:stable).
# Correr SOLO después de validar que el deploy nuevo anda OK en la sala.
# A partir de acá, rollback.sh volvería a ESTA versión.
set -euo pipefail

BACK=ingenio-cloud/backend
FRONT=ingenio-cloud/frontend

docker tag "$BACK:latest"  "$BACK:stable"
docker tag "$FRONT:latest" "$FRONT:stable"
echo "==> Línea base actualizada: :latest -> :stable. Esta versión es ahora el punto de retorno."
