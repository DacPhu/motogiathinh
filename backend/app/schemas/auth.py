import uuid

from pydantic import BaseModel, EmailStr

from app.models.enums import RoleName
from app.schemas.common import BaseSchema


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseSchema):
    id: uuid.UUID
    email: str
    phone: str | None
    full_name: str | None
    role: RoleName
    branch_id: uuid.UUID | None
    is_active: bool


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
