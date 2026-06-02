"""add_guest_role_and_doc_slots

Revision ID: a1b2c3d4e5f7
Revises: e1a2b3c4d5e6
Create Date: 2026-06-02 12:00:00.000000

Sibling 2026-06 sync. Three changes:
  1. RoleName enum gains 'guest' (kiosk operator role).
  2. users.assigned_class_id (FK → classes.id ON DELETE SET NULL) — the
     class a guest operates against; NULL for admin/staff.
  3. students gains docs_cccd_back_url + docs_cccd_qr_url — the two new
     doc slots the kiosk CCCD capture flow uploads to (4 → 6 total).
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, None] = 'e1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE rolename ADD VALUE IF NOT EXISTS 'guest'")
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS assigned_class_id UUID
        REFERENCES classes(id) ON DELETE SET NULL
    """)
    op.execute("CREATE INDEX IF NOT EXISTS users_assigned_class_id_idx ON users(assigned_class_id)")
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS docs_cccd_back_url VARCHAR(500)")
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS docs_cccd_qr_url   VARCHAR(500)")


def downgrade() -> None:
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS docs_cccd_qr_url")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS docs_cccd_back_url")
    op.execute("DROP INDEX IF EXISTS users_assigned_class_id_idx")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS assigned_class_id")
