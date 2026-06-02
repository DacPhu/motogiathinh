"""Teachers — alias of Instructor model.

Note: create_teacher requires a backend user_id (Instructor.user_id FK).
This route fails-soft (501) since the sibling contract has no concept
of "user account behind teacher". Admin creates accounts separately,
then teachers via the existing /api/admin pathway if needed.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.dependencies import DB, CurrentUser
from app.models.branch import Branch
from app.models.instructor import Instructor

router = APIRouter(prefix="/teachers", tags=["teachers"])


def _years_exp(hired) -> int:
    if not hired: return 0
    try:
        then = hired if isinstance(hired, datetime) else datetime(hired.year, hired.month, hired.day)
        return max(0, datetime.now(then.tzinfo or timezone.utc).year - then.year)
    except Exception:
        return 0


def _to_wire(t: Instructor, slug_map: dict) -> dict:
    return {
        "id": str(t.id),
        "name": getattr(t, "ho_ten", "") or "",
        "phone": getattr(t, "so_dien_thoai", None),
        "yearsExp": _years_exp(getattr(t, "ngay_vao_lam", None)),
        "branchId": slug_map.get(getattr(t, "branch_id", None), str(t.branch_id) if getattr(t, "branch_id", None) else None),
        "active": bool(getattr(t, "is_active", True)),
    }


async def _slug_map(db) -> dict:
    res = await db.execute(select(Branch))
    return {b.id: (b.slug or str(b.id)) for b in res.scalars().all()}


@router.get("")
async def list_teachers(current_user: CurrentUser, db: DB):
    res = await db.execute(select(Instructor).where(Instructor.deleted_at.is_(None)))
    slug_map = await _slug_map(db)
    return [_to_wire(t, slug_map) for t in res.scalars().all()]


class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    yearsExp: Optional[int] = None
    branchId: Optional[str] = None
    active: Optional[bool] = None


@router.post("", status_code=501)
async def create_teacher(current_user: CurrentUser):
    raise HTTPException(501, "create_teacher_unsupported_use_admin_pathway")


@router.patch("/{teacher_id}")
async def update_teacher(
    teacher_id: str,
    data: TeacherUpdate,
    current_user: CurrentUser,
    db: DB,
):
    try: u = uuid.UUID(teacher_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    t = await db.get(Instructor, u)
    if not t: raise HTTPException(404, "teacher_not_found")
    fields = data.model_dump(exclude_unset=True)
    if "name" in fields:   t.ho_ten = fields["name"]
    if "phone" in fields:  t.so_dien_thoai = fields["phone"]
    if "active" in fields: t.is_active = fields["active"]
    if "branchId" in fields:
        try: t.branch_id = uuid.UUID(fields["branchId"]) if fields["branchId"] else None
        except ValueError:
            res = await db.execute(select(Branch).where(Branch.slug == fields["branchId"]))
            b = res.scalar_one_or_none()
            t.branch_id = b.id if b else None
    await db.commit()
    await db.refresh(t)
    return _to_wire(t, await _slug_map(db))
