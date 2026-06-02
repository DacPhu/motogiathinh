"""Create or reset a guest kiosk user. Safe to run multiple times.

Picks the most recently created non-deleted class to assign to
(unless GUEST_CLASS_ID env overrides). branch_id is set from that
class's branch. Without an assigned class, the guest can log in but
won't be able to create students (POST /api/students 400 guest_no_class).
"""
import asyncio
import os
import sys
import uuid

import bcrypt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://mgt:mgt_secret@db:5432/motogiathinh")
EMAIL = os.getenv("GUEST_EMAIL", "guest@motogiathinh.vn")
PASSWORD = os.getenv("GUEST_PASSWORD", "guest123")
FULL_NAME = os.getenv("GUEST_NAME", "Guest Tester")
CLASS_ID = os.getenv("GUEST_CLASS_ID")  # optional override


async def _pick_class(session: AsyncSession) -> tuple[str | None, str | None]:
    """Returns (class_id, branch_id) as strings, or (None, None) if no class exists."""
    if CLASS_ID:
        result = await session.execute(
            text("SELECT id::text, branch_id::text FROM classes WHERE id = :id AND deleted_at IS NULL"),
            {"id": CLASS_ID},
        )
        row = result.first()
        if not row:
            print(f"WARNING: GUEST_CLASS_ID={CLASS_ID} not found or deleted", file=sys.stderr)
            return None, None
        return row[0], row[1]
    result = await session.execute(
        text("""
            SELECT id::text, branch_id::text FROM classes
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
        """)
    )
    row = result.first()
    return (row[0], row[1]) if row else (None, None)


async def main() -> None:
    engine = create_async_engine(DATABASE_URL)
    async with AsyncSession(engine) as session:
        class_id, branch_id = await _pick_class(session)
        if not class_id:
            print("WARNING: no class found to assign — guest can log in but not create students", file=sys.stderr)

        result = await session.execute(text("SELECT id FROM users WHERE email = :e"), {"e": EMAIL})
        existing = result.scalar_one_or_none()

        pw_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()

        if existing:
            await session.execute(
                text("""
                    UPDATE users SET
                        password_hash = :h,
                        is_active = true,
                        deleted_at = NULL,
                        role = 'guest',
                        branch_id = :branch_id::uuid,
                        assigned_class_id = :class_id::uuid
                    WHERE email = :e
                """),
                {"h": pw_hash, "e": EMAIL, "branch_id": branch_id, "class_id": class_id},
            )
            print(f"Updated existing guest: {EMAIL}")
        else:
            await session.execute(
                text("""
                    INSERT INTO users (id, email, password_hash, full_name, role, is_active, is_verified, branch_id, assigned_class_id)
                    VALUES (:id, :email, :hash, :name, 'guest', true, true, :branch_id::uuid, :class_id::uuid)
                """),
                {
                    "id": str(uuid.uuid4()), "email": EMAIL, "hash": pw_hash, "name": FULL_NAME,
                    "branch_id": branch_id, "class_id": class_id,
                },
            )
            print(f"Created guest: {EMAIL}")

        await session.commit()

    print(f"Password: {PASSWORD}")
    print(f"Assigned class_id: {class_id or '(none — set GUEST_CLASS_ID and re-run)'}")
    await engine.dispose()


asyncio.run(main())
