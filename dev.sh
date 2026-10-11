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
# Fail fast contract: every step that can hang (a port that never opens, a health
# check that keeps answering 500, a package manager waiting on a prompt) has a
# deadline plus a process-liveness check, and every failure prints the actual
# cause before exiting non-zero. A silent wait here is a bug in this script.
#
# Stopping is driven by which process holds the port, not by saved PIDs.
# A saved PID is unreliable here: "cd dir && cmd &" backgrounds a wrapper
# subshell, so $! is the wrapper, not the server. Killing the wrapper leaves the
# real server running and holding the port, which makes a restart silently talk
# to the old process.

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
LOGS="$ROOT/.dev-logs"

BACKEND_PORT=4000
FRONTEND_PORT=5173

BACKEND_LOG="$LOGS/backend.log"
FRONTEND_LOG="$LOGS/frontend.log"
PRISMA_LOG="$LOGS/prisma-generate.log"

# Lines that mean "this server is never going to come up". They let a wait give
# up in about a second and quote the real cause instead of burning the timeout.
FATAL_RE="EADDRINUSE|Address already in use|Cannot find module|ERR_MODULE_NOT_FOUND|SyntaxError|error TS[0-9]+|Can't reach database server|PrismaClientInitializationError|ECONNREFUSED|Allowed origins is not set|Missing required|failed to load config"

# ---------------------------------------------------------------------------
# output helpers
# ---------------------------------------------------------------------------

IS_TTY=0
if [ -t 1 ]; then IS_TTY=1; fi

if [ "$IS_TTY" = 1 ]; then
  C_RESET=$'\033[0m'; C_RED=$'\033[31m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'; C_DIM=$'\033[2m'
else
  C_RESET=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_DIM=''
fi

info() { printf '%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf '%s ok %s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%swarn%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
fail() { printf '%sFAIL%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }
note() { printf '     %s%s%s\n' "$C_DIM" "$*" "$C_RESET" >&2; }

# A single line that overwrites itself, so a slow start looks like progress
# instead of a frozen terminal.
progress() {
  if [ "$IS_TTY" = 1 ]; then
    printf '\r\033[K%s   %s%s' "$C_DIM" "$*" "$C_RESET"
  fi
  return 0
}

clear_progress() {
  if [ "$IS_TTY" = 1 ]; then
    printf '\r\033[K'
  fi
  return 0
}

# ---------------------------------------------------------------------------
# log helpers
# ---------------------------------------------------------------------------

# Last N lines of a file.
last_lines() {
  awk -v n="$2" '{ buf[NR % n] = $0 } END {
    start = NR - n + 1
    if (start < 1) start = 1
    for (i = start; i <= NR; i++) print buf[i % n]
  }' "$1"
}

# First line in the log that looks fatal, if any. A real error message starts at
# column zero, while stack frames and code excerpts are indented, so prefer the
# unindented match and only fall back to an indented one.
first_fatal_line() {
  local hit
  hit="$(grep -m1 -E "^[^[:space:]].*($FATAL_RE)" "$1" 2>/dev/null || true)"
  if [ -z "$hit" ]; then
    hit="$(grep -m1 -E "$FATAL_RE" "$1" 2>/dev/null || true)"
  fi
  printf '%s' "$hit"
}

# The useful part of a server log: the error-looking lines when there are any,
# otherwise just the end of the log.
explain_log() {
  local file="$1" lines
  if [ ! -s "$file" ]; then
    return 0
  fi

  lines="$(grep -E "$FATAL_RE" "$file" 2>/dev/null | awk '!seen[$0]++' | awk 'NR<=10' || true)"
  if [ -n "$lines" ]; then
    warn "errors in $file:"
  else
    warn "last lines of $file:"
    lines="$(last_lines "$file" 12)"
  fi

  printf '%s\n' "$lines" | sed 's/^/    /'
}

# Report and exit without touching anything (used before servers exist, so
# there is no log worth dumping yet).
abort() {
  fail "$*"
  exit 1
}

# Report, dump what the servers logged, clean up, and exit non-zero.
die() {
  clear_progress
  fail "$*"
  explain_log "$BACKEND_LOG"
  explain_log "$FRONTEND_LOG"
  echo
  info "stopping anything that did start"
  stop_all >/dev/null 2>&1 || true
  exit 1
}

# Any command that fails without an explicit check lands here with its line
# number, instead of the script just stopping. A command killed by a signal is
# not a failure, it is the user interrupting us, so it shuts down cleanly.
on_error() {
  local status="$1" line="$2" cmd="$3"
  trap - ERR
  if [ "$status" -ge 128 ]; then
    cleanup
  fi
  die "unexpected failure at dev.sh:$line (exit $status): $cmd"
}

# Ctrl+C, a TERM, or a terminal going away: stop everything and exit cleanly.
# Defined before the signal traps are installed so an early Ctrl+C still works.
cleanup() {
  trap - INT TERM HUP ERR
  echo
  info "shutting down"
  if stop_all; then
    ok "stopped, ports are free"
  else
    warn "a process is still holding a port, run ./dev.sh --stop"
  fi
  exit 0
}

# ---------------------------------------------------------------------------
# process discovery
# ---------------------------------------------------------------------------

# PIDs listening on a TCP port. This is the authoritative answer to "what is
# serving this port", independent of how it was launched.
pids_on_port() {
  ss -ltnp 2>/dev/null | grep -F ":$1 " | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true
}

port_busy() {
  local pids
  pids="$(pids_on_port "$1")"
  if [ -n "$pids" ]; then
    return 0
  fi
  return 1
}

pgid_of() {
  ps -o pgid= -p "$1" 2>/dev/null | tr -d ' ' || true
}

# Kills a process and all of its descendants, children first so nothing is
# reparented and left behind.
kill_tree() {
  local pid="$1" child
  if [ -z "$pid" ]; then
    return 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done

  # A negative PID reaches the whole process group, but only if the target is
  # actually a group leader. Otherwise -PID means some other group, or nothing.
  if [ "$(pgid_of "$pid")" = "$pid" ]; then
    kill -TERM "-$pid" 2>/dev/null || true
  else
    kill -TERM "$pid" 2>/dev/null || true
  fi
}

# Waits for every PID on a port to be gone, escalating to SIGKILL.
kill_port() {
  local port="$1" name="$2" pids pid waited=0
  pids="$(pids_on_port "$port")"
  if [ -z "$pids" ]; then
    return 0
  fi

  info "stopping $name on port $port (pid: $(echo "$pids" | tr '\n' ' '))"

  for pid in $pids; do
    kill_tree "$pid"
  done

  while [ "$waited" -lt 20 ]; do
    if ! port_busy "$port"; then
      return 0
    fi
    sleep 0.25
    waited=$((waited + 1))
  done

  warn "$name did not exit on SIGTERM, sending SIGKILL"
  for pid in $(pids_on_port "$port"); do
    if [ "$(pgid_of "$pid")" = "$pid" ]; then
      kill -KILL "-$pid" 2>/dev/null || true
    else
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
  sleep 1

  if port_busy "$port"; then
    return 1
  fi
  return 0
}

# Unique process group IDs of anything running from this project's dependency
# trees. Needed because "tsx watch" keeps supervising after its child dies, so an
# orphaned supervisor can survive while holding no port, and the port sweep alone
# would never see it. The current script's own group is excluded so this can
# never take down the shell that invoked it.
project_pgids() {
  local own_pgid pid pgid
  own_pgid="$(pgid_of $$)"

  for pid in $(pgrep -f "$ROOT/backend|$ROOT/frontend" 2>/dev/null || true); do
    pgid="$(pgid_of "$pid")"
    if [ -z "$pgid" ]; then continue; fi
    if [ "$pgid" = "$own_pgid" ]; then continue; fi
    echo "$pgid"
  done | sort -u
}

stop_all() {
  local rc=0 pgid waited=0
  kill_port "$BACKEND_PORT" "backend" || rc=1
  kill_port "$FRONTEND_PORT" "frontend" || rc=1

  # Sweep anything left from this project that is not holding a port.
  for pgid in $(project_pgids); do
    info "stopping leftover project process group $pgid"
    kill -TERM "-$pgid" 2>/dev/null || true
  done

  while [ "$waited" -lt 12 ] && [ -n "$(project_pgids)" ]; do
    sleep 0.25
    waited=$((waited + 1))
  done
  for pgid in $(project_pgids); do
    kill -KILL "-$pgid" 2>/dev/null || true
  done

  return $rc
}

# ---------------------------------------------------------------------------
# readiness probes
# ---------------------------------------------------------------------------

# Set by http_probe so the progress line can show what the server answered.
PROBE_NOTE=''

http_probe() {
  local code
  PROBE_NOTE=''
  if code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "$1" 2>/dev/null)"; then
    :
  else
    code="000"
  fi

  case "$code" in
    2*) PROBE_NOTE="HTTP $code"; return 0 ;;
    000) PROBE_NOTE="no response"; return 1 ;;
    *) PROBE_NOTE="HTTP $code"; return 1 ;;
  esac
}

# Waits for a probe to succeed, and gives up the moment waiting is pointless.
#
#   wait_for <label> <timeout-seconds> <watch-pid|-> <log-file|-> -- <probe...>
#
# Stops early when the watched process dies or when the log contains a known
# fatal line, so a broken start reports the cause in about a second instead of
# sitting silently until the timeout.
wait_for() {
  local label="$1" timeout="$2" watch="$3" logfile="$4"
  shift 4
  if [ "${1:-}" = "--" ]; then shift; fi

  local started elapsed tick=0 strikes=0 fatal note
  started="$(date +%s)"
  PROBE_NOTE=''

  while :; do
    if "$@" >/dev/null 2>&1; then
      clear_progress
      return 0
    fi

    elapsed=$(( $(date +%s) - started ))

    # The process we launched is gone, so the port will never open.
    if [ "$watch" != "-" ]; then
      if ! kill -0 "$watch" 2>/dev/null; then
        die "$label failed: the process exited before it became ready"
      fi
    fi

    # The log already says what is wrong, so stop waiting and quote it.
    fatal=''
    if [ "$logfile" != "-" ]; then
      fatal="$(first_fatal_line "$logfile")"
    fi
    if [ -n "$fatal" ]; then
      strikes=$((strikes + 1))
      if [ "$strikes" -ge 2 ]; then
        die "$label failed: $fatal"
      fi
    else
      strikes=0
    fi

    if [ "$elapsed" -ge "$timeout" ]; then
      die "$label did not become ready within ${timeout}s"
    fi

    note=''
    if [ -n "$PROBE_NOTE" ]; then note=" [$PROBE_NOTE]"; fi
    tick=$((tick + 1))
    if [ "$IS_TTY" = 1 ]; then
      progress "$label: ${elapsed}s${note}"
    elif [ $((tick % 20)) -eq 0 ]; then
      info "$label: still waiting (${elapsed}s${note})"
    fi

    sleep 0.5
  done
}

# Launches a server in its own session, in the background, with stdin closed so
# that anything asking a question (npx, vite, tsx) fails instead of hanging
# forever on a prompt nobody can answer.
LAUNCHED_PID=''
launch() {
  local dir="$1" logfile="$2"
  shift 2
  ( cd "$dir" && exec setsid "$@" ) </dev/null >"$logfile" 2>&1 &
  LAUNCHED_PID=$!
}

tcp_reachable() {
  timeout 3 bash -c "exec 3<>/dev/tcp/${1}/${2}" 2>/dev/null
}

require_cmds() {
  local missing='' c
  for c in "$@"; do
    if ! command -v "$c" >/dev/null 2>&1; then
      missing="$missing $c"
    fi
  done
  if [ -n "$missing" ]; then
    fail "missing required command(s):$missing"
    note "install them and run ./dev.sh again"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# --stop / --status
# ---------------------------------------------------------------------------

require_cmds ss pgrep ps awk sed grep tr cut sort date sleep mkdir timeout

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

trap 'on_error "$?" "$LINENO" "$BASH_COMMAND"' ERR
trap cleanup INT TERM HUP

require_cmds node npm npx pnpm curl setsid

if [ ! -d "$BACKEND" ]; then
  abort "backend directory not found at $BACKEND"
fi
if [ ! -d "$FRONTEND" ]; then
  abort "frontend directory not found at $FRONTEND"
fi

if [ ! -f "$BACKEND/.env" ]; then
  fail "backend/.env is missing, and the backend reads all of its config from it"
  note "create it with: cp $BACKEND/.env.example $BACKEND/.env"
  exit 1
fi

if [ ! -d "$BACKEND/node_modules" ]; then
  fail "backend dependencies are not installed"
  note "run: cd $BACKEND && npm ci"
  exit 1
fi
if [ ! -d "$FRONTEND/node_modules" ]; then
  fail "frontend dependencies are not installed"
  note "run: cd $FRONTEND && pnpm install"
  exit 1
fi

mkdir -p "$LOGS"

# Anything already on these ports would make this run look like it started while
# the browser still talks to the old process, so clear it out first.
if port_busy "$BACKEND_PORT" || port_busy "$FRONTEND_PORT"; then
  warn "a previous run is still holding a port, clearing it"
  stop_all || die "could not free ports $BACKEND_PORT and $FRONTEND_PORT"
  ok "ports cleared"
fi

# The generated Prisma client is gitignored, so a fresh clone has none. Every
# backend route imports it and the server dies on boot without it.
if [ ! -f "$BACKEND/src/generated/prisma/client.ts" ]; then
  info "generating the Prisma client (first run)"
  if ! ( cd "$BACKEND" && CI=1 timeout 300 npx --yes prisma generate </dev/null >"$PRISMA_LOG" 2>&1 ); then
    fail "npx prisma generate failed"
    explain_log "$PRISMA_LOG"
    exit 1
  fi
fi
ok "prisma client present"

# /health queries MySQL, so a database that is not up turns into a 500 and a
# server that never becomes "ready". Check it here, before anything starts.
DB_URL="$(sed -n 's/^[[:space:]]*DATABASE_URL[[:space:]]*=[[:space:]]*//p' "$BACKEND/.env" | awk 'NR==1 { print $1 }' | tr -d "\"'" || true)"
if [ -z "$DB_URL" ]; then
  warn "DATABASE_URL is not set in backend/.env, skipping the database check"
else
  DB_HOST_PORT="${DB_URL##*@}"
  DB_HOST_PORT="${DB_HOST_PORT%%/*}"
  DB_HOST="${DB_HOST_PORT%%:*}"
  if [ "$DB_HOST_PORT" = "$DB_HOST" ]; then
    DB_PORT=3306
  else
    DB_PORT="${DB_HOST_PORT##*:}"
  fi

  if [ -z "$DB_HOST" ] || [ "${DB_HOST#\[}" != "$DB_HOST" ]; then
    warn "could not parse a host out of DATABASE_URL, skipping the database check"
  elif ! tcp_reachable "$DB_HOST" "$DB_PORT"; then
    fail "database at $DB_HOST:$DB_PORT is not accepting connections"
    note "the backend serves /health from MySQL, so it cannot come up without it"
    note "start it with: cd $BACKEND && docker compose up -d mysql_db"
    exit 1
  else
    ok "database reachable at $DB_HOST:$DB_PORT"
  fi
fi

# ---------------------------------------------------------------------------
# start
# ---------------------------------------------------------------------------

# Truncate the logs now that the run is really starting, so a failure can never
# dump stale output from a previous run as if it were the cause.
: >"$BACKEND_LOG"
: >"$FRONTEND_LOG"

info "starting the backend on :$BACKEND_PORT"
launch "$BACKEND" "$BACKEND_LOG" npm run dev
BACKEND_PID="$LAUNCHED_PID"
wait_for "backend port $BACKEND_PORT" 60 "$BACKEND_PID" "$BACKEND_LOG" -- port_busy "$BACKEND_PORT"
wait_for "backend /health" 60 "$BACKEND_PID" "$BACKEND_LOG" -- http_probe "http://localhost:$BACKEND_PORT/health"
ok "backend up -> http://localhost:$BACKEND_PORT"

info "starting the frontend on :$FRONTEND_PORT"
launch "$FRONTEND" "$FRONTEND_LOG" pnpm dev --port "$FRONTEND_PORT" --strictPort
FRONTEND_PID="$LAUNCHED_PID"
wait_for "frontend port $FRONTEND_PORT" 90 "$FRONTEND_PID" "$FRONTEND_LOG" -- port_busy "$FRONTEND_PORT"
# Going through the dev server proves the Vite /api proxy is wired up, not just
# that the backend itself is alive.
wait_for "vite /api proxy" 60 "$FRONTEND_PID" "$FRONTEND_LOG" -- http_probe "http://localhost:$FRONTEND_PORT/api/health"
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

# Watch the ports rather than saved PIDs: if either server dies, its port stops
# being served and this notices. The log excerpt says why it died.
supervise() {
  info "watching both servers, Ctrl+C stops everything"
  while :; do
    sleep 1
    if ! port_busy "$BACKEND_PORT"; then
      fail "the backend stopped (port $BACKEND_PORT is no longer served)"
      explain_log "$BACKEND_LOG"
      stop_all >/dev/null 2>&1 || true
      exit 1
    fi
    if ! port_busy "$FRONTEND_PORT"; then
      fail "the frontend stopped (port $FRONTEND_PORT is no longer served)"
      explain_log "$FRONTEND_LOG"
      stop_all >/dev/null 2>&1 || true
      exit 1
    fi
  done
}

supervise
