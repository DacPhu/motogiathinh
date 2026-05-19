import math
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PaymentStatus
from app.models.payment import Payment, PaymentPlan
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.payment import (
    PaymentCreate,
    PaymentOut,
    PaymentPlanCreate,
    PaymentPlanOut,
    StaffCollectionSummary,
)
from app.utils.id_generator import next_payment_id


class PaymentService:
    def __init__(self, db: AsyncSession, current_user: User):
        self.db = db
        self.current_user = current_user

    async def create_plan(self, data: PaymentPlanCreate, branch_id: uuid.UUID) -> PaymentPlanOut:
        plan = PaymentPlan(**data.model_dump(), branch_id=branch_id)
        self.db.add(plan)
        await self.db.commit()
        await self.db.refresh(plan)
        return PaymentPlanOut(
            **plan.__dict__,
            net_amount=plan.net_amount,
            remaining_amount=plan.remaining_amount,
        )

    async def record_payment(self, data: PaymentCreate, branch_id: uuid.UUID) -> PaymentOut:
        from fastapi import HTTPException, status as http_status

        plan = await self.db.get(PaymentPlan, data.payment_plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Payment plan not found")

        if plan.remaining_amount <= 0 and plan.payment_status == PaymentStatus.waived:
            raise HTTPException(status_code=400, detail="Payment plan is already waived")

        if data.so_tien > plan.remaining_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Amount exceeds remaining balance: {plan.remaining_amount}",
            )

        # Get branch code for transaction ID
        from app.models.branch import Branch
        branch = await self.db.get(Branch, branch_id)
        branch_code = branch.ma_chi_nhanh if branch else "XX"

        ma_giao_dich = await next_payment_id(branch_code)

        payment = Payment(
            branch_id=branch_id,
            payment_plan_id=data.payment_plan_id,
            student_id=plan.student_id,
            ma_giao_dich=ma_giao_dich,
            so_tien=data.so_tien,
            phuong_thuc=data.phuong_thuc,
            loai_thanh_toan=data.loai_thanh_toan,
            ma_tham_chieu=data.ma_tham_chieu,
            ghi_chu=data.ghi_chu,
            collected_by=self.current_user.id,
            collected_at=datetime.now(timezone.utc),
            payment_status=PaymentStatus.paid,
            payment_date=datetime.now(timezone.utc),
        )
        self.db.add(payment)

        # Update plan paid amount and status
        plan.paid_amount = plan.paid_amount + data.so_tien
        if plan.paid_amount >= plan.net_amount:
            plan.payment_status = PaymentStatus.paid
        else:
            plan.payment_status = PaymentStatus.partial

        await self.db.commit()
        await self.db.refresh(payment)

        # Invalidate student payment cache
        from app.core.cache import cache
        await cache.delete(f"student:{plan.student_id}:payments")

        return PaymentOut.model_validate(payment)

    async def waive_payment(self, payment_plan_id: uuid.UUID, reason: str) -> PaymentPlanOut:
        plan = await self.db.get(PaymentPlan, payment_plan_id)
        if not plan:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Payment plan not found")

        plan.payment_status = PaymentStatus.waived
        plan.discount_reason = reason
        await self.db.commit()
        await self.db.refresh(plan)
        return PaymentPlanOut(
            **plan.__dict__,
            net_amount=plan.net_amount,
            remaining_amount=plan.remaining_amount,
        )

    async def get_staff_collection_summary(
        self, branch_id: uuid.UUID | None, on_date: date | None = None
    ) -> list[StaffCollectionSummary]:
        from sqlalchemy import cast, Date as SQLDate
        from app.models.user import User as UserModel

        query = (
            select(
                Payment.collected_by,
                func.sum(Payment.so_tien).label("total_collected"),
                func.count(Payment.id).label("payment_count"),
            )
            .where(Payment.deleted_at.is_(None))
        )

        if branch_id:
            query = query.where(Payment.branch_id == branch_id)
        if on_date:
            query = query.where(cast(Payment.collected_at, SQLDate) == on_date)

        query = query.group_by(Payment.collected_by)
        result = await self.db.execute(query)
        rows = result.all()

        summaries = []
        for row in rows:
            user = await self.db.get(UserModel, row.collected_by)
            summaries.append(
                StaffCollectionSummary(
                    user_id=row.collected_by,
                    full_name=user.full_name if user else None,
                    email=user.email if user else "",
                    total_collected=row.total_collected,
                    payment_count=row.payment_count,
                    date=on_date,
                )
            )
        return summaries

    async def get_overdue_plans(self, branch_id: uuid.UUID | None) -> list[PaymentPlanOut]:
        from datetime import date as date_cls

        query = (
            select(PaymentPlan)
            .where(
                PaymentPlan.payment_status == PaymentStatus.partial,
                PaymentPlan.due_date < date_cls.today(),
                PaymentPlan.deleted_at.is_(None),
            )
        )
        if branch_id:
            query = query.where(PaymentPlan.branch_id == branch_id)

        result = await self.db.execute(query)
        plans = result.scalars().all()
        return [
            PaymentPlanOut(
                **p.__dict__,
                net_amount=p.net_amount,
                remaining_amount=p.remaining_amount,
            )
            for p in plans
        ]
