#!/usr/bin/env bash
# deploy.sh — build frontend locally, zip artifacts, rsync to VPS, docker up
#
# Reads credentials from .deploy.env (gitignored) or environment variables.
# Required: VPS_HOST   Optional: VPS_USER, VPS_PASS, VPS_PORT, REMOTE_DIR
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
_load_var VPS_HOST
_load_var VPS_USER
_load_var VPS_PASS
_load_var VPS_PORT
_load_var REMOTE_DIR
_load_var VITE_API_BASE_URL

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
SSH_BASE="-p ${VPS_PORT} -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o ControlMaster=auto -o ControlPath=${SSH_CONTROL} -o ControlPersist=120"

if [[ -n "${VPS_PASS:-}" ]]; then
  command -v sshpass >/dev/null || die "sshpass not found — brew install hudochenkov/sshpass/sshpass"
  export SSHPASS="${VPS_PASS}"
  SSH_CMD="sshpass -e ssh"
else
  SSH_CMD="ssh"
fi

trap '${SSH_CMD} ${SSH_BASE} -O exit ${SSH_TARGET} 2>/dev/null || true; rm -f "${SSH_CONTROL}"' EXIT

remote() {
  ${SSH_CMD} ${SSH_BASE} "${SSH_TARGET}" "$@"
}

remote_script() {
  ${SSH_CMD} ${SSH_BASE} "${SSH_TARGET}" bash -s
}

# rsync always uses SSH_CMD as the transport (one sshpass layer only)
sync_to_server() {
  rsync -e "${SSH_CMD} ${SSH_BASE}" "$@"
}

# ── Preflight ─────────────────────────────────────────────────────────────────
step "Preflight"
[[ -z "${VPS_HOST:-}" ]] && die "VPS_HOST not set — add it to .deploy.env"
command -v rsync  >/dev/null || die "rsync not found"
command -v node   >/dev/null || die "node not found"
command -v npm    >/dev/null || die "npm not found"
command -v zip    >/dev/null || die "zip not found"
remote "exit 0" || die "Cannot reach ${SSH_TARGET}"
info "Target: ${SSH_TARGET}:${REMOTE_DIR}"

# ── Build frontend ────────────────────────────────────────────────────────────
step "Building frontend"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-/api/v1}"
info "VITE_API_BASE_URL=${VITE_API_BASE_URL}"
(
  cd "${LOCAL_ROOT}/frontend"
  npm install --silent
  VITE_API_BASE_URL="${VITE_API_BASE_URL}" npm run build
)
info "Frontend built → frontend/dist/"

# ── Prepare build dir ─────────────────────────────────────────────────────────
step "Preparing build artifacts"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}/frontend" "${BUILD_DIR}/backend" "${BUILD_DIR}/nginx"

# Backend: full source (docker builds it on server)
cp -r "${LOCAL_ROOT}/backend/." "${BUILD_DIR}/backend/"

# Frontend: pre-built dist + slim Dockerfile (skips npm install on server)
cp -r "${LOCAL_ROOT}/frontend/dist"     "${BUILD_DIR}/frontend/dist"
cp    "${LOCAL_ROOT}/frontend/nginx.conf" "${BUILD_DIR}/frontend/nginx.conf"
FRONTEND_BUILD_TIME="$(date +%Y%m%d%H%M%S)"
cat > "${BUILD_DIR}/frontend/Dockerfile" <<DOCKERFILE
FROM nginx:alpine
ARG BUILD_TIME=${FRONTEND_BUILD_TIME}
RUN echo "\${BUILD_TIME}" > /dev/null
RUN rm -rf /usr/share/nginx/html/*
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
DOCKERFILE

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
if remote "test -f ${REMOTE_DIR}/.env" 2>/dev/null; then
  info ".env exists on server, keeping existing"
elif [[ -f "${LOCAL_ROOT}/.env" ]]; then
  sync_to_server -az "${LOCAL_ROOT}/.env" "${SSH_TARGET}:${REMOTE_DIR}/.env"
  info "Uploaded local .env to server"
else
  die "No .env on server and no local .env found — create .env before deploying"
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

echo -e "\n${G}${B}Deploy complete — ${SSH_TARGET}${N}"
