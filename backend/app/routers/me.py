"""GET /api/me — returns the authenticated user + their permission map."""

from fastapi import APIRouter

from app.dependencies import (
    DB, CurrentUser, load_user_assignments, permissions_for_role, resolve_branch_slug,
)
from app.schemas.auth import WireUser

router = APIRouter(tags=["me"])


@router.get("/me")
async def me(current_user: CurrentUser, db: DB):
    branch_slug = await resolve_branch_slug(db, current_user)
    perms = permissions_for_role(current_user.role)  # fixed per-role set
    assignments = (await load_user_assignments(db, [current_user.id])).get(current_user.id, {})
    return {
        "user": WireUser.from_user(
            current_user, branch_id_override=branch_slug,
            branch_ids=assignments.get("branchIds", []),
            class_ids=assignments.get("classIds", []),
        ),
        "permissions": perms,
    }
