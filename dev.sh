#!/usr/bin/env bash
#
# dev.sh - start the Layap backend and frontend together for local development.
#
#   ./dev.sh          start both servers, Ctrl+C stops everything
#   ./dev.sh --stop   stop both servers (by port, so nothing survives)
#   ./dev.sh --status show what is currently listening
#
# Backend  -> http://localhost:4000   (Express + Prisma, hot reload via tsx watch)
# Frontend -> http://localhost:5173   (Vite dev server, proxies /api to the backend)
#
# Logs go to .dev-logs/ so a crash after startup is still readable.
#
# Stopping is driven by which process holds the port, not by saved PIDs.
# A saved PID is unreliable here: "cd dir && cmd &" backgrounds a wrapper
# subshell, so $! is the wrapper, not the server. Killing the wrapper leaves the
# real server running and holding the port, which makes a restart silently talk
# to the old process.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
LOGS="$ROOT/.dev-logs"

BACKEND_PORT=4000
FRONTEND_PORT=5173

BACKEND_LOG="$LOGS/backend.log"
FRONTEND_LOG="$LOGS/frontend.log"

# ---------------------------------------------------------------------------
# output helpers
# ---------------------------------------------------------------------------

if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_RED=$'\033[31m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'; C_DIM=$'\033[2m'
else
  C_RESET=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_DIM=''
fi

info() { printf '%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf '%s ok %s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%swarn%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
fail() { printf '%sFAIL%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }

die() {
  fail "$*"
  echo
  if [ -f "$BACKEND_LOG" ]; then
    warn "last lines of $BACKEND_LOG:"
    tail -n 15 "$BACKEND_LOG" | sed 's/^/    /'
  fi
  if [ -f "$FRONTEND_LOG" ]; then
    warn "last lines of $FRONTEND_LOG:"
    tail -n 15 "$FRONTEND_LOG" | sed 's/^/    /'
  fi
  stop_all >/dev/null 2>&1
  exit 1
}

# ---------------------------------------------------------------------------
# process discovery
# ---------------------------------------------------------------------------

# PIDs listening on a TCP port. This is the authoritative answer to "what is
# serving this port", independent of how it was launched.
pids_on_port() {
  ss -ltnp 2>/dev/null | grep ":$1 " | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u
}

port_busy() {
  [ -n "$(pids_on_port "$1")" ]
}

# Kills a process and all of its descendants, children first so nothing is
# reparented and left behind.
kill_tree() {
  local pid="$1"
  [ -z "$pid" ] && return 0
  kill -0 "$pid" 2>/dev/null || return 0

  local child
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill_tree "$child"
  done

  # Negative PID reaches the whole process group when the target is a group
  # leader (which setsid makes it). Falls back to the single PID.
  kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
}

# Waits for every PID on a port to be gone, escalating to SIGKILL.
kill_port() {
  local port="$1" name="$2"
  local pids
  pids="$(pids_on_port "$port")"
  [ -z "$pids" ] && return 0

  info "stopping $name on port $port (pid: $(echo "$pids" | tr '\n' ' '))"

  local pid
  for pid in $pids; do
    kill_tree "$pid"
  done

  local waited=0
  while [ "$waited" -lt 20 ]; do
    port_busy "$port" || return 0
    sleep 0.25
    waited=$((waited + 1))
  done

  warn "$name did not exit on SIGTERM, sending SIGKILL"
  for pid in $(pids_on_port "$port"); do
    kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
  done
  sleep 1

  port_busy "$port" && return 1
  return 0
}

# Unique process group IDs of anything running from this project's dependency
# trees. Needed because "tsx watch" keeps supervising after its child dies, so an
# orphaned supervisor can survive while holding no port, and the port sweep alone
# would never see it. The current script's own group is excluded so this can
# never take down the shell that invoked it.
project_pgids() {
  local own_pgid pid pgid
  own_pgid="$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ')"

  for pid in $(pgrep -f "$ROOT/backend|$ROOT/frontend" 2>/dev/null); do
    pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')"
    [ -z "$pgid" ] && continue
    [ "$pgid" = "$own_pgid" ] && continue
    echo "$pgid"
  done | sort -u
}

stop_all() {
  local rc=0
  kill_port "$BACKEND_PORT" "backend" || rc=1
  kill_port "$FRONTEND_PORT" "frontend" || rc=1

  # Sweep anything left from this project that is not holding a port.
  local pgid
  for pgid in $(project_pgids); do
    info "stopping leftover project process group $pgid"
    kill -TERM "-$pgid" 2>/dev/null
  done

  local waited=0
  while [ "$waited" -lt 12 ] && [ -n "$(project_pgids)" ]; do
    sleep 0.25
    waited=$((waited + 1))
  done
  for pgid in $(project_pgids); do
    kill -KILL "-$pgid" 2>/dev/null
  done

  return $rc
}

# Waits for a port to accept connections.
wait_for_port() {
  local port="$1" name="$2" timeout="${3:-60}"
  local waited=0
  while [ "$waited" -lt "$timeout" ]; do
    port_busy "$port" && return 0
    sleep 1
    waited=$((waited + 1))
  done
  die "$name never started listening on port $port (waited ${timeout}s)"
}

# Waits for an HTTP endpoint to answer.
wait_for_http() {
  local url="$1" name="$2" timeout="${3:-60}"
  local waited=0
  while [ "$waited" -lt "$timeout" ]; do
    if curl -fsS -o /dev/null --max-time 3 "$url" 2>/dev/null; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  die "$name never answered $url (waited ${timeout}s)"
}

# ---------------------------------------------------------------------------
# --stop / --status
# ---------------------------------------------------------------------------

case "${1:-}" in
  --stop|stop)
    info "stopping dev servers"
    if stop_all; then
      ok "stopped, ports $BACKEND_PORT and $FRONTEND_PORT are free"
      exit 0
    fi
    fail "something is still holding a port, check with: ss -ltnp | grep -E ':(4000|5173)'"
    exit 1
    ;;
  --status|status)
    for entry in "backend:$BACKEND_PORT" "frontend:$FRONTEND_PORT"; do
      name="${entry%%:*}"; port="${entry##*:}"
      pids="$(pids_on_port "$port")"
      if [ -n "$pids" ]; then
        ok "$name is listening on $port (pid: $(echo "$pids" | tr '\n' ' '))"
      else
        warn "$name is not running (port $port free)"
      fi
    done
    exit 0
    ;;
esac

# ---------------------------------------------------------------------------
# preflight
# ---------------------------------------------------------------------------

command -v node >/dev/null 2>&1 || die "node is not on PATH"
command -v curl >/dev/null 2>&1 || die "curl is not on PATH"

[ -d "$BACKEND" ]  || die "backend directory not found at $BACKEND"
[ -d "$FRONTEND" ] || die "frontend directory not found at $FRONTEND"

mkdir -p "$LOGS"

# Anything already on these ports would make this run look like it started while
# the browser still talks to the old process, so clear it out first.
if port_busy "$BACKEND_PORT" || port_busy "$FRONTEND_PORT"; then
  warn "a previous run is still holding a port, clearing it"
  stop_all || die "could not free ports $BACKEND_PORT and $FRONTEND_PORT"
  ok "ports cleared"
fi

[ -f "$BACKEND/.env" ] || warn "backend/.env is missing, the backend will likely fail to start"

# The generated Prisma client is gitignored, so a fresh clone has none. Every
# backend route imports it and the server dies on boot without it.
if [ ! -f "$BACKEND/src/generated/prisma/client.ts" ]; then
  info "generating Prisma client (first run)"
  ( cd "$BACKEND" && npx prisma generate ) || die "npx prisma generate failed"
fi
ok "prisma client present"

# ---------------------------------------------------------------------------
# start
# ---------------------------------------------------------------------------

info "starting backend on :$BACKEND_PORT"
cd "$BACKEND"
setsid npm run dev >"$BACKEND_LOG" 2>&1 &
cd "$ROOT"

wait_for_port "$BACKEND_PORT" "backend" 60
wait_for_http "http://localhost:$BACKEND_PORT/health" "backend" 60
ok "backend up -> http://localhost:$BACKEND_PORT"

info "starting frontend on :$FRONTEND_PORT"
cd "$FRONTEND"
setsid pnpm dev --port "$FRONTEND_PORT" --strictPort >"$FRONTEND_LOG" 2>&1 &
cd "$ROOT"

wait_for_port "$FRONTEND_PORT" "frontend" 90
# Going through the dev server proves the Vite /api proxy is wired up, not just
# that the backend itself is alive.
wait_for_http "http://localhost:$FRONTEND_PORT/api/health" "vite proxy" 60
ok "frontend up -> http://localhost:$FRONTEND_PORT"

# ---------------------------------------------------------------------------
# done
# ---------------------------------------------------------------------------

cat <<EOF

${C_GREEN}Both servers are running.${C_RESET}

  Frontend   http://localhost:$FRONTEND_PORT
  Backend    http://localhost:$BACKEND_PORT
  Health     http://localhost:$FRONTEND_PORT/api/health

  Logs       $LOGS/backend.log
             $LOGS/frontend.log

  Stop       ./dev.sh --stop        (or Ctrl+C here)
  Status     ./dev.sh --status

${C_DIM}Reminder: backend/.env still has placeholder Gmail credentials, so
password-reset OTP emails will not actually arrive even though the reset
screen reports success.${C_RESET}

EOF

# ---------------------------------------------------------------------------
# supervise
# ---------------------------------------------------------------------------

cleanup() {
  echo
  info "shutting down"
  if stop_all; then
    ok "stopped, ports are free"
  else
    warn "a process is still holding a port, run ./dev.sh --stop"
  fi
  exit 0
}

trap cleanup INT TERM

# Watch the ports rather than saved PIDs: if either server dies, its port stops
# being served and this notices.
while :; do
  sleep 1
  if ! port_busy "$BACKEND_PORT"; then
    fail "backend stopped unexpectedly, see $BACKEND_LOG"
    cleanup
    exit 1
  fi
  if ! port_busy "$FRONTEND_PORT"; then
    fail "frontend stopped unexpectedly, see $FRONTEND_LOG"
    cleanup
    exit 1
  fi
done
