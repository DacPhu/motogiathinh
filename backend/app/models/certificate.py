import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import BaseModel
from app.models.enums import CertificateStatus, LicenseType


class Certificate(BaseModel):
    __tablename__ = "certificates"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    exam_registration_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_registrations.id")
    )
    loai_bang_lai: Mapped[LicenseType] = mapped_column(Enum(LicenseType), nullable=False)
    so_chung_chi: Mapped[str | None] = mapped_column(String(50), unique=True)
    ngay_cap: Mapped[date | None] = mapped_column(Date)
    noi_cap: Mapped[str | None] = mapped_column(String(200))
    ngay_het_han: Mapped[date | None] = mapped_column(Date)
    trang_thai: Mapped[CertificateStatus] = mapped_column(
        Enum(CertificateStatus), nullable=False, default=CertificateStatus.pending, index=True
    )
    ngay_nop_ho_so: Mapped[date | None] = mapped_column(Date)
    so_bien_lai_nop: Mapped[str | None] = mapped_column(String(50))
    du_kien_co_bang: Mapped[date | None] = mapped_column(Date)
    file_url: Mapped[str | None] = mapped_column(String(500))
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    student: Mapped["Student"] = relationship("Student", back_populates="certificates")
