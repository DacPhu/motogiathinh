import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import cast, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CacheKeys, cache
from app.models.class_model import Class, ClassEnrollment
from app.models.enums import PaymentStatus, StudentStatus
from app.models.payment import Payment
from app.models.student import Student
from app.models.user import User


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard(self, branch_id: uuid.UUID | None, current_user: User) -> dict:
        cache_key = CacheKeys.DASHBOARD_STATS.format(branch_id=str(branch_id) if branch_id else "all")
        cached = await cache.get(cache_key)
        if cached:
            return cached

        today = date.today()
        first_of_month = today.replace(day=1)

        def scoped(query, model):
            if branch_id:
                return query.where(model.branch_id == branch_id)
            return query

        # Today's collections
        from sqlalchemy import Date as SQLDate
        today_total_res = await self.db.execute(
            scoped(
                select(func.sum(Payment.so_tien)).where(
                    cast(Payment.collected_at, SQLDate) == today,
                    Payment.payment_status == PaymentStatus.paid,
                ),
                Payment,
            )
        )
        cash_today = today_total_res.scalar_one() or Decimal("0")

        # MTD revenue
        mtd_res = await self.db.execute(
            scoped(
                select(func.sum(Payment.so_tien)).where(
                    Payment.collected_at >= first_of_month,
                    Payment.payment_status == PaymentStatus.paid,
                ),
                Payment,
            )
        )
        revenue_mtd = mtd_res.scalar_one() or Decimal("0")

        # Outstanding (partial / pending plans)
        from app.models.payment import PaymentPlan
        outstanding_res = await self.db.execute(
            scoped(
                select(func.sum(
                    PaymentPlan.total_amount - PaymentPlan.discount_amount - PaymentPlan.paid_amount
                )).where(
                    PaymentPlan.payment_status.in_([PaymentStatus.pending, PaymentStatus.partial])
                ),
                PaymentPlan,
            )
        )
        outstanding = outstanding_res.scalar_one() or Decimal("0")

        # Student counts by status
        status_counts_res = await self.db.execute(
            scoped(
                select(Student.trang_thai, func.count(Student.id))
                .where(Student.deleted_at.is_(None))
                .group_by(Student.trang_thai),
                Student,
            )
        )
        student_counts = {row[0].value: row[1] for row in status_counts_res.all()}

        # Per-staff collection today
        from app.services.payment_service import PaymentService
        staff_collections = []
        if current_user.role.value == "admin":
            ps = PaymentService(self.db, current_user)
            staff_collections = [
                sc.model_dump()
                for sc in await ps.get_staff_collection_summary(branch_id, on_date=today)
            ]

        result = {
            "cash_today": float(cash_today),
            "revenue_mtd": float(revenue_mtd),
            "outstanding": float(outstanding),
            "student_counts": student_counts,
            "staff_collections_today": staff_collections,
            "generated_at": datetime.utcnow().isoformat(),
        }

        await cache.setex(cache_key, 300, result)
        return result

    async def get_revenue_monthly(
        self, year: int, branch_id: uuid.UUID | None
    ) -> list[dict]:
        cache_key = CacheKeys.REVENUE_MONTHLY.format(
            branch_id=str(branch_id) if branch_id else "all", year=year, month="all"
        )
        cached = await cache.get(cache_key)
        if cached:
            return cached

        query = (
            select(
                extract("month", Payment.collected_at).label("month"),
                func.sum(Payment.so_tien).label("total"),
            )
            .where(
                extract("year", Payment.collected_at) == year,
                Payment.payment_status == PaymentStatus.paid,
                Payment.deleted_at.is_(None),
            )
            .group_by("month")
            .order_by("month")
        )
        if branch_id:
            query = query.where(Payment.branch_id == branch_id)

        result = await self.db.execute(query)
        rows = [{"month": int(row.month), "total": float(row.total)} for row in result.all()]

        await cache.setex(cache_key, 3600, rows)
        return rows
