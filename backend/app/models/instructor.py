import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    ARRAY,
    Boolean,
    Date,
    Enum,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import BaseModel
from app.models.enums import GenderType, LicenseType


class Instructor(BaseModel):
    __tablename__ = "instructors"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    ma_giao_vien: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ho_ten: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    ngay_sinh: Mapped[date | None] = mapped_column(Date)
    gioi_tinh: Mapped[GenderType | None] = mapped_column(Enum(GenderType))
    so_dien_thoai: Mapped[str] = mapped_column(String(20), nullable=False)
    dia_chi: Mapped[str | None] = mapped_column(Text)
    # License qualifications
    bang_lai_so: Mapped[str | None] = mapped_column(String(50))
    ngay_cap_bang: Mapped[date | None] = mapped_column(Date)
    noi_cap_bang: Mapped[str | None] = mapped_column(String(200))
    ngay_het_han_bang: Mapped[date | None] = mapped_column(Date)
    # Employment
    ngay_vao_lam: Mapped[date] = mapped_column(Date, nullable=False)
    ngay_nghi_viec: Mapped[date | None] = mapped_column(Date)
    muc_luong: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    # Rating
    rating_avg: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0)
    total_reviews: Mapped[int] = mapped_column(SmallInteger, default=0)
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    anh_the_url: Mapped[str | None] = mapped_column(String(500))
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    # Relationships
    availability: Mapped[list["InstructorAvailability"]] = relationship(
        "InstructorAvailability", back_populates="instructor"
    )
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="instructor")


class InstructorAvailability(BaseModel):
    __tablename__ = "instructor_availability"
    __table_args__ = (UniqueConstraint("instructor_id", "day_of_week", "start_time"),)

    instructor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("instructors.id"), nullable=False
    )
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    start_time: Mapped[str] = mapped_column(Time, nullable=False)
    end_time: Mapped[str] = mapped_column(Time, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    instructor: Mapped["Instructor"] = relationship("Instructor", back_populates="availability")
