# Pending tasks — as of 26 Jun 2026

These must be picked up in the next session. Listed in priority order.

---

## 1. ⚡ Add two new DB columns for student Excel sheet (DO FIRST)

**Why it matters:** The Excel student sheet (sheet 2) already has columns
"Nơi thường trú - địa chỉ mới" (col 7) and "Mã QR CCCD" (col 8).
They show up empty because the DB columns and SQLAlchemy model fields don't exist yet.

### Step 1 — add columns to the database

SSH into VPS and run:

```bash
docker exec motogiathinh-backend-1 python3 -c "
import asyncio, os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def go():
    url = os.environ['DATABASE_URL'].replace('postgresql://','postgresql+asyncpg://')
    e = create_async_engine(url)
    async with e.begin() as c:
        await c.execute(text('ALTER TABLE students ADD COLUMN IF NOT EXISTS cccd_qr_raw TEXT'))
        await c.execute(text('ALTER TABLE students ADD COLUMN IF NOT EXISTS noi_thuong_tru_moi TEXT'))
        print('done')
    await e.dispose()

asyncio.run(go())
"
```

### Step 2 — add fields to the Student model

In `backend/app/models/student.py`, after line 88 (`docs_bang_lai_back_url`), add:

```python
    cccd_qr_raw: Mapped[str | None] = mapped_column(Text)
    noi_thuong_tru_moi: Mapped[str | None] = mapped_column(Text)
```

### Step 3 — deploy + restart backend

```bash
# Upload student.py via Posh-SSH or make deploy, then:
docker compose restart motogiathinh-backend-1
```

---

## 2. Wire CCCD QR raw text into `cccd_qr_raw` (low urgency)

When a student's CCCD QR is scanned, the raw decoded string should be stored
in `students.cccd_qr_raw`. Currently only the image URL (`docs_cccd_qr_url`) is saved.

The scan endpoint is in `backend/app/routers/student_docs.py` (the CCCD QR upload handler).
After OCR decode, do: `s.cccd_qr_raw = raw_text; await db.commit()`.

---

## 3. Address conversion API → `noi_thuong_tru_moi` (low urgency)

Populate `noi_thuong_tru_moi` by calling the Vietnamese administrative-reform address
conversion API on `s.dia_chi`. This normalises old district/ward names to post-2025 merged names.

No specific API decided yet — to be sourced/agreed with the team.

---

## 4. Full 8-char UUID migration (when dataset is reset — do NOT do while live)

Currently DB stores full PostgreSQL UUIDs; wire truncates to 8 hex chars via `s.id.hex[:8]`
and lookups use `LIKE 'xxxxxxxx%'`. This works but adds latency.

When the dataset is wiped/reset:
1. Change PK type in PostgreSQL from `UUID` to `CHAR(8)` (or `VARCHAR(8)`)
2. Generate IDs at insert time with `secrets.token_hex(4)`
3. Remove all `LIKE 'xxxxxxxx%'` resolvers from routers
4. Update `data-migration/migrate.py` to generate 8-char IDs from source data
5. Update alembic migrations

**Do NOT touch this while the current dataset is live.**
