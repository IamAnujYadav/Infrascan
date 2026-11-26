"""Register and login."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.security.tokens import create_access_token
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

WRONG_LOGIN = "Incorrect email or password."


@router.post("/register", response_model=UserOut, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Create an account. New accounts are always Infrastructure Inspectors;
    an administrator can change the role later."""
    try:
        return auth_service.register_user(db, body.email, body.password, body.full_name)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password (JSON). Send the token in the header
    `Authorization: Bearer <token>` on every later request."""
    user = auth_service.authenticate(db, body.email, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail=WRONG_LOGIN)
    return TokenResponse(access_token=create_access_token(user.id, user.role), user=user)


@router.post("/token", include_in_schema=True)
def login_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Same login, as a form (username = email). The Authorize button of /docs uses this."""
    user = auth_service.authenticate(db, form.username, form.password)
    if user is None:
        raise HTTPException(status_code=401, detail=WRONG_LOGIN)
    return {"access_token": create_access_token(user.id, user.role), "token_type": "bearer"}