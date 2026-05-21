#!/usr/bin/env bash
# bootstrap.sh — provision a fresh Debian/Ubuntu VPS for motogiathinh
# Run via: make bootstrap
set -euo pipefail

# ── Load .deploy.env ──────────────────────────────────────────────────────────
_DEPLOY_ENV="$(cd "$(dirname "$0")/.." && pwd)/.deploy.env"
_load_var() {
  local var="$1"
  if [[ -z "${!var:-}" ]] && [[ -f "$_DEPLOY_ENV" ]]; then
    local val
    val=$(grep -E "^${var}=" "$_DEPLOY_ENV" | head -1 | cut -d= -f2- | tr -d "\"'") || val=""
    [[ -n "$val" ]] && export "$var"="$val"
  fi
}
_load_var VPS_HOST; _load_var VPS_USER; _load_var VPS_PASS
_load_var VPS_PORT; _load_var REMOTE_DIR

VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/motogiathinh}"

[[ -z "${VPS_HOST:-}" ]] && { echo "VPS_HOST not set in .deploy.env"; exit 1; }

B='\033[1m'; G='\033[0;32m'; N='\033[0m'
step() { echo -e "\n${B}━━ $* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"; }

if [[ -n "${VPS_PASS:-}" ]]; then
  command -v sshpass >/dev/null || { echo "sshpass not found — brew install hudochenkov/sshpass/sshpass"; exit 1; }
  export SSHPASS="${VPS_PASS}"
  SSH_CMD="sshpass -e ssh"
else
  SSH_CMD="ssh"
fi

SSH_OPTS="-p ${VPS_PORT} -o StrictHostKeyChecking=no -o ConnectTimeout=10"

remote_script() {
  ${SSH_CMD} ${SSH_OPTS} "${VPS_USER}@${VPS_HOST}" bash -s
}

# ── Install Docker ────────────────────────────────────────────────────────────
step "Installing Docker + Compose plugin"
remote_script <<'SCRIPT'
set -euo pipefail

if command -v docker &>/dev/null; then
  echo "  Docker already installed: $(docker --version)"
else
  echo "  Installing Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable --now docker
  echo "  Docker installed: $(docker --version)"
  echo "  Compose: $(docker compose version)"
fi
SCRIPT

# ── Install dependencies ──────────────────────────────────────────────────────
step "Installing system dependencies"
remote_script <<'SCRIPT'
set -euo pipefail
apt-get install -y -qq unzip curl git
echo "  unzip: $(unzip -v | head -1)"
echo "  git:   $(git --version)"
SCRIPT

# ── Create directories ────────────────────────────────────────────────────────
step "Creating directories"
remote_script <<SCRIPT
set -euo pipefail
mkdir -p /opt/ci_projects "${REMOTE_DIR}"
echo "  Created /opt/ci_projects and ${REMOTE_DIR}"
SCRIPT

echo -e "\n${G}${B}Bootstrap complete — ready for: make deploy${N}"
