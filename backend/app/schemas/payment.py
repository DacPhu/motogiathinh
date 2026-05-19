import uuid
from datetime import date, datetime
from decimal import Decimal

from app.models.enums import PaymentMethod, PaymentStatus, PaymentTypeEnum
from app.schemas.common import BaseSchema, UUIDSchema


class PaymentPlanCreate(BaseSchema):
    student_id: uuid.UUID
    class_enrollment_id: uuid.UUID
    payment_type: PaymentTypeEnum = PaymentTypeEnum.full
    total_amount: Decimal
    discount_amount: Decimal = Decimal("0")
    discount_reason: str | None = None
    due_date: date | None = None
    ghi_chu: str | None = None


class PaymentPlanOut(UUIDSchema):
    id: uuid.UUID
    branch_id: uuid.UUID
    student_id: uuid.UUID
    class_enrollment_id: uuid.UUID
    payment_type: PaymentTypeEnum
    total_amount: Decimal
    discount_amount: Decimal
    net_amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    payment_status: PaymentStatus
    due_date: date | None
    ghi_chu: str | None


class PaymentCreate(BaseSchema):
    payment_plan_id: uuid.UUID
    so_tien: Decimal
    phuong_thuc: PaymentMethod
    loai_thanh_toan: str | None = None
    ma_tham_chieu: str | None = None
    ghi_chu: str | None = None


class PaymentOut(UUIDSchema):
    id: uuid.UUID
    branch_id: uuid.UUID
    payment_plan_id: uuid.UUID
    student_id: uuid.UUID
    ma_giao_dich: str
    so_tien: Decimal
    phuong_thuc: PaymentMethod
    loai_thanh_toan: str | None
    collected_by: uuid.UUID
    collected_at: datetime
    payment_status: PaymentStatus
    payment_date: datetime | None
    so_bien_lai: str | None
    ghi_chu: str | None


class StaffCollectionSummary(BaseSchema):
    user_id: uuid.UUID
    full_name: str | None
    email: str
    total_collected: Decimal
    payment_count: int
    date: date | None = None
