#!/usr/bin/env bash
# ============================================================
#  maxAI — one-command installer
#
#  Installs Docker (if needed), generates all secrets, walks you
#  through a few settings, then builds, starts and health-checks
#  the stack. Designed for a fresh Ubuntu/Debian server, but
#  works on any host with Docker.
#
#  Non-interactive example (CI, cloud-init, re-installs):
#    bash setup.sh --yes --port 8080 --admin-email me@example.com \
#      --ai-base-url https://api.openai.com/v1 --ai-api-key sk-…
# ============================================================
set -euo pipefail

YELLOW='\033[1;33m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; DIM='\033[2m'; NC='\033[0m'
info()  { echo -e "${BLUE}➤${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $1"; }
err()   { echo -e "${RED}✗${NC} $1" >&2; }

cd "$(dirname "$0")"

# ── Arguments ──────────────────────────────────────────────
ASSUME_YES=0
NO_START=0
ARG_PORT=""; ARG_URL=""; ARG_ADMIN_EMAIL=""; ARG_ADMIN_PASSWORD=""
ARG_AI_BASE_URL=""; ARG_AI_API_KEY=""
ARG_MODEL_LITE=""; ARG_MODEL_PRO=""; ARG_MODEL_BEAST=""

usage() {
  cat <<'USAGE'
maxAI installer

Usage: bash setup.sh [options]

Options:
  -y, --yes                 Don't ask anything; use defaults / the values given below
      --port <port>         Port maxAI is served on (default 80)
      --url <url>           Public URL users open (default http://<host-ip>[:port])
      --admin-email <mail>  Admin account (the only account that can open the admin area)
      --admin-password <pw> Admin password (default: generated and printed once)
      --ai-base-url <url>   Chat-Completions-compatible API base URL
      --ai-api-key <key>    API key for that endpoint
      --model-lite <name>   Model requested for the Lite tier
      --model-pro <name>    Model requested for the Pro tier
      --model-beast <name>  Model requested for the Beast tier
      --no-start            Only write .env, don't build or start anything
  -h, --help                Show this help

Existing values in .env are kept as defaults, so re-running is safe.
Environment variables of the same name (PORT, ADMIN_EMAIL, AI_API_KEY, …) are
also picked up, which makes unattended installs easy.
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=1 ;;
    --no-start) NO_START=1 ;;
    --port) ARG_PORT="${2:-}"; shift ;;
    --url) ARG_URL="${2:-}"; shift ;;
    --admin-email) ARG_ADMIN_EMAIL="${2:-}"; shift ;;
    --admin-password) ARG_ADMIN_PASSWORD="${2:-}"; shift ;;
    --ai-base-url) ARG_AI_BASE_URL="${2:-}"; shift ;;
    --ai-api-key) ARG_AI_API_KEY="${2:-}"; shift ;;
    --model-lite) ARG_MODEL_LITE="${2:-}"; shift ;;
    --model-pro) ARG_MODEL_PRO="${2:-}"; shift ;;
    --model-beast) ARG_MODEL_BEAST="${2:-}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown option: $1"; echo; usage; exit 1 ;;
  esac
  shift
done

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║            maxAI · installer         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}\n"

# ── Helpers ────────────────────────────────────────────────
have() { command -v "$1" >/dev/null 2>&1; }
# Interactive only when there is a terminal to ask on and --yes was not given.
interactive() { [ "$ASSUME_YES" -eq 0 ] && [ -t 0 ]; }

SUDO=""
if [ "$(id -u)" -ne 0 ] && have sudo; then SUDO="sudo"; fi

gen_secret() {
  # $1 = number of random bytes
  if have openssl; then openssl rand -hex "$1"; else
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

read_env() { [ -f .env ] && grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- || true; }

# Resolve a value: CLI flag → environment → existing .env → built-in default.
resolve() {
  local flag="$1" name="$2" fallback="${3:-}"
  if [ -n "$flag" ]; then printf '%s' "$flag"; return; fi
  local from_env="${!name:-}"
  if [ -n "$from_env" ]; then printf '%s' "$from_env"; return; fi
  local from_file; from_file="$(read_env "$name")"
  if [ -n "$from_file" ]; then printf '%s' "$from_file"; return; fi
  printf '%s' "$fallback"
}

# prompt VAR "Question" "default" [secret]
prompt() {
  local __var="$1" __q="$2" __def="${3:-}" __secret="${4:-}" __input=""
  if ! interactive; then
    printf -v "$__var" '%s' "$__def"
    return
  fi
  if [ "$__secret" = "secret" ]; then
    read -rs -p "$(echo -e "  ${__q} ${DIM}${__def:+[keep existing]}${NC}: ")" __input; echo
  else
    read -r -p "$(echo -e "  ${__q}${__def:+ ${DIM}[${__def}]${NC}}: ")" __input
  fi
  printf -v "$__var" '%s' "${__input:-$__def}"
}

port_in_use() {
  local port="$1"
  if have ss; then ss -ltn 2>/dev/null | grep -qE "[:.]${port}[[:space:]]"; return $?; fi
  if have lsof; then lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; return $?; fi
  return 1
}

# ── 1. Docker ──────────────────────────────────────────────
DOCKER="docker"
if [ "$NO_START" -eq 1 ]; then
  info "Configuration only (--no-start): skipping the Docker check"
else
  if ! have docker; then
    warn "Docker is not installed."
    if interactive; then
      read -r -p "  Install Docker now? [Y/n]: " yn; yn=${yn:-Y}
    else yn=Y; fi
    if [[ "$yn" =~ ^[Yy] ]]; then
      info "Installing Docker…"
      curl -fsSL https://get.docker.com | $SUDO sh
      $SUDO systemctl enable --now docker 2>/dev/null || true
    else
      err "Docker is required. Aborting."; exit 1
    fi
  fi

  # Use sudo for docker if the current user can't reach the daemon.
  if ! docker info >/dev/null 2>&1; then
    if [ -n "$SUDO" ] && $SUDO docker info >/dev/null 2>&1; then
      DOCKER="$SUDO docker"
      warn "Using sudo for Docker. Tip: 'sudo usermod -aG docker \$USER', then log in again to drop sudo."
    else
      err "Cannot talk to the Docker daemon. Is it running?  (sudo systemctl start docker)"; exit 1
    fi
  fi

  # The Compose plugin ships separately on Debian/Ubuntu — install it instead of
  # sending the user off to read documentation.
  if ! $DOCKER compose version >/dev/null 2>&1; then
    warn "The Docker Compose plugin is missing."
    if have apt-get; then
      info "Installing docker-compose-plugin…"
      $SUDO apt-get update -qq && $SUDO apt-get install -y -qq docker-compose-plugin || true
    fi
  fi
  if ! $DOCKER compose version >/dev/null 2>&1; then
    err "Docker Compose is still unavailable. Install the 'docker-compose-plugin' package and re-run."
    exit 1
  fi
  ok "Docker is ready"
fi

# ── 2. Secrets (generated once, preserved on re-runs) ──────
POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"; POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(gen_secret 24)}"
JWT_SECRET="$(read_env JWT_SECRET)";               JWT_SECRET="${JWT_SECRET:-$(gen_secret 64)}"
ENCRYPTION_KEY="$(read_env ENCRYPTION_KEY)";        ENCRYPTION_KEY="${ENCRYPTION_KEY:-$(gen_secret 32)}"
ok "Secrets ready"

# ── 3. Configuration ───────────────────────────────────────
echo -e "\n${BLUE}Basic settings${NC}"
PORT_DEF="$(resolve "$ARG_PORT" PORT 80)"
prompt PORT "Port to serve maxAI on" "$PORT_DEF"

URL_DEF="$(resolve "$ARG_URL" FRONTEND_URL "")"
if [ -z "$URL_DEF" ]; then
  HOSTIP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [ "$PORT" = "80" ]; then URL_DEF="http://${HOSTIP:-localhost}"; else URL_DEF="http://${HOSTIP:-localhost}:${PORT}"; fi
fi
prompt FRONTEND_URL "Public URL (how you'll reach the app)" "$URL_DEF"

echo -e "\n${BLUE}Admin account${NC} ${DIM}(only this email can open the admin area)${NC}"
prompt ADMIN_EMAIL "Admin email" "$(resolve "$ARG_ADMIN_EMAIL" ADMIN_EMAIL "")"
ADMIN_PASSWORD="$(resolve "$ARG_ADMIN_PASSWORD" ADMIN_PASSWORD "")"
if [ -z "$ADMIN_PASSWORD" ]; then
  prompt ADMIN_PASSWORD "Admin password (blank = generate)" "" secret
  if [ -z "$ADMIN_PASSWORD" ]; then ADMIN_PASSWORD="$(gen_secret 9)"; GENERATED_PW=1; fi
fi

echo -e "\n${BLUE}AI provider${NC} ${DIM}(any Chat-Completions-compatible endpoint; leave blank to add later in Settings → Admin)${NC}"
prompt AI_BASE_URL "API base URL" "$(resolve "$ARG_AI_BASE_URL" AI_BASE_URL https://api.openai.com/v1)"
prompt AI_API_KEY "API key" "$(resolve "$ARG_AI_API_KEY" AI_API_KEY "")" secret
prompt AI_MODEL_LITE  "Model · Lite"  "$(resolve "$ARG_MODEL_LITE" AI_MODEL_LITE gpt-4o-mini)"
prompt AI_MODEL_PRO   "Model · Pro"   "$(resolve "$ARG_MODEL_PRO" AI_MODEL_PRO gpt-4o)"
prompt AI_MODEL_BEAST "Model · Beast" "$(resolve "$ARG_MODEL_BEAST" AI_MODEL_BEAST gpt-4o)"

# Keep whatever web-search configuration is already there (defaults are fine).
WEB_SEARCH_ENABLED="$(resolve "" WEB_SEARCH_ENABLED true)"
WEB_SEARCH_READER_URL="$(resolve "" WEB_SEARCH_READER_URL https://r.jina.ai/)"
WEB_SEARCH_WIKI_LANGS="$(resolve "" WEB_SEARCH_WIKI_LANGS de,en)"

if [ "$NO_START" -eq 0 ] && port_in_use "$PORT"; then
  warn "Port ${PORT} is already in use. If that's an old maxAI, this is fine — otherwise pick another port."
fi

# ── 4. Write .env ──────────────────────────────────────────
info "Writing .env"
umask 077
cat > .env <<EOF
# Generated by setup.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
POSTGRES_DB=maxai
POSTGRES_USER=maxai
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

NODE_ENV=production
PORT=${PORT}
FRONTEND_URL=${FRONTEND_URL}
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30

# Admin (only this account can open the admin area; created on first boot)
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# AI provider (editable later in Settings → Admin)
AI_BASE_URL=${AI_BASE_URL}
AI_API_KEY=${AI_API_KEY}
AI_MODEL_LITE=${AI_MODEL_LITE}
AI_MODEL_PRO=${AI_MODEL_PRO}
AI_MODEL_BEAST=${AI_MODEL_BEAST}

# Web search (keyless: DuckDuckGo + Wikipedia, pages read through a text reader)
WEB_SEARCH_ENABLED=${WEB_SEARCH_ENABLED}
WEB_SEARCH_READER_URL=${WEB_SEARCH_READER_URL}
WEB_SEARCH_WIKI_LANGS=${WEB_SEARCH_WIKI_LANGS}
EOF
ok ".env written"

if [ "$NO_START" -eq 1 ]; then
  if [ "${GENERATED_PW:-0}" = "1" ]; then
    echo -e "\n   Admin password: ${YELLOW}${ADMIN_PASSWORD}${NC}  ${DIM}(auto-generated — save it now)${NC}"
  fi
  echo -e "\n${GREEN}✓ Configuration written.${NC} Start maxAI with: ${BLUE}./maxai start${NC}"
  exit 0
fi

# ── 5. Build & start ───────────────────────────────────────
info "Building and starting containers (this can take a few minutes)…"
$DOCKER compose up -d --build

# ── 6. Wait until it actually answers ──────────────────────
info "Waiting for maxAI to become healthy…"
HEALTHY=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 3 "http://localhost:${PORT}/health" >/dev/null 2>&1; then HEALTHY=1; break; fi
  sleep 3
done

if [ "$HEALTHY" -eq 1 ]; then
  echo -e "\n${GREEN}✅ maxAI is running!${NC}"
else
  echo
  warn "maxAI did not report healthy within 3 minutes. Recent logs:"
  $DOCKER compose logs --tail 40 backend || true
  echo -e "\n  ${DIM}Full logs:${NC} ./maxai logs"
fi

echo -e "   Open: ${BLUE}${FRONTEND_URL}${NC}"
echo -e "\n   Admin login:"
echo -e "     email:    ${YELLOW}${ADMIN_EMAIL:-<not set>}${NC}"
if [ "${GENERATED_PW:-0}" = "1" ]; then
  echo -e "     password: ${YELLOW}${ADMIN_PASSWORD}${NC}  ${DIM}(auto-generated — save it now)${NC}"
else
  echo -e "     password: ${DIM}(the one you entered)${NC}"
fi
if [ -z "${AI_API_KEY}" ]; then
  echo -e "\n   ${YELLOW}No API key set yet.${NC} Sign in and add it under ${BLUE}Settings → Admin${NC}."
fi
echo -e "\n   ${DIM}Manage maxAI:${NC} ./maxai status ${DIM}·${NC} ./maxai logs ${DIM}·${NC} ./maxai update ${DIM}·${NC} ./maxai backup"
echo -e "   ${DIM}For HTTPS, put maxAI behind a TLS-terminating reverse proxy (see README).${NC}"
