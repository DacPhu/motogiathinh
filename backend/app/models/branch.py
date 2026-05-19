import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin


class Branch(Base, TimestampMixin):
    __tablename__ = "branches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ma_chi_nhanh: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ten_chi_nhanh: Mapped[str] = mapped_column(String(200), nullable=False)
    dia_chi: Mapped[str | None] = mapped_column(String(500))
    so_dien_thoai: Mapped[str | None] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    users: Mapped[list["User"]] = relationship("User", back_populates="branch")
    students: Mapped[list["Student"]] = relationship("Student", back_populates="branch")
    classes: Mapped[list["Class"]] = relationship("Class", back_populates="branch")
