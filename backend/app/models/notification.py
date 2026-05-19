import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import BaseModel
from app.models.enums import NotifTrigger


class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id")
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(20), default="in_app")
    trigger_type: Mapped[NotifTrigger | None] = mapped_column(Enum(NotifTrigger))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    send_status: Mapped[str] = mapped_column(String(20), default="pending")
    entity_type: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    user: Mapped["User"] = relationship("User")


class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"))
    user_role: Mapped[str | None] = mapped_column(String(20))
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    old_values: Mapped[dict | None] = mapped_column()
    new_values: Mapped[dict | None] = mapped_column()
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)


class SystemSetting(BaseModel):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
