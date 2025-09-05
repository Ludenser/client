#!/usr/bin/env bash
set -euo pipefail

IMAGE="ludenser/vk_comments_exporter:latest"
CONTAINER="vkcomments"
PORT="8080"

echo "[1/3] Pull image: $IMAGE"
docker pull "$IMAGE"

echo "[2/3] Stop & remove old container (if exists)"
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  docker rm -f "$CONTAINER" || true
fi

echo "[3/3] Run new container"
docker run -d --name "$CONTAINER" --restart unless-stopped -p ${PORT}:8080 "$IMAGE"

echo "Done. Health check: curl http://localhost:${PORT}/api/health"


