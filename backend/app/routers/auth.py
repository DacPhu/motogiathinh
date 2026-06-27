"""POST /api/auth/login, /logout, /password — HttpOnly cookie session."""

from fastapi import APIRouter, Response

from app.core.security import SESSION_TTL_DAYS
from app.dependencies import DB, SESSION_COOKIE, CurrentUser, load_user_assignments, resolve_branch_slug
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    WireUser,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    from app.config import settings
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=not settings.DEBUG,
        max_age=SESSION_TTL_DAYS * 24 * 3600,
        path="/",
    )


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest, db: DB, response: Response):
    user, token = await AuthService(db).login(data)
    _set_session_cookie(response, token)
    branch_slug = await resolve_branch_slug(db, user)
    assignments = (await load_user_assignments(db, [user.id])).get(user.id, {})
    return LoginResponse(user=WireUser.from_user(
        user, branch_id_override=branch_slug,
        branch_ids=assignments.get("branchIds", []),
        class_ids=assignments.get("classIds", []),
    ), token=token)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=SESSION_COOKIE, path="/")
    return {"ok": True}


@router.post("/password")
async def change_password(data: ChangePasswordRequest, current_user: CurrentUser, db: DB):
    await AuthService(db).change_password(current_user, data)
    return {"ok": True}
