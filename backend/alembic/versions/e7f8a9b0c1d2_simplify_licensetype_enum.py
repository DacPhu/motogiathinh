"""simplify_licensetype_enum — keep only A and A1.

The app only uses two license types: A and A1. The legacy PostgreSQL ENUM
had 8 values (A1, A2, B1, B2, C, D, E, F) from the original design system.
This migration:
  1. Converts the enum column to VARCHAR on all 5 tables
  2. Drops the old licensetype ENUM
  3. Migrates data: A2 → A (the old code stored "A2" for frontend "A")
  4. Creates a fresh ENUM with only A and A1
  5. Converts columns back to the new ENUM

Tables: students, course_types, exam_sessions, vehicles, certificates.

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-06-29 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ["students", "course_types", "exam_sessions", "vehicles", "certificates"]
_OLD_ENUM = sa.Enum("A1", "A2", "B1", "B2", "C", "D", "E", "F", name="licensetype")
_NEW_ENUM = sa.Enum("A1", "A", name="licensetype")


def upgrade() -> None:
    # Step 1: Convert enum columns to VARCHAR so we can manipulate the enum type
    for t in _TABLES:
        op.alter_column(t, "loai_bang_lai", type_=sa.String(2), existing_type=_OLD_ENUM)

    # Step 2: Drop the old enum type
    op.execute("DROP TYPE IF EXISTS licensetype")

    # Step 3: Migrate data — the old code stored "A2" for frontend "A"
    for t in _TABLES:
        op.execute(f"UPDATE {t} SET loai_bang_lai = 'A' WHERE loai_bang_lai = 'A2'")

    # Step 4: Create the new enum with only A and A1
    op.execute("CREATE TYPE licensetype AS ENUM ('A1', 'A')")

    # Step 5: Convert columns back to the new enum type.
    # Any remaining old values (B1, B2, C, D, E, F) that weren't caught by the
    # A2→A update are defaulted to 'A'. The USING clause tells PostgreSQL how
    # to cast each row's VARCHAR value into the new ENUM.
    for t in _TABLES:
        op.execute(
            f"UPDATE {t} SET loai_bang_lai = 'A' "
            f"WHERE loai_bang_lai NOT IN ('A1', 'A')"
        )
        op.execute(
            f"ALTER TABLE {t} ALTER COLUMN loai_bang_lai TYPE licensetype "
            f"USING loai_bang_lai::licensetype"
        )


def downgrade() -> None:
    # Convert back to VARCHAR
    for t in _TABLES:
        op.alter_column(t, "loai_bang_lai", type_=sa.String(2), existing_type=_NEW_ENUM)

    # Drop new enum, recreate old
    op.execute("DROP TYPE IF EXISTS licensetype")
    op.execute("CREATE TYPE licensetype AS ENUM ('A1', 'A2', 'B1', 'B2', 'C', 'D', 'E', 'F')")

    # Restore A2 for rows that are currently "A" (best-effort; original B1-F data is lost)
    for t in _TABLES:
        op.execute(f"UPDATE {t} SET loai_bang_lai = 'A2' WHERE loai_bang_lai = 'A'")

    # Convert back to old enum
    for t in _TABLES:
        op.execute(
            f"ALTER TABLE {t} ALTER COLUMN loai_bang_lai TYPE licensetype "
            f"USING loai_bang_lai::licensetype"
        )
