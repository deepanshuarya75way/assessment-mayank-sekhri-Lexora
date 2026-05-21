#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_LOG="/tmp/lexora_backend.log"
FRONTEND_LOG="/tmp/lexora_frontend.log"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
CHECK_ONLY=false
NO_INSTALL=false
COMPILED=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check-only)
      CHECK_ONLY=true
      shift
      ;;
    --no-install)
      NO_INSTALL=true
      shift
      ;;
    --compiled)
      COMPILED=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./start-dev.sh [--check-only] [--no-install] [--compiled]"
      exit 1
      ;;
  esac
done

info() {
  echo "[lexora] $*"
}

fail() {
  echo "[lexora] ERROR: $*" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Missing required command: $cmd"
}

load_nvm_if_available() {
  if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    return
  fi

  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
  fi
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn | awk '{print $4}' | grep -E "(^|:)${port}$" >/dev/null 2>&1
  else
    return 1
  fi
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local retries="${3:-30}"

  for _ in $(seq 1 "$retries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      info "$name is ready at $url"
      return 0
    fi
    sleep 1
  done

  return 1
}

check_required_files() {
  [[ -d "$BACKEND_DIR" ]] || fail "Missing backend directory"
  [[ -d "$FRONTEND_DIR" ]] || fail "Missing frontend directory"

  [[ -f "$BACKEND_DIR/requirements.txt" ]] || fail "Missing backend/requirements.txt"
  [[ -f "$FRONTEND_DIR/package.json" ]] || fail "Missing frontend/package.json"

  [[ -f "$BACKEND_DIR/.env" ]] || fail "Missing backend/.env"
  [[ -f "$FRONTEND_DIR/.env" || -f "$FRONTEND_DIR/.env.local" ]] || fail "Missing frontend/.env or frontend/.env.local"
}

ensure_backend_venv() {
  if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
    info "Creating backend virtual environment"
    (cd "$BACKEND_DIR" && python3 -m venv .venv)
  fi
}

ensure_backend_deps() {
  if [[ "$NO_INSTALL" == true ]]; then
    info "Skipping backend dependency installation (--no-install)"
    return
  fi

  info "Installing backend dependencies"
  (cd "$BACKEND_DIR" && .venv/bin/pip install -r requirements.txt >/dev/null)
}

ensure_frontend_deps() {
  if [[ "$NO_INSTALL" == true ]]; then
    info "Skipping frontend dependency installation (--no-install)"
  else
    info "Installing frontend dependencies"
    (cd "$FRONTEND_DIR" && npm install >/dev/null)
  fi

  if [[ "$COMPILED" == true ]]; then
    info "Compiling frontend for production build..."
    (cd "$FRONTEND_DIR" && npm run build)
  fi
}

start_backend() {
  info "Starting backend on port $BACKEND_PORT"
  (
    cd "$BACKEND_DIR"
    .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" >"$BACKEND_LOG" 2>&1
  ) &
  BACKEND_PID=$!
}

start_frontend() {
  if [[ "$COMPILED" == true ]]; then
    info "Starting compiled production frontend on port $FRONTEND_PORT"
    (
      cd "$FRONTEND_DIR"
      npm run start -- --port "$FRONTEND_PORT" >"$FRONTEND_LOG" 2>&1
    ) &
  else
    info "Starting frontend on port $FRONTEND_PORT"
    (
      cd "$FRONTEND_DIR"
      npm run dev -- --port "$FRONTEND_PORT" >"$FRONTEND_LOG" 2>&1
    ) &
  fi
  FRONTEND_PID=$!
}

cleanup() {
  info "Shutting down services"
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

main() {
  require_command python3
  require_command curl

  load_nvm_if_available

  require_command node
  require_command npm

  check_required_files

  if port_in_use "$BACKEND_PORT"; then
    fail "Port $BACKEND_PORT is already in use"
  fi
  if port_in_use "$FRONTEND_PORT"; then
    fail "Port $FRONTEND_PORT is already in use"
  fi

  ensure_backend_venv
  ensure_backend_deps
  ensure_frontend_deps

  if [[ "$CHECK_ONLY" == true ]]; then
    info "Checks passed. Exiting because --check-only was provided."
    return 0
  fi

  trap cleanup EXIT INT TERM

  start_backend
  if ! wait_for_http "http://127.0.0.1:${BACKEND_PORT}/health" "Backend" 45; then
    tail -n 60 "$BACKEND_LOG" || true
    fail "Backend did not become ready"
  fi

  start_frontend
  if ! wait_for_http "http://127.0.0.1:${FRONTEND_PORT}" "Frontend" 75; then
    tail -n 60 "$FRONTEND_LOG" || true
    fail "Frontend did not become ready"
  fi

  info "All services started"
  info "Frontend: http://127.0.0.1:${FRONTEND_PORT}"
  info "Backend:  http://127.0.0.1:${BACKEND_PORT}"
  info "Logs: $FRONTEND_LOG and $BACKEND_LOG"
  info "Press Ctrl+C to stop both services"

  wait "$BACKEND_PID" "$FRONTEND_PID"
}

main "$@"
