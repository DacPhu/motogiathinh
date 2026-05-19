import uuid
from datetime import date

from sqlalchemy import (
    Boolean,
    Date,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import BaseModel
from app.models.enums import ClassStatus


class Class(BaseModel):
    __tablename__ = "classes"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True
    )
    ma_lop: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    ten_lop: Mapped[str] = mapped_column(String(200), nullable=False)
    course_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_types.id"), nullable=False
    )
    ngay_khai_giang: Mapped[date] = mapped_column(Date, nullable=False)
    ngay_ket_thuc: Mapped[date | None] = mapped_column(Date)
    so_luong_toi_da: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    so_luong_hien_tai: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    trang_thai: Mapped[ClassStatus] = mapped_column(
        Enum(ClassStatus), nullable=False, default=ClassStatus.upcoming, index=True
    )
    phong_hoc: Mapped[str | None] = mapped_column(String(100))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Relationships
    branch: Mapped["Branch"] = relationship("Branch", back_populates="classes")
    course_type: Mapped["CourseType"] = relationship("CourseType", back_populates="classes")
    enrollments: Mapped[list["ClassEnrollment"]] = relationship(
        "ClassEnrollment", back_populates="class_"
    )
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="class_")


class ClassEnrollment(BaseModel):
    __tablename__ = "class_enrollments"
    __table_args__ = (UniqueConstraint("class_id", "student_id"),)

    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    instructor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("instructors.id")
    )
    enrollment_date: Mapped[date] = mapped_column(Date, nullable=False)
    completion_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Progress
    ly_thuyet_status: Mapped[str] = mapped_column(String(20), default="not_started")
    thuc_hanh_status: Mapped[str] = mapped_column(String(20), default="not_started")
    overall_progress: Mapped[int] = mapped_column(SmallInteger, default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    # Relationships
    class_: Mapped["Class"] = relationship("Class", back_populates="enrollments")
    student: Mapped["Student"] = relationship("Student", back_populates="enrollments")
    payment_plans: Mapped[list["PaymentPlan"]] = relationship(
        "PaymentPlan", back_populates="enrollment"
    )
