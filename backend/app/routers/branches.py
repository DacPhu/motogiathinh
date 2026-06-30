"""Branches CRUD. Admin sees full list with 'admin-all' sentinel prepended;
staff sees only their own branch. DELETE is FK-guarded (409 if any class /
student / account / teacher / vehicle references the branch).
"""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select

from app.dependencies import DB, CurrentUser, require_permission
from app.models.branch import Branch
from app.models.class_model import Class
from app.models.enums import RoleName
from app.models.instructor import Instructor
from app.models.student import Student
from app.models.user import User
from app.models.vehicle import Vehicle

router = APIRouter(prefix="/branches", tags=["branches"])


def _to_wire(b: Branch) -> dict:
    return {
        "id": b.slug or str(b.id),
        "name": b.ten_chi_nhanh,
        "address": b.dia_chi,
        "manager_id": str(b.manager_id) if b.manager_id else None,
    }


@router.get("")
async def list_branches(current_user: CurrentUser, db: DB):
    """Return REAL branches only. The frozen dashboard hardcodes BRANCH_TONES
    by slug (br-1/2/3); any extra synthetic id (`admin-all` etc.) crashes
    `useBranchTones()[b.id].tones`. For admin users without a personal
    branch, the Sidebar's `D.getBranch(user.branchId)` still resolves
    because WireUser.branchId is set to the first real branch's slug
    (see resolve_branch_slug in dependencies.py)."""
    if current_user.role == RoleName.admin:
        res = await db.execute(
            select(Branch).where(Branch.is_active == True).order_by(Branch.created_at.asc())
        )
        return [_to_wire(b) for b in res.scalars().all()]
    b = await db.get(Branch, current_user.branch_id) if current_user.branch_id else None
    return [_to_wire(b)] if b else []


class BranchCreate(BaseModel):
    name: str
    address: Optional[str] = None
    manager_id: Optional[str] = None


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    # address is locked — immutable identifier
    manager_id: Optional[str] = None


def _next_slug(branches: list[Branch]) -> str:
    used = {b.slug for b in branches if b.slug}
    i = 1
    while f"br-{i}" in used:
        i += 1
    return f"br-{i}"


@router.post("", status_code=201)
async def create_branch(
    data: BranchCreate,
    current_user: CurrentUser,
    db: DB,
    _perm: Annotated[None, Depends(require_permission("branches", "create"))] = None,
):
    res = await db.execute(select(Branch))
    existing = list(res.scalars().all())
    slug = _next_slug(existing)
    b = Branch(
        ma_chi_nhanh=slug.upper(),
        ten_chi_nhanh=data.name,
        dia_chi=data.address,
        is_active=True,
        slug=slug,
    )
    if data.manager_id:
        try: b.manager_id = uuid.UUID(data.manager_id)
        except ValueError: pass
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return _to_wire(b)


async def _resolve(db, slug_or_uuid: str) -> Optional[Branch]:
    try: u = uuid.UUID(slug_or_uuid)
    except ValueError: u = None
    if u:
        return await db.get(Branch, u)
    res = await db.execute(select(Branch).where(Branch.slug == slug_or_uuid))
    return res.scalar_one_or_none()


@router.patch("/{branch_id}")
async def update_branch(
    branch_id: str,
    data: BranchUpdate,
    current_user: CurrentUser,
    db: DB,
    _perm: Annotated[None, Depends(require_permission("branches", "update"))] = None,
):
    b = await _resolve(db, branch_id)
    if not b: raise HTTPException(404, "branch_not_found")
    fields = data.model_dump(exclude_unset=True)
    if "name" in fields:    b.ten_chi_nhanh = fields["name"]
    # address is immutable — locked for identification
    if "manager_id" in fields:
        try: b.manager_id = uuid.UUID(fields["manager_id"]) if fields["manager_id"] else None
        except ValueError: b.manager_id = None
    await db.commit()
    await db.refresh(b)
    return _to_wire(b)


@router.delete("/{branch_id}")
async def delete_branch(
    branch_id: str,
    current_user: CurrentUser,
    db: DB,
    _perm: Annotated[None, Depends(require_permission("branches", "delete"))] = None,
):
    b = await _resolve(db, branch_id)
    if not b: raise HTTPException(404, "branch_not_found")
    # FK guard
    refs = {}
    for label, model in (("classes", Class), ("students", Student), ("accounts", User),
                         ("teachers", Instructor), ("vehicles", Vehicle)):
        r = await db.execute(select(func.count()).select_from(model).where(model.branch_id == b.id))
        n = r.scalar_one() or 0
        if n: refs[label] = n
    if refs:
        raise HTTPException(409, detail={"error": "branch_in_use", "references": refs})
    await db.delete(b)
    await db.commit()
    return {"ok": True, "id": b.slug or str(b.id)}
