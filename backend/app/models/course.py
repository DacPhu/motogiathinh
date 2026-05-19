import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, Numeric, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import BaseModel
from app.models.enums import LicenseType


class CourseType(BaseModel):
    __tablename__ = "course_types"

    ma_khoa_hoc: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ten_khoa_hoc: Mapped[str] = mapped_column(String(200), nullable=False)
    loai_bang_lai: Mapped[LicenseType] = mapped_column(Enum(LicenseType), nullable=False, index=True)
    mo_ta: Mapped[str | None] = mapped_column(Text)
    # Duration
    so_buoi_ly_thuyet: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    so_buoi_thuc_hanh: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tong_gio_hoc: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    thoi_gian_dao_tao: Mapped[int] = mapped_column(Integer, nullable=False)
    # Pricing
    hoc_phi: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    phi_thi: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    phi_sat_hach: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    # Requirements
    tuoi_toi_thieu: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=18)
    requirements: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    classes: Mapped[list["Class"]] = relationship("Class", back_populates="course_type")
