import uuid
from datetime import date, datetime, timezone
from typing import Annotated, Optional

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.database.session import get_db
from app.models.enums import RoleName
from app.models.user import User

SESSION_COOKIE = "mgt_session"


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    mgt_session: Annotated[Optional[str], Cookie(alias=SESSION_COOKIE)] = None,
    authorization: Annotated[Optional[str], Header()] = None,
) -> User:
    """Resolves the user from the HttpOnly cookie (web) OR an
    `Authorization: Bearer <token>` header (native app — same JWT)."""
    token = mgt_session
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="no_session")
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_session")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_session")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_inactive")
    return user


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != RoleName.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin_only")
    return current_user


def scope_to_branch(user: User) -> Optional[uuid.UUID]:
    """Staff is scoped to its own branch; admin sees all (returns None)."""
    return None if user.role == RoleName.admin else user.branch_id


def is_guest(user: User) -> bool:
    """Guest = single-class kiosk operator (scoped by assigned_class_id +
    responsible_staff_id). Distinct from collaborator (M2M class assignments)."""
    return user.role == RoleName.guest


async def resolve_branch_slug(db: AsyncSession, user: User) -> Optional[str]:
    """Returns the slug to surface as user.branchId in the wire shape.

    Admin without a personal branch → first real branch's slug (so the
    Sidebar's `D.getBranch(user.branchId).name` resolves AND the frozen
    BRANCH_TONES lookup hits a known palette entry — br-1/br-2/br-3).
    Staff → their branch's slug (or UUID fallback)."""
    if user.branch_id:
        from app.models.branch import Branch
        b = await db.get(Branch, user.branch_id)
        return (b.slug if b and b.slug else str(user.branch_id))
    if user.role == RoleName.admin:
        from app.models.branch import Branch
        res = await db.execute(
            select(Branch).where(Branch.is_active == True).order_by(Branch.created_at.asc()).limit(1)
        )
        first = res.scalar_one_or_none()
        return (first.slug if first and first.slug else (str(first.id) if first else None))
    return None


async def resolve_branch_slugs(db: AsyncSession, users: list[User]) -> dict[uuid.UUID, str]:
    """Batched resolver for accounts list."""
    ids = {u.branch_id for u in users if u.branch_id}
    if not ids:
        return {}
    from app.models.branch import Branch
    result = await db.execute(select(Branch).where(Branch.id.in_(ids)))
    return {b.id: (b.slug or str(b.id)) for b in result.scalars().all()}


async def load_user_assignments(db: AsyncSession, user_ids: list[uuid.UUID]) -> dict:
    """Batch-load CTV many-to-many assignments →
    {user_id: {"branchIds": [slug], "classIds": [uuid str]}}.
    branchIds surface as branch slugs; classIds as opaque uuid strings."""
    from app.models.branch import Branch
    from app.models.user_assignment import UserBranchAssignment, UserClassAssignment

    out: dict = {uid: {"branchIds": [], "classIds": []} for uid in user_ids}
    if not user_ids:
        return out
    br_res = await db.execute(
        select(UserBranchAssignment.user_id, UserBranchAssignment.branch_id).where(
            UserBranchAssignment.user_id.in_(user_ids),
            UserBranchAssignment.deleted_at.is_(None),
        )
    )
    br_rows = br_res.all()
    branch_ids = {bid for _, bid in br_rows}
    slug_map: dict = {}
    if branch_ids:
        b_res = await db.execute(select(Branch).where(Branch.id.in_(branch_ids)))
        slug_map = {b.id: (b.slug or str(b.id)) for b in b_res.scalars().all()}
    for uid, bid in br_rows:
        out[uid]["branchIds"].append(slug_map.get(bid, str(bid)))
    cl_res = await db.execute(
        select(UserClassAssignment.user_id, UserClassAssignment.class_id).where(
            UserClassAssignment.user_id.in_(user_ids),
            UserClassAssignment.deleted_at.is_(None),
        )
    )
    for uid, cid in cl_res.all():
        out[uid]["classIds"].append(str(cid))
    return out


async def first_branch_slug(db: AsyncSession) -> Optional[str]:
    """First real branch's slug — used as the admin's wire-shape branchId
    fallback so frontend lookups (Sidebar branch.name, BRANCH_TONES) work."""
    from app.models.branch import Branch
    res = await db.execute(
        select(Branch).where(Branch.is_active == True).order_by(Branch.created_at.asc()).limit(1)
    )
    first = res.scalar_one_or_none()
    return (first.slug if first and first.slug else (str(first.id) if first else None))


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Permission system
# ---------------------------------------------------------------------------

ALL_RESOURCES = (
    "students", "payments", "classes", "branches", "accounts",
    "vehicles", "teachers", "fee_plans", "promotions", "activity_log",
)


def _all(v: bool) -> dict[str, dict[str, bool]]:
    return {res: {"c": v, "r": v, "u": v, "d": v} for res in ALL_RESOURCES}


def permissions_for_role(role: RoleName) -> dict[str, dict[str, bool]]:
    """FIXED permission set per role — there is NO per-account customization.
    Each role is one immutable set, not editable and not different per account.
      - admin / staff → full CRUD on every resource (admin-only mutations are
        separately gated by the AdminUser dependency).
      - collaborator (CTV) → students create+read only.
      - guest (kiosk)       → students create+read+update (update = doc upload);
        per-row ownership is enforced in the route handlers.
    """
    if role in (RoleName.admin, RoleName.staff):
        return _all(True)
    out = _all(False)
    if role == RoleName.collaborator:
        out["students"] = {"c": True, "r": True, "u": True, "d": False}
    elif role == RoleName.guest:
        out["students"] = {"c": True, "r": True, "u": True, "d": False}
    return out


async def load_permissions(
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, dict[str, bool]]:
    """Per-request {resource: {c, r, u, d}} map — purely role-derived (fixed)."""
    return permissions_for_role(user.role)


PermissionMap = Annotated[dict[str, dict[str, bool]], Depends(load_permissions)]


def require_permission(resource: str, verb: str):
    """Dependency factory. verb in {'create','read','update','delete'}."""
    if verb not in ("create", "read", "update", "delete"):
        raise ValueError(f"unknown verb {verb}")
    short = verb[0]

    async def _dep(perms: PermissionMap) -> None:
        if not perms.get(resource, {}).get(short, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"permission_denied:{resource}.{verb}",
            )

    return _dep


# ---------------------------------------------------------------------------
# Active-class access scoping
# ---------------------------------------------------------------------------

ACTIVE_CLASS_STATUSES = ("đang mở", "đang diễn ra")


def compute_class_status(cls, now: datetime) -> str:
    """Mirror the frontend status formula:
    - if a status override is set (cancelled/completed → đã hủy/đã kết thúc), use it;
    - else if examDate (ngay_ket_thuc) < now → "đã kết thúc";
    - else if openDate (ngay_khai_giang) > now → "đang mở";
    - else → "đang diễn ra".
    """
    val = cls.trang_thai.value if hasattr(cls.trang_thai, "value") else cls.trang_thai
    if val == "cancelled":
        return "đã hủy"
    if val == "completed":
        return "đã kết thúc"

    today = now.date() if isinstance(now, datetime) else now
    exam = cls.ngay_ket_thuc
    if exam is not None:
        exam_d = exam.date() if isinstance(exam, datetime) else exam
        if exam_d < today:
            return "đã kết thúc"
    open_ = cls.ngay_khai_giang
    if open_ is not None:
        open_d = open_.date() if isinstance(open_, datetime) else open_
        if open_d > today:
            return "đang mở"
    return "đang diễn ra"



async def accessible_class_ids(db: AsyncSession, user: User) -> Optional[set[uuid.UUID]]:
    """Class ids a COLLABORATOR may access, gated to ACTIVE classes at read time.

    - admin → None (no filter; sees all).
    - staff → None (NOT class-gated; branch scoping is applied in the routers,
      unchanged from before — staff still see every class incl. đã kết thúc).
    - collaborator → set of active classes among the user's assigned classes.
    """
    from app.models.class_model import Class
    from app.models.user_assignment import UserClassAssignment

    # Only collaborators (CTV) are class-gated. Everyone else → None (no filter).
    if user.role != RoleName.collaborator:
        return None

    now = datetime.now(timezone.utc)
    query = (
        select(Class)
        .join(UserClassAssignment, UserClassAssignment.class_id == Class.id)
        .where(
            Class.deleted_at.is_(None),
            UserClassAssignment.user_id == user.id,
            UserClassAssignment.deleted_at.is_(None),
        )
    )
    result = await db.execute(query)
    return {
        c.id
        for c in result.scalars().all()
        if compute_class_status(c, now) in ACTIVE_CLASS_STATUSES
    }
