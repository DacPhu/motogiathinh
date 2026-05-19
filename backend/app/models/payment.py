import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import BaseModel
from app.models.enums import PaymentMethod, PaymentStatus, PaymentTypeEnum


class PaymentPlan(BaseModel):
    __tablename__ = "payment_plans"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    class_enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_enrollments.id"), nullable=False
    )
    payment_type: Mapped[PaymentTypeEnum] = mapped_column(
        Enum(PaymentTypeEnum), nullable=False, default=PaymentTypeEnum.full
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    discount_reason: Mapped[str | None] = mapped_column(String(200))
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), nullable=False, default=PaymentStatus.pending, index=True
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    # Computed properties (done in Python since SQLAlchemy generated columns need DB support)
    @property
    def net_amount(self) -> Decimal:
        return self.total_amount - self.discount_amount

    @property
    def remaining_amount(self) -> Decimal:
        return self.total_amount - self.discount_amount - self.paid_amount

    # Relationships
    student: Mapped["Student"] = relationship("Student", back_populates="payment_plans")
    enrollment: Mapped["ClassEnrollment"] = relationship(
        "ClassEnrollment", back_populates="payment_plans"
    )
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="payment_plan")


class Payment(BaseModel):
    __tablename__ = "payments"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True
    )
    payment_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payment_plans.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    ma_giao_dich: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    so_tien: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    phuong_thuc: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), nullable=False)
    loai_thanh_toan: Mapped[str | None] = mapped_column(String(50))
    # Per-staff tracking
    collected_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Gateway
    ma_tham_chieu: Mapped[str | None] = mapped_column(String(100))
    ngan_hang: Mapped[str | None] = mapped_column(String(100))
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), nullable=False, default=PaymentStatus.pending, index=True
    )
    payment_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    so_bien_lai: Mapped[str | None] = mapped_column(String(50))
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    # Relationships
    student: Mapped["Student"] = relationship("Student", back_populates="payments")
    payment_plan: Mapped["PaymentPlan"] = relationship("PaymentPlan", back_populates="payments")
    collector: Mapped["User"] = relationship("User", foreign_keys=[collected_by])
    gateway_logs: Mapped[list["PaymentGatewayLog"]] = relationship(
        "PaymentGatewayLog", back_populates="payment"
    )


class PaymentGatewayLog(BaseModel):
    __tablename__ = "payment_gateway_logs"

    payment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payments.id")
    )
    gateway: Mapped[str] = mapped_column(String(50), nullable=False)
    request_data: Mapped[dict | None] = mapped_column(JSONB)
    response_data: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[str | None] = mapped_column(String(50))

    payment: Mapped["Payment | None"] = relationship("Payment", back_populates="gateway_logs")
