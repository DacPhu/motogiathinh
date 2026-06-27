"""merge guest + collaborator migration heads

The project diverged at ``e1a2b3c4d5e6`` into two lines:
  - guest line:        ``a1b2c3d4e5f7`` (deployed on prod)
  - collaborator line: ``f1a2b3c4d5e6`` → ``a2b3c4d5e6f7`` → ``b3c4d5e6f7a8`` (this repo)

This is a pure merge node — no schema changes. It unifies both heads so
``alembic upgrade head`` works on either lineage. Applying it on the prod
(guest) DB pulls in the collaborator-line migrations (all additive /
``IF NOT EXISTS``), leaving guest data intact.

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8, a1b2c3d4e5f7
Create Date: 2026-06-08 16:10:00.000000

"""
from typing import Sequence, Union


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = ("b3c4d5e6f7a8", "a1b2c3d4e5f7")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
