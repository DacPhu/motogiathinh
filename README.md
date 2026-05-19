# Moto Gia Thịnh

Hệ thống quản lý trường dạy lái xe — học viên, lớp học, học phí, thi cử, leads Facebook, đa chi nhánh.

**Stack:** FastAPI · PostgreSQL 18 · Redis 8.6 · React + TypeScript · React Native (Expo)

---

## Run

```bash
# 1. Copy env
cp .env.example .env

# 2. Start all services
docker compose up -d

# 3. Run migrations
docker compose exec backend alembic upgrade head
```

App runs at `http://localhost` (nginx), API at `http://localhost/api/v1`.

## Dev

```bash
# Backend (hot reload)
docker compose up backend celery_worker celery_beat -d

# Frontend (local)
cd frontend && npm install && npm run dev

# Logs
docker compose logs -f backend
```

## Services

| Service | Port |
|---|---|
| Web | 80 / 443 |
| API | 8000 |
| MinIO | 9000 / 9001 |
| PostgreSQL | 5432 |
| Redis | 6379 |
