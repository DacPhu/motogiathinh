"""Accounts CRUD (admin-only mutations)."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select

from app.core.security import hash_password
from app.dependencies import DB, AdminUser, CurrentUser, first_branch_slug, resolve_branch_slugs
from app.models.branch import Branch
from app.models.class_model import Class
from app.models.enums import RoleName
from app.models.user import User
from app.schemas.auth import WireUser
from app.services.audit_service import log_action

router = APIRouter(prefix="/accounts", tags=["accounts"])

ROLES_ALLOWED = ("admin", "staff", "guest")


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
    return [
        WireUser.from_user(
            u,
            branch_id_override=(
                slug_map.get(u.branch_id) if u.branch_id
                else (admin_fallback if u.role == RoleName.admin else None)
            ),
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


async def _class_uuid_from_str(db, s: Optional[str]) -> Optional[uuid.UUID]:
    if not s: return None
    try: u = uuid.UUID(s)
    except ValueError: return None
    c = await db.get(Class, u)
    return c.id if c else None


class AccountCreate(BaseModel):
    name: str
    role: str = "staff"
    email: EmailStr
    branchId: Optional[str] = None
    phone: Optional[str] = None
    password: str
    assignedClassId: Optional[str] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    branchId: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    active: Optional[bool] = None
    assignedClassId: Optional[str] = None


@router.post("", status_code=201)
async def create_account(data: AccountCreate, current_user: AdminUser, db: DB):
    if data.role not in ROLES_ALLOWED:
        raise HTTPException(400, "invalid_role")
    exists = await db.execute(select(User).where(User.email == data.email))
    if exists.scalar_one_or_none():
        raise HTTPException(409, "duplicate_email")
    branch_uuid = await _branch_uuid_from_slug(db, data.branchId)
    assigned_class_uuid = await _class_uuid_from_str(db, data.assignedClassId)
    u = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.name,
        phone=data.phone,
        role=RoleName(data.role),
        branch_id=branch_uuid,
        assigned_class_id=assigned_class_uuid,
        is_active=True,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    slug = (await resolve_branch_slugs(db, [u])).get(u.branch_id) if u.branch_id else (await first_branch_slug(db) if u.role == RoleName.admin else None)
    return WireUser.from_user(u, branch_id_override=slug).model_dump()


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
    if "role" in fields and fields["role"] in ROLES_ALLOWED:
        u.role = RoleName(fields["role"])
    if "branchId" in fields:
        u.branch_id = await _branch_uuid_from_slug(db, fields["branchId"])
    if "assignedClassId" in fields:
        u.assigned_class_id = await _class_uuid_from_str(db, fields["assignedClassId"])
    if "active" in fields:
        u.is_active = bool(fields["active"])
    await db.commit()
    await db.refresh(u)
    slug = (await resolve_branch_slugs(db, [u])).get(u.branch_id) if u.branch_id else (await first_branch_slug(db) if u.role == RoleName.admin else None)
    return WireUser.from_user(u, branch_id_override=slug).model_dump()


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
