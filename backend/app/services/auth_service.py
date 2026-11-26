"""Business logic for users and login."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import AuditLog, User
from app.security.passwords import hash_password, verify_password
from app.security.roles import Role


def write_audit(db: Session, user_id: Optional[int], action: str, detail: str = ""):
    db.add(AuditLog(user_id=user_id, action=action, detail=detail[:500]))
    db.commit()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def register_user(db: Session, email: str, password: str, full_name: str, role: str = Role.inspector.value) -> User:
    if get_user_by_email(db, email):
        raise ValueError("A user with this email already exists.")
    user = User(
        email=email.strip().lower(),
        full_name=full_name.strip(),
        hashed_password=hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    write_audit(db, user.id, "register", f"role={user.role}")
    return user


def authenticate(db: Session, email: str, password: str) -> Optional[User]:
    """Returns the user, or None when email / password is wrong or the user is disabled."""
    user = get_user_by_email(db, email)
    if user is None or not user.is_active or not verify_password(password, user.hashed_password):
        write_audit(db, user.id if user else None, "login_failed", email.strip().lower())
        return None
    write_audit(db, user.id, "login")
    return user


def change_password(db: Session, user: User, current_password: str, new_password: str):
    if not verify_password(current_password, user.hashed_password):
        raise ValueError("Current password is wrong.")
    user.hashed_password = hash_password(new_password)
    db.commit()
    write_audit(db, user.id, "password_changed")


def seed_admin(db: Session):
    """Create the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD (.env)."""
    if not settings.admin_email or not settings.admin_password:
        print("NOTE: ADMIN_EMAIL / ADMIN_PASSWORD are not set in .env, so no administrator was created.")
        return
    if get_user_by_email(db, settings.admin_email):
        return
    register_user(db, settings.admin_email, settings.admin_password, "Administrator", role=Role.admin.value)
    print(f"Administrator created: {settings.admin_email}")