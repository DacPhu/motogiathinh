"""add_collaborator_role_enum

The CTV portal changeset added ``RoleName.collaborator`` to the Python enum but
never altered the Postgres ``rolename`` enum type, so inserting a collaborator
account failed with ``invalid input value for enum rolename: "collaborator"``.
This migration adds the value to the DB type.

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-06-08 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PG 12+ allows ADD VALUE inside a transaction as long as the new label is
    # not used in the same transaction (this migration only adds it).
    op.execute("ALTER TYPE rolename ADD VALUE IF NOT EXISTS 'collaborator'")


def downgrade() -> None:
    # Postgres cannot drop a value from an enum type without recreating it;
    # leaving the extra label in place is harmless. No-op.
    pass
