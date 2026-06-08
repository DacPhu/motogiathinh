"""Auth request / response schemas for the cookie-based session API.

LoginRequest is the only POST body; LoginResponse + WireUser are the
canonical wire shapes consumed by the frontend data-loader.
"""

import uuid
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.user import User
from app.utils.dates import iso_to_vn_datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


class WireUser(BaseModel):
    id: str
    name: str
    role: str  # "admin" | "staff"
    branchId: Optional[str]
    email: str
    phone: Optional[str]
    lastActive: Optional[str]  # "dd/mm/yyyy HH:MM:SS"
    active: bool
    branchIds: List[str] = Field(default_factory=list)  # branch SLUGS (CTV many-to-many)
    classIds: List[str] = Field(default_factory=list)   # class UUID strings (CTV many-to-many)

    @classmethod
    def from_user(
        cls,
        u: User,
        branch_id_override: Optional[str] = None,
        branch_ids: Optional[List[str]] = None,
        class_ids: Optional[List[str]] = None,
    ) -> "WireUser":
        """branch_id_override lets the caller pass a slug (`br-1` etc.)
        instead of the raw UUID — the Sidebar looks the value up in
        `D.getBranch(user.branchId)` against /api/branches which returns slugs.
        For admin users without a DB branch_id, the caller should pass the
        first real branch's slug as override (see resolve_branch_slug).
        """
        role = u.role.value if hasattr(u.role, "value") else str(u.role)
        if branch_id_override is not None:
            branchId: Optional[str] = branch_id_override
        elif u.branch_id:
            branchId = str(u.branch_id)
        else:
            branchId = None
        return cls(
            id=str(u.id),
            name=u.full_name or (u.email.split("@")[0] if u.email else "—"),
            role=role,
            branchId=branchId,
            email=u.email,
            phone=u.phone,
            lastActive=iso_to_vn_datetime(u.last_login_at),
            active=u.is_active,
            branchIds=branch_ids or [],
            classIds=class_ids or [],
        )


class LoginResponse(BaseModel):
    user: WireUser
    token: Optional[str] = None  # also returned in-body for native (Bearer) clients
