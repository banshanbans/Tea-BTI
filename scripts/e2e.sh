#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  docker compose down
  rm -f ".data/tea-bti-e2e-$$.db"
}
trap cleanup EXIT

export DATABASE_URL="sqlite:////data/tea-bti-e2e-$$.db"
export AI_MODE="mock"
docker compose down
docker compose build
docker compose run --rm web npm ci
docker compose up --detach

for _ in $(seq 1 60); do
  if curl --silent --fail http://localhost:8000/healthz >/dev/null && curl --silent --fail http://localhost:3000 >/dev/null; then
    npm --workspace apps/web run test:e2e
    exit 0
  fi
  sleep 1
done

echo "Tea-BTI 开发服务未在 60 秒内就绪" >&2
exit 1
