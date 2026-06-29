import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


SESSION_TTL_DAYS = 90  # 90 days — long enough for CTVs who rarely log out


def create_session_token(subject: str, role: str, branch_id: str | None = None) -> str:
    """Long-lived JWT (90 days) issued at login, stored in the mgt_session cookie."""
    expire = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
    payload = {
        "sub": subject,
        "role": role,
        "branch_id": branch_id,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}") from e
