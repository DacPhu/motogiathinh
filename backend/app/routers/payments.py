import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query

from app.core.permissions import branch_scope, require_role
from app.dependencies import DB, CurrentUser
from app.models.enums import RoleName
from app.schemas.payment import (
    PaymentCreate,
    PaymentOut,
    PaymentPlanCreate,
    PaymentPlanOut,
    StaffCollectionSummary,
)
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("", response_model=PaymentOut, status_code=201)
async def record_payment(
    data: PaymentCreate,
    current_user: CurrentUser,
    db: DB,
    branch_id: uuid.UUID | None = Query(None),
):
    effective_branch = branch_scope(current_user, branch_id) or current_user.branch_id
    return await PaymentService(db, current_user).record_payment(data, effective_branch)


@router.post("/plans", response_model=PaymentPlanOut, status_code=201)
async def create_payment_plan(
    data: PaymentPlanCreate,
    current_user: CurrentUser,
    db: DB,
    branch_id: uuid.UUID | None = Query(None),
):
    effective_branch = branch_scope(current_user, branch_id) or current_user.branch_id
    return await PaymentService(db, current_user).create_plan(data, effective_branch)


@router.get("/per-staff", response_model=list[StaffCollectionSummary])
async def staff_collection_summary(
    current_user: CurrentUser,
    db: DB,
    on_date: date | None = Query(None),
    branch_id: uuid.UUID | None = Query(None),
):
    effective_branch = branch_scope(current_user, branch_id)
    return await PaymentService(db, current_user).get_staff_collection_summary(
        effective_branch, on_date
    )


@router.get("/overdue", response_model=list[PaymentPlanOut])
async def overdue_payments(
    current_user: CurrentUser,
    db: DB,
    branch_id: uuid.UUID | None = Query(None),
):
    effective_branch = branch_scope(current_user, branch_id)
    return await PaymentService(db, current_user).get_overdue_plans(effective_branch)


@router.post("/plans/{plan_id}/waive", response_model=PaymentPlanOut)
async def waive_payment(
    plan_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    reason: str = Query(""),
    _: CurrentUser = Depends(require_role(RoleName.admin)),
):
    return await PaymentService(db, current_user).waive_payment(plan_id, reason)
