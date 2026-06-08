"""add_extra_student_doc_columns — extra student profile (hồ sơ) doc slots.

Adds the URL columns the expanded profile-docs grid needs:
- students.cmnd_back_url            (CCCD mặt sau)
- students.docs_cccd_qr_url         (QR CCCD)
- students.docs_bang_lai_front_url  (Bằng lái mặt trước)
- students.docs_bang_lai_back_url   (Bằng lái mặt sau)

Revision ID: f1a2b3c4d5e6
Revises: e1a2b3c4d5e6
Create Date: 2026-06-07 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS cmnd_back_url VARCHAR(500)")
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS docs_cccd_qr_url VARCHAR(500)")
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS docs_bang_lai_front_url VARCHAR(500)")
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS docs_bang_lai_back_url VARCHAR(500)")


def downgrade() -> None:
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS docs_bang_lai_back_url")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS docs_bang_lai_front_url")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS docs_cccd_qr_url")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS cmnd_back_url")
