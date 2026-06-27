"""add_guest_role_and_doc_slots

NOTE: This node originates from the divergent "guest" feature line
(sync-frontend-2026-06). It is vendored into this repo so alembic can resolve
prod's history (prod was deployed from that line and its DB head is this
revision). It is unified with the collaborator line via the merge migration
``c4d5e6f7a8b9``. All operations are additive + idempotent, so it is harmless
on collaborator-line databases (the guest enum value + extra columns simply go
unused).

  1. RoleName enum gains 'guest' (kiosk operator role).
  2. users.assigned_class_id (FK → classes.id ON DELETE SET NULL).
  3. students gains docs_cccd_back_url + docs_cccd_qr_url.

Revision ID: a1b2c3d4e5f7
Revises: e1a2b3c4d5e6
Create Date: 2026-06-02 12:00:00.000000

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
