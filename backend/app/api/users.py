"""Profile, password, and user management (administrator)."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AuditLog, User
from app.schemas.auth import AuditLogOut, PasswordChange, ProfileUpdate, UserAdminUpdate, UserOut
from app.security.deps import get_current_user, require_roles
from app.security.roles import Role
from app.services import auth_service

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/users/me", response_model=UserOut)
def read_me(user: User = Depends(get_current_user)):
    return user


@router.patch("/users/me", response_model=UserOut)
def update_me(body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.full_name = body.full_name.strip()
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/me/password")
def change_my_password(body: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        auth_service.change_password(db, user, body.current_password, body.new_password)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return {"message": "Password changed."}


# ---------------- administrator only ----------------
@router.get("/users", response_model=List[UserOut])
def list_users(admin: User = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.id)).all()


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserAdminUpdate,
                admin: User = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    """Change the role of a user, or enable / disable the account."""
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.id == admin.id and (
            (body.role is not None and body.role != Role.admin) or body.is_active is False):
        raise HTTPException(status_code=400, detail="You cannot remove your own administrator access.")

    if body.role is not None:
        target.role = body.role.value
    if body.is_active is not None:
        target.is_active = body.is_active
    db.commit()
    db.refresh(target)
    auth_service.write_audit(db, admin.id, "user_updated",
                             f"user={target.id} role={target.role} active={target.is_active}")
    return target


@router.get("/audit-logs", response_model=List[AuditLogOut])
def audit_logs(limit: int = 100, admin: User = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    """Latest actions (login, register, role changes ...)."""
    limit = max(1, min(limit, 500))
    return db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)).all()