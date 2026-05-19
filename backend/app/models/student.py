import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import BaseModel
from app.models.enums import GenderType, LeadSource, LicenseType, StudentStatus


class Student(BaseModel):
    __tablename__ = "students"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True
    )
    # Identity
    ma_hoc_vien: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    ten_hoc_vien: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    ngay_sinh: Mapped[date] = mapped_column(Date, nullable=False)
    gioi_tinh: Mapped[GenderType] = mapped_column(Enum(GenderType), nullable=False)
    cccd_number: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    cccd_issued_date: Mapped[date | None] = mapped_column(Date)
    cccd_issued_place: Mapped[str | None] = mapped_column(String(200))
    # Contact
    so_dien_thoai: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    dia_chi_email: Mapped[str | None] = mapped_column(String(255))
    dia_chi: Mapped[str | None] = mapped_column(Text)
    phuong_xa: Mapped[str | None] = mapped_column(String(100))
    quan_huyen: Mapped[str | None] = mapped_column(String(100))
    tinh_thanh: Mapped[str | None] = mapped_column(String(100))
    # Emergency contact
    ho_ten_nguoi_than: Mapped[str | None] = mapped_column(String(100))
    sdt_nguoi_than: Mapped[str | None] = mapped_column(String(20))
    quan_he: Mapped[str | None] = mapped_column(String(50))
    # License
    loai_bang_lai: Mapped[LicenseType] = mapped_column(Enum(LicenseType), nullable=False, index=True)
    # Status
    trang_thai: Mapped[StudentStatus] = mapped_column(
        Enum(StudentStatus), nullable=False, default=StudentStatus.pending, index=True
    )
    is_repeat_student: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    repeat_count: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    # Lead tracking
    lead_source: Mapped[LeadSource | None] = mapped_column(Enum(LeadSource))
    facebook_lead_id: Mapped[str | None] = mapped_column(String(100))
    # Documents (direct fields for core docs)
    anh_the_url: Mapped[str | None] = mapped_column(String(500))
    cmnd_front_url: Mapped[str | None] = mapped_column(String(500))
    cmnd_back_url: Mapped[str | None] = mapped_column(String(500))
    # Medical
    health_cert_url: Mapped[str | None] = mapped_column(String(500))
    health_cert_expiry: Mapped[date | None] = mapped_column(Date)
    # QR / contact shortcuts
    qr_code_url: Mapped[str | None] = mapped_column(String(500))
    zalo_number: Mapped[str | None] = mapped_column(String(20))
    # Notes
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    ngay_dang_ky: Mapped[date] = mapped_column(Date, nullable=False)

    # Relationships
    branch: Mapped["Branch"] = relationship("Branch", back_populates="students")
    enrollments: Mapped[list["ClassEnrollment"]] = relationship(
        "ClassEnrollment", back_populates="student"
    )
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="student")
    payment_plans: Mapped[list["PaymentPlan"]] = relationship(
        "PaymentPlan", back_populates="student"
    )
    documents: Mapped[list["StudentDocument"]] = relationship(
        "StudentDocument", back_populates="student"
    )
    health_checks: Mapped[list["StudentHealthCheck"]] = relationship(
        "StudentHealthCheck", back_populates="student"
    )
    certificates: Mapped[list["Certificate"]] = relationship(
        "Certificate", back_populates="student"
    )
    exam_registrations: Mapped[list["ExamRegistration"]] = relationship(
        "ExamRegistration", back_populates="student"
    )


class StudentHealthCheck(BaseModel):
    __tablename__ = "student_health_checks"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    check_date: Mapped[date] = mapped_column(Date, nullable=False)
    hospital_name: Mapped[str | None] = mapped_column(String(200))
    doctor_name: Mapped[str | None] = mapped_column(String(100))
    blood_pressure: Mapped[str | None] = mapped_column(String(20))
    vision_left: Mapped[str | None] = mapped_column(String(10))
    vision_right: Mapped[str | None] = mapped_column(String(10))
    hearing_result: Mapped[str | None] = mapped_column(String(50))
    overall_result: Mapped[str] = mapped_column(String(20), nullable=False)
    certificate_url: Mapped[str | None] = mapped_column(String(500))
    valid_until: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)

    student: Mapped["Student"] = relationship("Student", back_populates="health_checks")


class DocumentType(BaseModel):
    __tablename__ = "document_types"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    documents: Mapped[list["StudentDocument"]] = relationship(
        "StudentDocument", back_populates="doc_type"
    )


class StudentDocument(BaseModel):
    __tablename__ = "student_documents"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    doc_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_types.id"), nullable=False
    )
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    ocr_raw_data: Mapped[dict | None] = mapped_column()
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    student: Mapped["Student"] = relationship("Student", back_populates="documents")
    doc_type: Mapped["DocumentType"] = relationship("DocumentType", back_populates="documents")
