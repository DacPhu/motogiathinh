"""GET /api/activity-log — flat list, wire-shaped from audit_logs."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.dependencies import DB, CurrentUser, require_permission
from app.models.enums import RoleName
from app.models.notification import AuditLog
from app.utils.dates import iso_to_vn_datetime

router = APIRouter(tags=["activity-log"])


def _to_wire(a: AuditLog) -> dict:
    return {
        "id": str(a.id),
        "userId": str(a.user_id) if a.user_id else None,
        "action": a.action or "",
        "target": str(a.resource_id) if a.resource_id else (a.resource or ""),
        "at": iso_to_vn_datetime(a.created_at) or "",
    }


@router.get("/activity-log")
async def list_activity_log(
    current_user: CurrentUser,
    db: DB,
    _perm: Annotated[None, Depends(require_permission("activity_log", "read"))] = None,
):
    query = (
        select(AuditLog)
        .where(AuditLog.deleted_at.is_(None))
        .order_by(AuditLog.created_at.desc())
        .limit(500)
    )
    if current_user.role == RoleName.collaborator:
        if current_user.branch_id:
            query = query.where(AuditLog.branch_id == current_user.branch_id)
        else:
            return []
    elif current_user.role != RoleName.admin:
        query = query.where(AuditLog.branch_id == current_user.branch_id)
    result = await db.execute(query)
    return [_to_wire(a) for a in result.scalars().all()]
