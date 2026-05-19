import uuid
from datetime import date, time
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    Enum,
    ForeignKey,
    Integer,
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
from app.models.enums import ExamResult, LicenseType


class ExamSession(BaseModel):
    __tablename__ = "exam_sessions"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True
    )
    ma_ky_thi: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ten_ky_thi: Mapped[str] = mapped_column(String(200), nullable=False)
    loai_bang_lai: Mapped[LicenseType] = mapped_column(Enum(LicenseType), nullable=False, index=True)
    exam_type: Mapped[str] = mapped_column(String(20), nullable=False)  # theory / practice
    ngay_thi: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    gio_bat_dau: Mapped[time] = mapped_column(Time, nullable=False)
    gio_ket_thuc: Mapped[time] = mapped_column(Time, nullable=False)
    dia_diem_thi: Mapped[str | None] = mapped_column(String(200))
    phong_thi: Mapped[str | None] = mapped_column(String(100))
    so_luong_toi_da: Mapped[int] = mapped_column(Integer, default=50)
    giam_thi: Mapped[str | None] = mapped_column(String(100))
    co_quan_giam_sat: Mapped[str | None] = mapped_column(String(200))
    is_official: Mapped[bool] = mapped_column(Boolean, default=False)
    trang_thai: Mapped[str] = mapped_column(String(20), default="scheduled")
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    registrations: Mapped[list["ExamRegistration"]] = relationship(
        "ExamRegistration", back_populates="exam_session"
    )


class ExamRegistration(BaseModel):
    __tablename__ = "exam_registrations"
    __table_args__ = (UniqueConstraint("exam_session_id", "student_id"),)

    exam_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_sessions.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    class_enrollment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_enrollments.id")
    )
    ket_qua: Mapped[ExamResult] = mapped_column(
        Enum(ExamResult), nullable=False, default=ExamResult.pending
    )
    diem_ly_thuyet: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    diem_thuc_hanh: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    diem_luat_gt: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    so_lan_thi: Mapped[int] = mapped_column(SmallInteger, default=1)
    so_bao_danh: Mapped[str | None] = mapped_column(String(20))
    chung_chi_thi_url: Mapped[str | None] = mapped_column(String(500))
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    exam_session: Mapped["ExamSession"] = relationship("ExamSession", back_populates="registrations")
    student: Mapped["Student"] = relationship("Student", back_populates="exam_registrations")
