import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CacheKeys, cache
from app.core.security import decode_token
from app.database.session import get_db
from app.models.user import User

security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        jti: str = payload.get("jti")
    except ValueError:
        raise credentials_exception

    # Check token blacklist
    if await cache.exists(CacheKeys.BLACKLISTED_TOKEN.format(jti=jti)):
        raise credentials_exception

    # Try cache first
    cached = await cache.get(CacheKeys.USER_PROFILE.format(user_id=user_id))
    if cached:
        # Reconstruct user from cache (simplified — in production use proper serialization)
        user = await db.get(User, uuid.UUID(user_id))
    else:
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()

    if user is None or not user.is_active or user.deleted_at is not None:
        raise credentials_exception

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]
