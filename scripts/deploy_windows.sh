#!/usr/bin/env bash
# deploy_windows.sh — deploy from Windows / git-bash.
#
# Why this exists: git-bash has no rsync, and the sshpass Windows port can't feed
# passwords to the native ssh.exe. So this script uses SSH *key* auth + scp instead.
#
#   First run (you, interactive):  prompts ONCE for the server password to install
#                                  a deploy key, then deploys.
#   Every run after (automatic):   key is already on the server — no password, ever.
#
# Reads VPS_HOST / VPS_USER / VPS_PORT / REMOTE_DIR from .deploy.env (gitignored).
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
_load_var VPS_PORT
_load_var REMOTE_DIR
_load_var LOCAL_ENV_FILE

VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/motogiathinh}"
REMOTE_ZIP_DIR="${REMOTE_ZIP_DIR:-/opt/ci_projects}"

SSH_TARGET="${VPS_USER}@${VPS_HOST:-}"
LOCAL_ROOT="$_ROOT"
BUILD_DIR="${LOCAL_ROOT}/build"
ZIP_NAME="motogiathinh-$(date +%Y%m%d-%H%M%S).zip"
ZIP_PATH="${BUILD_DIR}/${ZIP_NAME}"

# ── Colors ────────────────────────────────────────────────────────────────────
B='\033[1m'; G='\033[0;32m'; Y='\033[0;33m'; R='\033[0;31m'; N='\033[0m'
info() { echo -e "${G}▶ $*${N}"; }
warn() { echo -e "${Y}⚠ $*${N}"; }
die()  { echo -e "${R}✗ $*${N}" >&2; exit 1; }
step() { echo -e "\n${B}━━ $* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"; }

# ── SSH key auth ──────────────────────────────────────────────────────────────
# NOTE: no ControlMaster multiplexing — the Windows OpenSSH port resets the mux
# socket ("Connection reset by peer"), which breaks every multiplexed call. Each
# ssh/scp opens its own connection instead. Key auth makes that cheap & silent.
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519_motogiathinh}"
SSH_BASE="-p ${VPS_PORT} -o StrictHostKeyChecking=no -o ConnectTimeout=10"
# scp wants "-o Port=" instead of "-p"
SCP_BASE="${SSH_BASE/-p /-o Port=}"

SSH_CMD="ssh -i ${SSH_KEY} -o IdentitiesOnly=yes"

remote()        { ${SSH_CMD} ${SSH_BASE} "${SSH_TARGET}" "$@"; }
remote_script() { ${SSH_CMD} ${SSH_BASE} "${SSH_TARGET}" bash -s; }
# Single-file uploads only (replaces rsync). Last two args = SRC DST.
sync_to_server() {
  local src dst; dst="${@: -1}"; src="${@: -2:1}"
  scp -i "${SSH_KEY}" -o IdentitiesOnly=yes ${SCP_BASE} "$src" "$dst"
}

# ── Preflight ─────────────────────────────────────────────────────────────────
step "Preflight"
[[ -z "${VPS_HOST:-}" ]] && die "VPS_HOST not set — add it to .deploy.env"
command -v scp >/dev/null || die "scp not found"
command -v zip >/dev/null || die "zip not found"

# Generate a deploy key the first time.
if [[ ! -f "$SSH_KEY" ]]; then
  info "Generating deploy key → ${SSH_KEY}"
  mkdir -p "$(dirname "$SSH_KEY")"
  ssh-keygen -t ed25519 -N "" -f "$SSH_KEY" -C "motogiathinh-deploy" >/dev/null
fi

# Does key auth already work? (non-interactive probe)
if ${SSH_CMD} ${SSH_BASE} -o BatchMode=yes "${SSH_TARGET}" "exit 0" 2>/dev/null; then
  info "Key auth OK — fully automatic"
else
  step "Installing deploy key on server (one-time)"
  warn "Enter the server password when prompted. This happens ONCE — future deploys won't ask."
  # Plain ssh (password auth) appends the pubkey, then establishes the master socket
  # that every later step reuses — so no second prompt this run either.
  ssh ${SSH_BASE} "${SSH_TARGET}" \
      "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys" < "${SSH_KEY}.pub" \
    || die "Could not install deploy key (wrong password or host unreachable)"
  ${SSH_CMD} ${SSH_BASE} -o BatchMode=yes "${SSH_TARGET}" "exit 0" 2>/dev/null \
    || die "Key installed but auth still failing — check server sshd config"
  info "Deploy key installed — this was the only password prompt you'll ever see"
fi
info "Target: ${SSH_TARGET}:${REMOTE_DIR}"

# ── Prepare build dir ─────────────────────────────────────────────────────────
step "Preparing build artifacts"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}/frontend" "${BUILD_DIR}/backend" "${BUILD_DIR}/nginx" "${BUILD_DIR}/ocr_service"
cp -r "${LOCAL_ROOT}/backend/."     "${BUILD_DIR}/backend/"
cp -r "${LOCAL_ROOT}/ocr_service/." "${BUILD_DIR}/ocr_service/"
cp -r "${LOCAL_ROOT}/frontend/."    "${BUILD_DIR}/frontend/"
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
sync_to_server "${ZIP_PATH}" "${SSH_TARGET}:${REMOTE_ZIP_DIR}/${ZIP_NAME}"
info "Uploaded → ${REMOTE_ZIP_DIR}/${ZIP_NAME}"

# ── Unzip ─────────────────────────────────────────────────────────────────────
step "Unzipping on server"
remote_script <<SCRIPT
set -euo pipefail
# Preserve downloads/ (large binaries not in git)
if [ -d "${REMOTE_DIR}/downloads" ]; then
  cp -a "${REMOTE_DIR}/downloads" /tmp/mgt_downloads_bak
fi
rm -rf "${REMOTE_DIR}"
mkdir -p "${REMOTE_DIR}"
unzip -q "${REMOTE_ZIP_DIR}/${ZIP_NAME}" -d "${REMOTE_DIR}"
# Restore downloads/
if [ -d /tmp/mgt_downloads_bak ]; then
  mv /tmp/mgt_downloads_bak "${REMOTE_DIR}/downloads"
fi
echo "  unzipped to ${REMOTE_DIR}"
ls -t "${REMOTE_ZIP_DIR}"/*.zip 2>/dev/null | tail -n +6 | xargs -r rm --
echo "  old zips cleaned"
SCRIPT

# ── Sync .env (keep server's existing one if present) ─────────────────────────
step "Syncing .env"
LOCAL_APP_ENV="${LOCAL_ROOT}/${LOCAL_ENV_FILE:-.env}"
if remote "test -f ${REMOTE_DIR}/.env" 2>/dev/null; then
  info ".env exists on server, keeping existing"
elif [[ -f "${LOCAL_APP_ENV}" ]]; then
  sync_to_server "${LOCAL_APP_ENV}" "${SSH_TARGET}:${REMOTE_DIR}/.env"
  info "Uploaded ${LOCAL_APP_ENV} → server .env"
else
  die "No .env on server and no local env file found (${LOCAL_APP_ENV})"
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
step "Frontend version"
remote_script <<SCRIPT
echo "  data-loader.js: \$(wc -l < ${REMOTE_DIR}/frontend/data-loader.js) lines"
echo "  first line: \$(head -1 ${REMOTE_DIR}/frontend/data-loader.js)"
SCRIPT

echo -e "\n${G}${B}Deploy complete — ${SSH_TARGET}${N}"
