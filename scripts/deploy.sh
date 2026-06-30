#!/usr/bin/env bash
# deploy.sh — build frontend locally, zip artifacts, rsync to VPS, docker up
#
# Reads credentials from .deploy.env (gitignored) or environment variables.
# Required: VPS_HOST   Optional: VPS_USER, VPS_PASS, VPS_PORT, REMOTE_DIR
set -euo pipefail

# ── Load .deploy.env ──────────────────────────────────────────────────────────
_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
_DEPLOY_ENV="${DEPLOY_ENV_FILE:-${_ROOT}/.deploy.env}"
_load_var() {
  local var="$1"
  if [[ -z "${!var:-}" ]] && [[ -f "$_DEPLOY_ENV" ]]; then
    local val
    val=$(grep -E "^${var}=" "$_DEPLOY_ENV" | head -1 | cut -d= -f2- | tr -d "\"'") || val=""
    [[ -n "$val" ]] && export "$var"="$val" || true
  fi
}
_load_var VPS_HOST
_load_var VPS_USER
_load_var VPS_PASS
_load_var VPS_PORT
_load_var REMOTE_DIR
_load_var LOCAL_ENV_FILE

VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/motogiathinh}"
REMOTE_ZIP_DIR="${REMOTE_ZIP_DIR:-/opt/ci_projects}"

SSH_TARGET="${VPS_USER}@${VPS_HOST:-}"
LOCAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${LOCAL_ROOT}/build"
ZIP_NAME="motogiathinh-$(date +%Y%m%d-%H%M%S).zip"
ZIP_PATH="${BUILD_DIR}/${ZIP_NAME}"

# ── Colors ────────────────────────────────────────────────────────────────────
B='\033[1m'; G='\033[0;32m'; Y='\033[0;33m'; R='\033[0;31m'; N='\033[0m'
info() { echo -e "${G}▶ $*${N}"; }
warn() { echo -e "${Y}⚠ $*${N}"; }
die()  { echo -e "${R}✗ $*${N}" >&2; exit 1; }
step() { echo -e "\n${B}━━ $* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"; }

# ── SSH helpers ───────────────────────────────────────────────────────────────
SSH_CONTROL="/tmp/ssh-ctl-$$"
# ControlMaster multiplexing is intentionally OFF — it fails on Git Bash / MSYS
# (mux_client_request_session: Connection reset). With key auth there are no
# repeated password prompts, so per-command connections cost nothing meaningful.
SSH_BASE="-p ${VPS_PORT} -o StrictHostKeyChecking=no -o ConnectTimeout=10"

# Prefer the dedicated SSH key when present — sshpass mangles passwords on some
# platforms (Git Bash / MSYS pty), so key auth is the reliable path. Fall back
# to sshpass password auth only when no key exists.
_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/id_ed25519_motogiathinh}"
if [[ -f "$_SSH_KEY" ]]; then
  SSH_BASE="${SSH_BASE} -o IdentitiesOnly=yes -i ${_SSH_KEY}"
  SSH_CMD="ssh"
elif [[ -n "${VPS_PASS:-}" ]]; then
  command -v sshpass >/dev/null || die "sshpass not found — brew install hudochenkov/sshpass/sshpass"
  export SSHPASS="${VPS_PASS}"
  SSH_CMD="sshpass -e ssh"
else
  SSH_CMD="ssh"
fi

trap 'rm -f "${SSH_CONTROL}"' EXIT

remote() {
  ${SSH_CMD} ${SSH_BASE} "${SSH_TARGET}" "$@"
}

remote_script() {
  ${SSH_CMD} ${SSH_BASE} "${SSH_TARGET}" bash -s
}

# File transfer via scp (rsync not available on all dev machines). Takes
# a local path and a user@host:remote target, same as the rsync calls below.
# SCP_CMD wraps sshpass the same way SSH_CMD does.
if [[ -f "$_SSH_KEY" ]]; then
  SCP_CMD="scp"
elif [[ -n "${VPS_PASS:-}" ]]; then
  SCP_CMD="sshpass -e scp"
else
  SCP_CMD="scp"
fi
# scp uses -P for port (lowercase -p means "preserve times"), so SSH_BASE
# (which has -p) can't be reused verbatim — translate it.
SCP_BASE="-P ${VPS_PORT} -o StrictHostKeyChecking=no -o ConnectTimeout=10"
[[ -f "$_SSH_KEY" ]] && SCP_BASE="${SCP_BASE} -o IdentitiesOnly=yes -i ${_SSH_KEY}"
sync_to_server() {
  # Drop rsync-style flags (-az / -a / -z); scp takes a recursive -r instead.
  local args=()
  for a in "$@"; do
    case "$a" in
      -az|-a|-z) ;;                  # rsync archive/compress flags — no scp equivalent needed
      *) args+=("$a") ;;
    esac
  done
  ${SCP_CMD} ${SCP_BASE} "${args[@]}"
}

# ── Preflight ─────────────────────────────────────────────────────────────────
step "Preflight"
[[ -z "${VPS_HOST:-}" ]] && die "VPS_HOST not set — add it to .deploy.env"
command -v scp    >/dev/null || die "scp not found"
command -v zip    >/dev/null || die "zip not found"
remote "exit 0" || die "Cannot reach ${SSH_TARGET}"
info "Target: ${SSH_TARGET}:${REMOTE_DIR}"

# ── Prepare build dir ─────────────────────────────────────────────────────────
step "Preparing build artifacts"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}/frontend" "${BUILD_DIR}/backend" "${BUILD_DIR}/nginx" "${BUILD_DIR}/ocr_service"

# Backend: full source (docker builds it on server)
cp -r "${LOCAL_ROOT}/backend/." "${BUILD_DIR}/backend/"

# OCR service: full source (docker builds it on server)
cp -r "${LOCAL_ROOT}/ocr_service/." "${BUILD_DIR}/ocr_service/"

# Frontend: Babel-in-browser stack — copy raw source. nginx Dockerfile +
# nginx.conf live inside frontend/ already; no build step.
cp -r "${LOCAL_ROOT}/frontend/." "${BUILD_DIR}/frontend/"

# Nginx and compose files
cp "${LOCAL_ROOT}/nginx/nginx.conf"   "${BUILD_DIR}/nginx/nginx.conf"
cp "${LOCAL_ROOT}/docker-compose.yml" "${BUILD_DIR}/docker-compose.yml"
[[ -f "${LOCAL_ROOT}/docker-compose.prod.yml" ]] && \
  cp "${LOCAL_ROOT}/docker-compose.prod.yml" "${BUILD_DIR}/docker-compose.prod.yml"

info "Build dir ready"

# ── Zip ───────────────────────────────────────────────────────────────────────
step "Zipping → ${ZIP_NAME}"
(
  cd "${BUILD_DIR}"
  zip -qr "${ZIP_PATH}" . \
    --exclude "*.zip" \
    --exclude "*/__pycache__/*" \
    --exclude "*.pyc" \
    --exclude "*/celerybeat-schedule*"
)
info "Created: $(du -sh "${ZIP_PATH}" | cut -f1)"

# ── Upload ────────────────────────────────────────────────────────────────────
step "Uploading to ${SSH_TARGET}"
remote "mkdir -p ${REMOTE_ZIP_DIR}"
sync_to_server -az "${ZIP_PATH}" "${SSH_TARGET}:${REMOTE_ZIP_DIR}/${ZIP_NAME}"
info "Uploaded → ${REMOTE_ZIP_DIR}/${ZIP_NAME}"

# ── Unzip ─────────────────────────────────────────────────────────────────────
step "Unzipping on server"
remote_script <<SCRIPT
set -euo pipefail
rm -rf "${REMOTE_DIR}"
mkdir -p "${REMOTE_DIR}"
unzip -q "${REMOTE_ZIP_DIR}/${ZIP_NAME}" -d "${REMOTE_DIR}"
echo "  unzipped to ${REMOTE_DIR}"
ls -t "${REMOTE_ZIP_DIR}"/*.zip 2>/dev/null | tail -n +6 | xargs -r rm --
echo "  old zips cleaned"
SCRIPT

# ── Upload .env (only if server doesn't have one yet) ─────────────────────────
step "Syncing .env"
# LOCAL_ENV_FILE allows staging to upload .env.staging as .env on the server
LOCAL_APP_ENV="${LOCAL_ROOT}/${LOCAL_ENV_FILE:-.env}"
if remote "test -f ${REMOTE_DIR}/.env" 2>/dev/null; then
  info ".env exists on server, keeping existing"
elif [[ -f "${LOCAL_APP_ENV}" ]]; then
  sync_to_server -az "${LOCAL_APP_ENV}" "${SSH_TARGET}:${REMOTE_DIR}/.env"
  info "Uploaded ${LOCAL_APP_ENV} → server .env"
else
  die "No .env on server and no local env file found (${LOCAL_APP_ENV}) — create it before deploying"
fi

# ── Start containers ──────────────────────────────────────────────────────────
step "Starting containers"
remote_script <<SCRIPT
set -euo pipefail
cd "${REMOTE_DIR}"
COMPOSE=\$(docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")
if [ -f docker-compose.prod.yml ]; then
  \$COMPOSE -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans
else
  \$COMPOSE up -d --build --remove-orphans
fi
# Restart nginx so it re-resolves upstream container IPs after recreation
\$COMPOSE restart nginx
SCRIPT

# ── DB migrations ─────────────────────────────────────────────────────────────
step "Running migrations"
remote_script <<SCRIPT
set -euo pipefail
cd "${REMOTE_DIR}"
COMPOSE=\$(docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")
\$COMPOSE exec -T backend alembic upgrade head
echo "  migrations done"
SCRIPT

# ── Cleanup & health check ────────────────────────────────────────────────────
remote "docker image prune -f" 2>/dev/null || true

step "Health check"
sleep 5
remote_script <<SCRIPT
cd "${REMOTE_DIR}"
COMPOSE=\$(docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")
\$COMPOSE ps
SCRIPT

# ── Frontend version sanity ───────────────────────────────────────────────────
# Print the deployed data-loader.js line count + first-line header so future
# stale-deploy bugs (like Phase 11) are visible in the deploy log.
step "Frontend version"
remote_script <<SCRIPT
echo "  data-loader.js: \$(wc -l < ${REMOTE_DIR}/frontend/data-loader.js) lines"
echo "  first line: \$(head -1 ${REMOTE_DIR}/frontend/data-loader.js)"
SCRIPT

echo -e "\n${G}${B}Deploy complete — ${SSH_TARGET}${N}"
