#!/usr/bin/env bash
# ============================================================
#  Shuacha backend - one-click start (FastAPI + uvicorn)
#  - single instance: skip if already ready on :8000
#  - auto-open http://localhost:8000/docs once ready
# ============================================================
set -e
PORT=8000
URL="http://localhost:$PORT"
DIR="$(dirname "$0")/apps/api"

open_browser() {
  ( start "$1" >/dev/null 2>&1 || open "$1" >/dev/null 2>&1 || xdg-open "$1" >/dev/null 2>&1 ) &
}

# ---- 1. check for an already-running instance ----
if curl -s --max-time 2 "$URL/health" >/dev/null 2>&1; then
    echo "[already running] backend is up at $URL, opening docs."
    open_browser "$URL/docs"
    exit 0
fi

# ---- 2. start backend in background ----
echo "starting backend at $URL ..."
cd "$DIR"
python -m uvicorn main:app --host 0.0.0.0 --port "$PORT" --reload &
PID=$!

# ---- 3. wait until ready (up to 20s) ----
for _ in $(seq 1 20); do
    sleep 1
    if curl -s --max-time 2 "$URL/health" >/dev/null 2>&1; then break; fi
done

echo "backend ready, opening $URL/docs"
open_browser "$URL/docs"

wait "$PID"
