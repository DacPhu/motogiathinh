# Repository Guidelines

## Project Structure & Module Organization
This is a Docker-first management system for Moto Gia Thinh. Backend code lives in `backend/app/`, with API routers in `backend/app/routers/`, models in `backend/app/models/`, schemas in `backend/app/schemas/`, Alembic migrations in `backend/alembic/versions/`, and tests in `backend/tests/`. The frontend is in `frontend/`; `index.html` is the entry point, `data-loader.js` is the data integration layer, `*.jsx` files are screens and UI, `frontend/data/` contains CSV fixtures, and `frontend/assets/` plus `frontend/fonts/` hold static assets. Mobile wrapper code is in `mobile/`. Deployment and migration helpers are in `scripts/`, `data-migration/`, and `ocr_service/`.

## Build, Test, and Development Commands
- `cp .env.example .env`: create local environment settings.
- `docker compose up -d`: start PostgreSQL, Redis, MinIO, backend, frontend, OCR, Celery, and nginx.
- `docker compose exec backend alembic upgrade head`: apply database migrations.
- `docker compose logs -f backend`: follow backend logs.
- `cd frontend && python3 -m http.server 5173`: serve the static frontend with CSV fixtures.
- `cd backend && pytest`: run backend tests.
- `cd backend && ruff check .`: lint Python code.
- `cd mobile && npm run build`: build the Capacitor mobile wrapper.

## Coding Style & Naming Conventions
Python targets 3.14 and uses Ruff with a 100-character line length, import sorting, pyupgrade, and `E/F` lint rules. Use `snake_case` for Python functions, variables, modules, and Alembic migrations; use `PascalCase` for schema/model classes. Frontend files use JSX with component names in `PascalCase` and helpers in `camelCase`. Per `frontend/README.md`, treat `frontend/index.html`, `*.jsx`, CSS, fonts, and assets as frozen unless the design owner approves changes; prefer editing `frontend/data-loader.js` for backend wiring.

## Testing Guidelines
Backend testing uses `pytest` with `pytest-asyncio` in auto mode. Place tests under `backend/tests/` and name files `test_<feature>.py`. Add focused tests for API behavior, permissions, migrations, and data transformations. No coverage threshold is currently configured.

## Commit & Pull Request Guidelines
Git history follows conventional prefixes such as `feat:`, `fix(scope):`, and `ci(mobile):`; keep subjects imperative and specific, for example `fix(auth): allow secure cookies in prod`. Pull requests should describe the change, list verification commands, mention migrations or environment changes, link related issues, and include screenshots for visible frontend or mobile changes.

## Security & Configuration Tips
Do not commit real secrets. Use `.env.example` as the template and keep deployment-specific values in local `.env`, `.deploy.env`, or `.staging.env` files. Run destructive seed or production Make targets only after confirming the target environment.
