"""GET /api/me — returns the authenticated user."""

from fastapi import APIRouter

from app.dependencies import DB, CurrentUser, resolve_branch_slug
from app.schemas.auth import WireUser

router = APIRouter(tags=["me"])


@router.get("/me")
async def me(current_user: CurrentUser, db: DB):
    branch_slug = await resolve_branch_slug(db, current_user)
    return {
        "user": WireUser.from_user(current_user, branch_id_override=branch_slug),
    }
