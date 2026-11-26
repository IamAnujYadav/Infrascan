"""FastAPI dependencies: who is logged in, and what are they allowed to do."""
from typing import Optional

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import User
from app.security.roles import Role
from app.security.tokens import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


def _user_from_token(token: Optional[str], db: Session) -> User:
    error = HTTPException(status_code=401, detail="Not logged in, or the login has expired.",
                          headers={"WWW-Authenticate": "Bearer"})
    if not token:
        raise error
    try:
        payload = decode_token(token)
        user = db.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise error
    if user is None or not user.is_active:
        raise error
    return user


def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    return _user_from_token(token, db)


def optional_login(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    """For endpoints that are open while REQUIRE_LOGIN=false (development)."""
    if not settings.require_login:
        return None
    return _user_from_token(token, db)


def require_roles(*roles: Role):
    """Use as a dependency: only these roles may enter."""
    allowed = {role.value for role in roles}

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail="You do not have permission for this action.")
        return user

    return checker