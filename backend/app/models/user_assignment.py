import uuid

from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import BaseModel


class UserBranchAssignment(BaseModel):
    __tablename__ = "user_branch_assignments"
    __table_args__ = (
        UniqueConstraint("user_id", "branch_id", name="uq_user_branch_assignments_user_branch"),
        Index("ix_user_branch_assignments_user_id", "user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False
    )


class UserClassAssignment(BaseModel):
    __tablename__ = "user_class_assignments"
    __table_args__ = (
        UniqueConstraint("user_id", "class_id", name="uq_user_class_assignments_user_class"),
        Index("ix_user_class_assignments_user_id", "user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False
    )
