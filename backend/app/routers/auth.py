from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.dependencies import DB, CurrentUser
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: DB):
    return await AuthService(db).login(data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: DB):
    return await AuthService(db).refresh(data.refresh_token)


@router.post("/logout")
async def logout(request: Request, current_user: CurrentUser, db: DB):
    # Extract JTI from token
    from app.core.security import decode_token

    auth_header = request.headers.get("authorization", "")
    token = auth_header.replace("Bearer ", "")
    try:
        payload = decode_token(token)
        jti = payload.get("jti", "")
    except Exception:
        jti = ""
    await AuthService(db).logout(current_user, jti)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser):
    return UserOut.model_validate(current_user)
