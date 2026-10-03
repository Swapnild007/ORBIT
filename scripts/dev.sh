#!/usr/bin/env bash
set -euo pipefail

# Start unified backend server
echo "[dev] Starting Eagle Eye backend on :4000..."
bun run server/index.ts &
BACKEND_PID=$!

cleanup() {
  echo "[dev] Shutting down backend (pid $BACKEND_PID)..."
  kill "$BACKEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for the backend to be listening (up to 10s)
for i in $(seq 1 40); do
  if lsof -iTCP:4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "[dev] Backend is up."
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "[dev] Backend exited unexpectedly." >&2
    exit 1
  fi
  sleep 0.25
done

if ! lsof -iTCP:4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "[dev] Timed out waiting for backend." >&2
  exit 1
fi

# Start Vite (foreground — Ctrl-C kills it, then cleanup runs)
echo "[dev] Starting Vite..."
exec npx vite
