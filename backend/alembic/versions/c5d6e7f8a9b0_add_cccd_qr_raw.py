"""add_cccd_qr_raw — store the raw CCCD QR payload string.

The CCCD QR scanner returns a pipe-delimited string
(e.g. "015207008504||Sùng A Thề|03092007|Nam|Bản Nả Háng B, …, Yên Bái|17122021").
We persist it so the Excel export can surface it (col "Mã QR CCCD") for bulk
copy-paste into the Bộ submission software, and so the OLD on-CCCD address can be
recovered (it's field index 5 of the payload).

Revision ID: c5d6e7f8a9b0
Revises: c4d5e6f7a8b9
Create Date: 2026-06-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS cccd_qr_raw TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS cccd_qr_raw")
