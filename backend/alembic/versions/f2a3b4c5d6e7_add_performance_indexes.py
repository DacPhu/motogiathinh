"""add_performance_indexes — CCCD uniqueness + CTV query optimization.

1. Partial unique index on students.cccd_number (prevents duplicate active students)
2. Composite covering index on user_class_assignments (speeds up accessible_class_ids)
3. Composite covering index on class_enrollments (speeds up CTV enrollment subqueries)

Revision ID: f2a3b4c5d6e7
Revises: e7f8a9b0c1d2
Create Date: 2026-06-29 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. CCCD duplicate prevention — only active (non-soft-deleted) students.
    op.create_index(
        "uq_students_cccd_active",
        "students",
        ["cccd_number"],
        unique=True,
        postgresql_where="deleted_at IS NULL AND cccd_number IS NOT NULL",
    )

    # 2. Covers accessible_class_ids(): WHERE user_id = ? AND deleted_at IS NULL
    op.create_index(
        "ix_user_class_assignments_composite",
        "user_class_assignments",
        ["user_id", "class_id"],
        postgresql_where="deleted_at IS NULL",
    )

    # 3. Covers CTV enrollment subqueries: WHERE class_id IN (...) AND deleted_at IS NULL
    op.create_index(
        "ix_class_enrollments_composite",
        "class_enrollments",
        ["class_id", "student_id"],
        postgresql_where="deleted_at IS NULL",
    )


def downgrade() -> None:
    op.drop_index("ix_class_enrollments_composite", table_name="class_enrollments")
    op.drop_index("ix_user_class_assignments_composite", table_name="user_class_assignments")
    op.drop_index("uq_students_cccd_active", table_name="students")
