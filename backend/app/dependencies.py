import uuid
from typing import Annotated, Optional

from fastapi import Cookie, Depends, HTTPException, status
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
) -> User:
    """Reads the HttpOnly cookie set by /api/auth/login and resolves the user."""
    if not mgt_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="no_session")
    try:
        payload = decode_token(mgt_session)
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


async def first_branch_slug(db: AsyncSession) -> Optional[str]:
    """First real branch's slug — used as the admin's wire-shape branchId
    fallback so frontend lookups (Sidebar branch.name, BRANCH_TONES) work."""
    from app.models.branch import Branch
    res = await db.execute(
        select(Branch).where(Branch.is_active == True).order_by(Branch.created_at.asc()).limit(1)
    )
    first = res.scalar_one_or_none()
    return (first.slug if first and first.slug else (str(first.id) if first else None))


def is_guest(user: User) -> bool:
    return user.role == RoleName.guest


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
DB = Annotated[AsyncSession, Depends(get_db)]
