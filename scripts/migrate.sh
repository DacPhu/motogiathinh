#!/usr/bin/env bash
# migrate.sh — run alembic schema migrations + old-system data migration on server
# Reads credentials from .deploy.env
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

LOCAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

B='\033[1m'; G='\033[0;32m'; N='\033[0m'
info() { echo -e "${G}▶ $*${N}"; }
die()  { echo -e "\033[0;31m✗ $*\033[0m" >&2; exit 1; }
step() { echo -e "\n${B}━━ $* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"; }

if [[ -n "${VPS_PASS:-}" ]]; then
  command -v sshpass >/dev/null || die "sshpass not found — brew install hudochenkov/sshpass/sshpass"
  export SSHPASS="${VPS_PASS}"
  SSH_CMD="sshpass -e ssh"
else
  SSH_CMD="ssh"
fi

SSH_OPTS="-p ${VPS_PORT} -o StrictHostKeyChecking=no -o ConnectTimeout=10"

remote_script() { ${SSH_CMD} ${SSH_OPTS} "${VPS_USER}@${VPS_HOST}" bash -s; }
sync_up() { rsync -e "${SSH_CMD} ${SSH_OPTS}" "$@"; }

# ── Validate local data exists ────────────────────────────────────────────────
[[ -d "${LOCAL_ROOT}/crawling/data" ]] || die "crawling/data/ not found — run crawl.py first"
[[ -f "${LOCAL_ROOT}/data-migration/migrate.py" ]] || die "data-migration/migrate.py not found"

# ── Upload files to server ────────────────────────────────────────────────────
step "Uploading crawled data and migration scripts"
remote_script <<SCRIPT
mkdir -p "${REMOTE_DIR}/crawling/data" "${REMOTE_DIR}/data-migration"
SCRIPT

sync_up -az "${LOCAL_ROOT}/crawling/data/"    "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/crawling/data/"
sync_up -az "${LOCAL_ROOT}/data-migration/"   "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/data-migration/"
info "Uploaded $(ls "${LOCAL_ROOT}/crawling/data/"*.json 2>/dev/null | wc -l | tr -d ' ') data files"

# ── Schema migrations ─────────────────────────────────────────────────────────
step "Running schema migrations (alembic)"
remote_script <<SCRIPT
set -euo pipefail
cd "${REMOTE_DIR}"
COMPOSE=\$(docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")
\$COMPOSE exec -T backend alembic upgrade head
echo "  schema up to date"
SCRIPT

# ── Data migration ────────────────────────────────────────────────────────────
step "Running data migration (old system → new DB)"
remote_script <<SCRIPT
set -euo pipefail
cd "${REMOTE_DIR}"
COMPOSE=\$(docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

# Run in a one-off backend container with the data folders mounted
\$COMPOSE run --rm \
  -v "${REMOTE_DIR}/data-migration:/app/data-migration" \
  -v "${REMOTE_DIR}/crawling/data:/app/crawling/data" \
  backend \
  bash -c "pip install -q asyncpg && python /app/data-migration/migrate.py"

echo "  data migration complete"
SCRIPT

echo -e "\n${G}${B}Migration complete.${N}"
