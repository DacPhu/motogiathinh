"""Accounts CRUD (admin-only mutations)."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select

from app.core.security import hash_password
from app.dependencies import (
    DB, AdminUser, CurrentUser,
    first_branch_slug, load_user_assignments, resolve_branch_slugs,
)
from app.models.branch import Branch
from app.models.enums import RoleName
from app.models.user import User
from app.models.user_assignment import UserBranchAssignment, UserClassAssignment
from app.schemas.auth import WireUser
from app.services.audit_service import log_action

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("")
async def list_accounts(current_user: CurrentUser, db: DB):
    if current_user.role == RoleName.admin:
        result = await db.execute(
            select(User)
            .where(User.deleted_at.is_(None))
            .where(~User.email.like("%@teachers.motogiathinh.local"))
            .order_by(User.created_at.desc())
        )
        users = list(result.scalars().all())
    else:
        users = [current_user]
    slug_map = await resolve_branch_slugs(db, users)
    admin_fallback = await first_branch_slug(db)
    assignments = await load_user_assignments(db, [u.id for u in users])
    return [
        WireUser.from_user(
            u,
            branch_id_override=(
                slug_map.get(u.branch_id) if u.branch_id
                else (admin_fallback if u.role == RoleName.admin else None)
            ),
            branch_ids=assignments.get(u.id, {}).get("branchIds", []),
            class_ids=assignments.get(u.id, {}).get("classIds", []),
        ).model_dump()
        for u in users
    ]


async def _branch_uuid_from_slug(db, s: Optional[str]) -> Optional[uuid.UUID]:
    if not s or s == "admin-all":
        return None
    try: return uuid.UUID(s)
    except ValueError: pass
    res = await db.execute(select(Branch).where(Branch.slug == s))
    b = res.scalar_one_or_none()
    return b.id if b else None


async def _branch_uuids_from_slugs(db, slugs: list[str]) -> list[uuid.UUID]:
    """Resolve a list of branch slugs (or uuid strings) → branch uuids."""
    out: list[uuid.UUID] = []
    for s in slugs or []:
        bid = await _branch_uuid_from_slug(db, s)
        if bid and bid not in out:
            out.append(bid)
    return out


async def _replace_assignments(
    db,
    user_id: uuid.UUID,
    branch_ids: Optional[list[uuid.UUID]],
    class_ids: Optional[list[uuid.UUID]],
) -> None:
    """Replace the user's branch/class assignment rows (delete old, insert new).
    Permissive — does not validate active status. None means 'leave unchanged'."""
    if branch_ids is not None:
        old = await db.execute(
            select(UserBranchAssignment).where(UserBranchAssignment.user_id == user_id)
        )
        for row in old.scalars().all():
            await db.delete(row)
        for bid in branch_ids:
            db.add(UserBranchAssignment(user_id=user_id, branch_id=bid))
    if class_ids is not None:
        old = await db.execute(
            select(UserClassAssignment).where(UserClassAssignment.user_id == user_id)
        )
        for row in old.scalars().all():
            await db.delete(row)
        for cid in class_ids:
            db.add(UserClassAssignment(user_id=user_id, class_id=cid))


def _class_uuids(class_ids: Optional[list[str]]) -> Optional[list[uuid.UUID]]:
    if class_ids is None:
        return None
    out: list[uuid.UUID] = []
    for s in class_ids:
        try:
            cid = uuid.UUID(s)
        except (ValueError, TypeError):
            continue
        if cid not in out:
            out.append(cid)
    return out


def _class_uuid(class_id: Optional[str]) -> Optional[uuid.UUID]:
    if not class_id:
        return None
    try:
        return uuid.UUID(class_id)
    except (ValueError, TypeError):
        return None


class AccountCreate(BaseModel):
    name: str
    role: str = "staff"
    email: EmailStr
    branchId: Optional[str] = None
    phone: Optional[str] = None
    password: str
    branchIds: Optional[list[str]] = None  # branch SLUGS (CTV many-to-many)
    classIds: Optional[list[str]] = None   # class UUID strings (CTV many-to-many)
    assignedClassId: Optional[str] = None  # guest kiosk: single class UUID


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    branchId: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    active: Optional[bool] = None
    branchIds: Optional[list[str]] = None  # branch SLUGS (CTV many-to-many)
    classIds: Optional[list[str]] = None   # class UUID strings (CTV many-to-many)
    assignedClassId: Optional[str] = None  # guest kiosk: single class UUID


@router.post("", status_code=201)
async def create_account(data: AccountCreate, current_user: AdminUser, db: DB):
    if data.role not in ("admin", "staff", "collaborator", "guest"):
        raise HTTPException(400, "invalid_role")
    # Ensure email is unique
    exists = await db.execute(select(User).where(User.email == data.email))
    if exists.scalar_one_or_none():
        raise HTTPException(409, "duplicate_email")
    branch_uuid = await _branch_uuid_from_slug(db, data.branchId)
    u = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.name,
        phone=data.phone,
        role=RoleName(data.role),
        branch_id=branch_uuid,
        assigned_class_id=_class_uuid(data.assignedClassId),  # guest kiosk
        is_active=True,
    )
    db.add(u)
    await db.flush()  # need u.id for assignment rows
    # Many-to-many assignments (permissive — no active validation).
    branch_ids = await _branch_uuids_from_slugs(db, data.branchIds) if data.branchIds is not None else None
    class_ids = _class_uuids(data.classIds)
    await _replace_assignments(db, u.id, branch_ids, class_ids)
    await log_action(
        db,
        user_id=current_user.id,
        branch_id=current_user.branch_id,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        action="accounts.create",
        resource="accounts",
        resource_id=u.id,
        new_values={
            "email": u.email, "name": u.full_name, "role": data.role,
            "branchIds": data.branchIds or [], "classIds": data.classIds or [],
        },
    )
    await db.commit()
    await db.refresh(u)
    slug = (await resolve_branch_slugs(db, [u])).get(u.branch_id) if u.branch_id else (await first_branch_slug(db) if u.role == RoleName.admin else None)
    assignments = (await load_user_assignments(db, [u.id])).get(u.id, {})
    return WireUser.from_user(
        u, branch_id_override=slug,
        branch_ids=assignments.get("branchIds", []),
        class_ids=assignments.get("classIds", []),
    ).model_dump()


@router.patch("/{user_id}")
async def update_account(user_id: str, data: AccountUpdate, current_user: AdminUser, db: DB):
    try: u_uuid = uuid.UUID(user_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    u = await db.get(User, u_uuid)
    if not u: raise HTTPException(404, "account_not_found")
    fields = data.model_dump(exclude_unset=True)
    if "name" in fields:  u.full_name = fields["name"]
    if "phone" in fields: u.phone = fields["phone"]
    if "email" in fields: u.email = fields["email"]
    if "role" in fields and fields["role"] in ("admin", "staff", "collaborator", "guest"):
        u.role = RoleName(fields["role"])
    if "branchId" in fields:
        u.branch_id = await _branch_uuid_from_slug(db, fields["branchId"])
    if "assignedClassId" in fields:
        u.assigned_class_id = _class_uuid(fields["assignedClassId"])  # guest kiosk
    if "active" in fields:
        u.is_active = bool(fields["active"])
    # Many-to-many assignments — only touch when the key was provided.
    branch_ids = (
        await _branch_uuids_from_slugs(db, fields["branchIds"]) if "branchIds" in fields else None
    )
    class_ids = _class_uuids(fields["classIds"]) if "classIds" in fields else None
    if branch_ids is not None or class_ids is not None:
        await _replace_assignments(db, u.id, branch_ids, class_ids)
    await log_action(
        db,
        user_id=current_user.id,
        branch_id=current_user.branch_id,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        action="accounts.update",
        resource="accounts",
        resource_id=u.id,
        new_values=fields,
    )
    await db.commit()
    await db.refresh(u)
    slug = (await resolve_branch_slugs(db, [u])).get(u.branch_id) if u.branch_id else (await first_branch_slug(db) if u.role == RoleName.admin else None)
    assignments = (await load_user_assignments(db, [u.id])).get(u.id, {})
    return WireUser.from_user(
        u, branch_id_override=slug,
        branch_ids=assignments.get("branchIds", []),
        class_ids=assignments.get("classIds", []),
    ).model_dump()


class ResetPasswordRequest(BaseModel):
    newPassword: str


@router.post("/{user_id}/reset-password")
async def reset_password(user_id: str, data: ResetPasswordRequest, current_user: AdminUser, db: DB):
    try: u_uuid = uuid.UUID(user_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    u = await db.get(User, u_uuid)
    if not u: raise HTTPException(404, "account_not_found")
    u.password_hash = hash_password(data.newPassword)
    await db.commit()
    return {"ok": True}


@router.delete("/{user_id}")
async def delete_account(user_id: str, current_user: AdminUser, db: DB):
    """Soft-delete a staff account. Sets `deleted_at = NOW()` + `is_active = False`,
    blocking login and hiding the row from /api/accounts. Hard delete is unsafe
    because users.id is referenced by audit_logs, students, classes, etc. with
    no cascade — soft-delete keeps historical references intact."""
    try: u_uuid = uuid.UUID(user_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    if u_uuid == current_user.id:
        raise HTTPException(400, "cannot_delete_self")
    u = await db.get(User, u_uuid)
    if not u or u.deleted_at is not None:
        raise HTTPException(404, "account_not_found")
    if u.role == RoleName.admin:
        res = await db.execute(
            select(func.count()).select_from(User).where(
                User.role == RoleName.admin,
                User.is_active == True,
                User.deleted_at.is_(None),
                User.id != u.id,
            )
        )
        if (res.scalar_one() or 0) == 0:
            raise HTTPException(400, "cannot_delete_last_admin")
    u.deleted_at = datetime.now(timezone.utc)
    u.is_active = False
    await log_action(
        db,
        user_id=current_user.id,
        branch_id=current_user.branch_id,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        action="accounts.delete",
        resource="accounts",
        resource_id=u.id,
        old_values={
            "email": u.email,
            "name": u.full_name,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
        },
    )
    await db.commit()
    return {"ok": True, "id": str(u.id)}
