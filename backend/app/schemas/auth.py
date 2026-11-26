"""Request and response shapes for login, registration and users."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.security.roles import Role

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


def _check_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must have at least 8 characters.")
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password is too long (maximum 72 bytes).")
    return value


class RegisterRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=255)
    password: str
    full_name: str = Field(min_length=2, max_length=255)

    @field_validator("password")
    @classmethod
    def password_rules(cls, value):
        return _check_password(value)


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_rules(cls, value):
        return _check_password(value)


class UserAdminUpdate(BaseModel):
    role: Optional[Role] = None
    is_active: Optional[bool] = None


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int]
    action: str
    detail: str
    created_at: datetime