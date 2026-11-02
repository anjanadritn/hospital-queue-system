#!/usr/bin/env bash
set -e

# Change directory to backend root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

# Ensure production safety defaults
export DEBUG="false"
export RATELIMIT_ENABLED="${RATELIMIT_ENABLED:-true}"
WORKERS="${WEB_CONCURRENCY:-2}"
PORT="${PORT:-5000}"

echo "[INFO] Starting Gunicorn server with $WORKERS workers on port $PORT..."
echo "[INFO] RATELIMIT_ENABLED=$RATELIMIT_ENABLED, DEBUG=$DEBUG"

exec gunicorn "app:app" \
  --workers "$WORKERS" \
  --bind "0.0.0.0:$PORT" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -

