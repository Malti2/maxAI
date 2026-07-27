#!/usr/bin/env bash
# ============================================================
#  maxAI — remote bootstrap
#
#  One command on a fresh Ubuntu/Debian box:
#
#    curl -fsSL https://raw.githubusercontent.com/Malti2/maxAI/master/install.sh | bash
#
#  It installs git and Docker if they are missing, clones (or
#  updates) maxAI into ~/maxAI and then hands over to setup.sh,
#  which asks the remaining questions and starts everything.
#
#  Environment variables:
#    MAXAI_DIR     where to install         (default ~/maxAI)
#    MAXAI_REPO    repository to clone      (default the official one)
#    MAXAI_BRANCH  branch to check out      (default master)
#    MAXAI_ARGS    extra setup.sh arguments (e.g. "--yes --port 8080")
# ============================================================
set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; DIM='\033[2m'; NC='\033[0m'
info() { echo -e "${BLUE}➤${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC} $1" >&2; }

REPO="${MAXAI_REPO:-https://github.com/Malti2/maxAI.git}"
BRANCH="${MAXAI_BRANCH:-master}"
DIR="${MAXAI_DIR:-$HOME/maxAI}"

have() { command -v "$1" >/dev/null 2>&1; }

SUDO=""
if [ "$(id -u)" -ne 0 ] && have sudo; then SUDO="sudo"; fi

echo -e "${BLUE}maxAI${NC} — installing into ${DIM}${DIR}${NC}\n"

# ── Prerequisites ──────────────────────────────────────────
if ! have git || ! have curl; then
  if have apt-get; then
    info "Installing git and curl…"
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq git curl ca-certificates
  else
    err "git and curl are required. Install them and re-run."; exit 1
  fi
fi

if ! have docker; then
  info "Installing Docker…"
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO systemctl enable --now docker 2>/dev/null || true
  if [ -n "$SUDO" ] && [ -n "${USER:-}" ]; then
    $SUDO usermod -aG docker "$USER" 2>/dev/null || true
    warn "Added $USER to the 'docker' group — log out and back in to use Docker without sudo."
  fi
fi
ok "Prerequisites ready"

# ── Clone or update ────────────────────────────────────────
if [ -d "$DIR/.git" ]; then
  info "maxAI already exists — updating it"
  git -C "$DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DIR" checkout -q "$BRANCH"
  git -C "$DIR" reset --hard "origin/${BRANCH}"
else
  info "Cloning maxAI"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$DIR"
fi
ok "Source ready in $DIR"

# ── Hand over to the installer ─────────────────────────────
cd "$DIR"

# When this script is piped into bash, stdin is the script itself — read the
# installer's questions from the terminal instead, and fall back to a fully
# unattended install when there is no terminal at all.
# shellcheck disable=SC2086
if [ -e /dev/tty ] && [ -r /dev/tty ]; then
  bash setup.sh ${MAXAI_ARGS:-} < /dev/tty
else
  warn "No terminal available — running unattended with defaults."
  bash setup.sh --yes ${MAXAI_ARGS:-}
fi
