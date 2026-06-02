# DEPRECATED — sibling 2026-06 contract has no RBAC.
# Table + model kept on disk for reversibility; the back_populates link to
# User.permissions was removed (User no longer declares the relationship),
# so this model is now a leaf with no reverse relationship. No router reads
# from it.
import uuid

from sqlalchemy import Boolean, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import BaseModel


class UserPermission(BaseModel):
    __tablename__ = "user_permissions"
    __table_args__ = (
        UniqueConstraint("user_id", "resource", name="uq_user_permissions_user_resource"),
        Index("ix_user_permissions_user_id", "user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    resource: Mapped[str] = mapped_column(String(50), nullable=False)
    can_create: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    can_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    can_update: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    can_delete: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
