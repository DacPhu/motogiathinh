import uuid
from datetime import date

from fastapi import APIRouter, Query

from app.core.permissions import branch_scope
from app.dependencies import DB, CurrentUser
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard")
async def dashboard(
    current_user: CurrentUser,
    db: DB,
    branch_id: uuid.UUID | None = Query(None),
):
    effective_branch = branch_scope(current_user, branch_id)
    return await ReportService(db).get_dashboard(effective_branch, current_user)


@router.get("/revenue")
async def revenue(
    current_user: CurrentUser,
    db: DB,
    year: int = Query(default=date.today().year),
    branch_id: uuid.UUID | None = Query(None),
):
    effective_branch = branch_scope(current_user, branch_id)
    return await ReportService(db).get_revenue_monthly(year, effective_branch)
