"""JWT access tokens."""
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from app.config import settings

ALGORITHM = "HS256"


def create_access_token(user_id: int, role: str, expires_minutes: Optional[int] = None) -> str:
    minutes = settings.access_token_expire_minutes if expires_minutes is None else expires_minutes
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Returns the payload. Raises jwt.PyJWTError if the token is wrong or expired."""
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])