"""add_dia_chi_cccd — the OLD address exactly as written on the CCCD.

Two-column address model:
  - dia_chi_cccd : address exactly as on the CCCD (OLD, pre-2025-reform)  → export col F
  - dia_chi      : diachi.io conversion of dia_chi_cccd (NEW); fallback = dia_chi_cccd → export col G

Today every existing student's `dia_chi` holds the OLD address (they predate the
scan-time conversion and have no cccd_qr_raw), so we seed dia_chi_cccd = dia_chi for
them here. New scans set dia_chi_cccd (old, from the QR) + dia_chi (converted) explicitly.
The NEW (converted) value for legacy students is filled by the adaptive backfill script.

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-06-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "d6e7f8a9b0c1"
down_revision: Union[str, None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS dia_chi_cccd TEXT")
    # Seed the on-CCCD (old) address from the existing dia_chi, which currently holds
    # the old address for every legacy student (cccd_qr_raw IS NULL = not a new scan).
    op.execute(
        "UPDATE students SET dia_chi_cccd = dia_chi "
        "WHERE dia_chi_cccd IS NULL AND dia_chi IS NOT NULL AND cccd_qr_raw IS NULL"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS dia_chi_cccd")
