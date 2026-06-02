# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vietnamese driving school management system (Moto Gia Thịnh). Multi-branch, two-role (admin / staff). The frontend is the **frozen visual design system** copied bit-identical from `../motogiathinh2905-devandprod/webapp/` — see `frontend/CLAUDE.md` for the integration contract. The backend serves the sibling's `/api/*` contract natively (no /v1, no Bearer header, no RBAC permission table).

- **Backend:** Python 3.14 + FastAPI (async), PostgreSQL 18, Redis 8.6, Celery
- **Frontend:** React 18 via Babel-in-browser (no build step), SF Pro Display/Text fonts, design tokens in `colors_and_type.css`. JSX files are FROZEN; only `data-loader.js` is the editable seam (it calls `/api/*`).
- **OCR:** Separate microservice (Python 3.11 + VietOCR + Tesseract); Google Vision as primary, microservice as fallback
- **Storage:** MinIO (S3-compatible) via boto3
- **Infra:** Docker Compose

## Common Commands

```bash
docker compose up -d                                # start db, redis, minio, backend, frontend, nginx, ocr, celery
docker compose exec backend alembic upgrade head    # schema migrations
docker compose build backend frontend ocr           # rebuild after code changes
docker compose logs -f backend                      # tail backend
docker compose exec backend python /app/scripts/create_admin.py   # admin@motogiathinh.vn / admin123
docker compose exec backend python /app/scripts/create_guest.py   # guest kiosk user, assigns latest class
make migrate                                        # upload crawled data + run alembic + migrate.py on server
make deploy / deploy-staging                        # rsync + docker up on VPS
make create-admin                                   # override admin password on the VPS
make logs / ps / ssh / restart                      # all have -staging twins
make backup                                         # pg_dump prod DB to /opt/backups/<ts>.sql.gz
make seed-mock                                      # ⚠️ WIPES prod and seeds sibling mock data (runs `backup` first; requires typing YES)
```

Entrypoints (local): frontend `:3000` (direct) or `:8080` (top-level nginx). API docs at `:8000/api/docs`. MinIO console `:9001`. Note: `README.md` is stale (mentions `/api/v1` and port 80) — this file is authoritative.

## Architecture rules

- **Single API surface:** `/api/*`. There is no `/api/v1/*` anymore. The frontend is a static bundle of `.jsx` + `.css` + fonts; the backend serves the JSON shape documented in `motogiathinh2905-devandprod/motogiathinh-design-system-template/project/BACKEND.md`.
- **Auth:** HttpOnly cookie `mgt_session` (JWT inside, 14-day TTL). No Bearer header; no refresh tokens. `dependencies.get_current_user` reads the cookie. Login (`POST /api/auth/login`) returns `{user}` and sets the cookie. Logout clears it.
- **Three roles:** `admin` (branch_id NULL, sees everything), `staff` (branch_id set, sees own branch), `guest` (assigned_class_id set, kiosk operator, sees only their own students). Admin endpoints depend on `AdminUser`. Branch scoping for staff is `scope_to_branch(user)`; guests are scoped by `responsible_staff_id == current_user.id` on `/students`, by `assigned_class_id` on `/classes`, and self-only on `/accounts`. No RBAC: the `UserPermission` model + `user_permissions` table are left on disk dormant (table not read by any router); the legacy `require_permission(resource, verb)` factory was removed.
- **Branch IDs on the wire are slugs**, not UUIDs. `branches.slug` (`br-1`, `br-2`, `br-3`) is assigned by the alembic migration in `created_at` order. Wire shapes resolve UUIDs to slugs via `resolve_branch_slug(s)`. Admin's null-branch resolves to the synthetic `admin-all` sentinel.
- **Wire shape ≠ DB shape.** DB columns stay Vietnamese (`ten_hoc_vien`, `ngay_sinh`, `loai_bang_lai`); each router has a `_to_wire(row)` mapper that renames to English + formats dates as `dd/mm/yyyy[ HH:MM:SS]` + collapses the 8-class license enum to A/A1. Helpers live in `app/utils/dates.py`.
- **Payments are immutable:** no UPDATE/DELETE. Corrections are compensating negative-amount entries. Payments have `kind ∈ {tuition, rental}`; rentals carry `vehicle_id` + `rental_rounds`.
- **Derived fields are never on the wire:** `student.paid/balance/paymentStatus/noPayOnRegistration` and `class.status` are computed client-side from the payment event log + `class.openDate/examDate`. See `frontend/CLAUDE.md` § "Step 4 — derived fields are NEVER read from the wire".
- **Notification auto-recompute** runs on Celery beat every 5 min (`app/tasks/notifications.py:recompute_auto_notifications`). Real auto-* upsert logic is a stub — full sibling-style recompute needs a `severity` column on notifications (deferred).
- **File uploads:** MinIO via `core/storage.py:upload_bytes()`. Student docs land at `students/{id}/{key}-{ts}.{ext}`, biên lai at `payments/{id}/bienlai-{ts}.{ext}`. Served back via `GET /api/files/{kind}/{recId}/{filename}` (branch-scoped, path-traversal guarded).

## Backend (`backend/app/`)

```
main.py              — FastAPI app, mounts all routers under /api
config.py            — pydantic-settings
celery_app.py        — Celery + beat schedule
dependencies.py      — get_current_user (cookie), require_admin, scope_to_branch, resolve_branch_slug(s), is_guest
database/base.py     — BaseModel (UUID pk + TimestampMixin + SoftDeleteMixin)
core/
  security.py        — JWT (jose) + bcrypt + create_session_token / decode_token
  cache.py           — Redis wrapper + CacheKeys (some keys dead since RBAC removal — cleanup pending)
  storage.py         — MinIO upload_file / upload_bytes / get_object_bytes / delete_file
  ocr.py             — Google Vision → ocr microservice fallback
models/              — SQLAlchemy ORM (Vietnamese column names underneath the English wire).
                       user_permission.py is marked DEPRECATED; table kept on disk for reversibility.
schemas/auth.py      — WireUser (includes assignedClassId for guest kiosk), LoginRequest/Response
schemas/common.py    — PaginatedResponse (deprecated; not used by new routes)
services/
  audit_service.py   — log_action() helper (called by mutation routes)
  auth_service.py    — login / change_password
routers/             — auth, me, branches, accounts, classes, students, payments, fee_plans,
                       promotions, teachers, vehicles, notifications, activity_log,
                       constants, files, ocr, reports
scripts/             — create_admin.py (admin@motogiathinh.vn/admin123),
                       create_guest.py (guest@motogiathinh.vn/guest123, assigns latest class),
                       seed_staging.py (mock data for staging VPS)
tasks/notifications.py — Celery jobs: session/payment/exam reminders + auto-notif heartbeat
utils/               — id_generator (HV/BL/GD sequences via Redis INCR),
                       dates (iso↔vn helpers + license/gender/method to_wire/to_db),
                       validators (validate_vietnam_phone, validate_cccd, validate_email, normalize_phone)
tests/               — empty (no test command yet)
```

## Conventions

- **Wire-shape Pydantic classes live inline** in each router (e.g. `routers/students.py:StudentCreateForm`) — no centralized `wire/` directory.
- Vietnamese DB columns translate at API edge via the `_to_wire(row, slug_map)` helper pattern in every router. Branch UUIDs always map through `slug_map` so the wire `branchId` is `br-1`/`br-2`/`br-3` or `admin-all`.
- `dates.py` exports `iso_to_vn_date`, `iso_to_vn_datetime`, `vn_to_iso_date`, `license_to_wire/db`, `gender_to_wire/db`, `method_to_wire/db`.
- IDs: PostgreSQL UUIDs internally; on the wire UUIDs are opaque strings except `branch.id` (slug). Display codes like `HV2024001` and `BL-2026-0001` are generated via `utils/id_generator.py` (Redis INCR).
- 400-line max per file. `routers/students.py` is the largest (≈400 lines) — it contains the create/update/doc-upload/doc-delete routes including the guest-kiosk path.
- `Annotated[..., Depends()]` vs `= Depends()` — pick one form per parameter, don't mix.

## Docker

| Service | Port (host:container) | Image / Build |
|---|---|---|
| db | 5432:5432 | postgres:18 (volume at /var/lib/postgresql) |
| redis | 6379:6379 | redis:8.6.3-alpine |
| minio | 9000/9001 | minio/minio:latest |
| backend | 8000:8000 | python:3.14-slim + tesseract + cairo/pango |
| celery_worker / celery_beat | — | same image as backend |
| ocr | — (internal :8082) | python:3.11-slim + VietOCR + PyTorch + tesseract |
| frontend | 3000:80 | nginx:alpine static — no build step (Babel-in-browser) |
| nginx | 8080:80 | nginx:alpine — top-level reverse proxy |

`frontend/nginx.conf` proxies `/api/` to `backend:8000` directly (uses Docker's embedded resolver so the container starts even when backend is down) and disables cache on `.html/.js/.jsx/.css` so source-file edits reflect on browser refresh.

## Celery beat schedule

| Task | Cron (Asia/Ho_Chi_Minh) |
|---|---|
| `send_session_reminders` | hourly |
| `send_payment_due_reminders` | 08:00 daily |
| `send_exam_reminders` | 08:30 daily |
| `mark_overdue_payments` | 01:00 daily |
| `recompute_auto_notifications` | every 5 min |

## Data migration

- `crawling/crawl.py` scrapes legacy Halozend → JSON in `crawling/data/`.
- `data-migration/migrate.py` imports into PostgreSQL. Idempotent (re-runnable). Adds `old_system_id` columns + the contract's new columns where missing (`SCHEMA_SQL` block).
- Run via `make migrate` (uploads data + runs alembic + executes migrate.py inside backend container).

## Local testing

- Admin: `admin@motogiathinh.vn` / `admin123` (seed via `docker compose exec backend python /app/scripts/create_admin.py`)
- Guest: `guest@motogiathinh.vn` / `guest123` (seed via `docker compose exec backend python /app/scripts/create_guest.py`; picks the most-recently-created class)
- Frontend: `http://localhost:3000`
- API docs: `http://localhost:8000/api/docs`

## Common pitfalls

- **Python 3.14 + passlib = broken.** Use `bcrypt` directly (already done in `core/security.py`).
- **Python 3.14 + hatchling editable install = broken.** Stick to `requirements.txt`.
- **Postgres 18** changed the data dir layout — volume mounts at `/var/lib/postgresql`.
- **MinIO bucket** is auto-created on first upload via `storage.py`.
- **JWT cookie is the only auth.** If a request 401s, the cookie likely expired (14 days) or wasn't sent (CORS / `credentials:'include'` missing). The frontend's `data-loader.js` already sets `credentials:'include'` on every fetch.
- **Branch IDs on the wire are slugs.** Don't pass UUIDs back in mutation requests — accept both, normalize via the `_branch_id_from_slug` helper.
- **Payment.payment_plan_id is nullable** (alembic `b1c2d3e4f5a6` relaxed it). Sibling contract has no payment_plan concept; new payments leave it NULL.
- **The OCR parser lives in two places** (`backend/app/core/ocr.py` and `ocr_service/app.py`) — mirror parser changes.
- **Audit logs don't commit themselves** — `log_action()` adds to the session; the caller must `db.commit()`.
- **Notifications recompute is a stub.** Real auto-* upsert needs a `severity` column on notifications + nullable user_id (model tracks per-user delivery, sibling treats them as system-wide); follow-up alembic migration pending.
- **`WireUser.assignedClassId` is load-bearing for the guest kiosk.** `screen-guest.jsx:581` reads it to render the footer class chip; `screen-org.jsx:332` reads it to render the "Lớp được giao" select when editing a guest account. Drop it from `schemas/auth.py:WireUser` and the kiosk breaks silently (no chip, no class context).
