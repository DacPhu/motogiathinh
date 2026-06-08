"""add_user_assignment_tables

Many-to-many branch + class assignment for the collaborator (CTV) role.
- user_branch_assignments: (user_id, branch_id) unique
- user_class_assignments:  (user_id, class_id) unique

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-06-07 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if "user_branch_assignments" not in existing:
        op.create_table(
            "user_branch_assignments",
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("branch_id", sa.UUID(), nullable=False),
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "branch_id", name="uq_user_branch_assignments_user_branch"),
        )
        op.create_index(
            op.f("ix_user_branch_assignments_user_id"),
            "user_branch_assignments",
            ["user_id"],
            unique=False,
        )

    if "user_class_assignments" not in existing:
        op.create_table(
            "user_class_assignments",
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("class_id", sa.UUID(), nullable=False),
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "class_id", name="uq_user_class_assignments_user_class"),
        )
        op.create_index(
            op.f("ix_user_class_assignments_user_id"),
            "user_class_assignments",
            ["user_id"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_class_assignments_user_id"), table_name="user_class_assignments")
    op.drop_table("user_class_assignments")
    op.drop_index(op.f("ix_user_branch_assignments_user_id"), table_name="user_branch_assignments")
    op.drop_table("user_branch_assignments")
