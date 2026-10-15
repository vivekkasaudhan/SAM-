from fastapi import APIRouter, HTTPException, Depends, Response, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
import re

from app.models.database import User, Well
from app.auth import (
    get_db,
    hash_password,
    verify_password,
    create_session_token,
    get_current_user,
    get_current_admin,
    require_main_admin,
    get_optional_user,
    is_subadmin,
    is_main_admin,
    SESSION_COOKIE_NAME,
)

router = APIRouter()


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class SignUpRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = Field(None, max_length=255)


class AdminUserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: str = "SUBADMIN"
    is_active: bool

    class Config:
        from_attributes = True


class SubadminOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: str = "SUBADMIN"
    is_active: bool
    created_at: datetime
    wells_count: int = 0

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    message: str
    token: str
    user: AdminUserOut


@router.post("/auth/signup", response_model=LoginResponse, status_code=201)
def admin_signup(
    payload: SignUpRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
):
    """Register a new user (default: SUBADMIN). Subadmins cannot create accounts."""
    caller = get_optional_user(request, db)
    if caller and is_subadmin(caller):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Subadmins cannot create or manage accounts.",
        )

    username = payload.username.strip()
    email = payload.email.strip().lower()

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")

    # Check if username or email already exists
    existing = db.query(User).filter(
        (User.username == username) | (User.email == email)
    ).first()
    if existing:
        if existing.username.lower() == username.lower():
            raise HTTPException(status_code=400, detail="Username is already taken")
        raise HTTPException(status_code=400, detail="Email is already registered")

    hashed = hash_password(payload.password)
    new_user = User(
        username=username,
        email=email,
        full_name=payload.full_name.strip() if payload.full_name else None,
        hashed_password=hashed,
        role="SUBADMIN",
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_session_token(new_user.username)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=24 * 3600,
        path="/",
    )

    return {
        "message": "Admin registration successful",
        "token": token,
        "user": AdminUserOut.model_validate(new_user),
    }


@router.post("/auth/login", response_model=LoginResponse)
def admin_login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate administrator and return session cookie / token."""
    from sqlalchemy import func
    login_id = payload.username_or_email.strip()
    user = (
        db.query(User)
        .filter(
            ((func.lower(User.username) == login_id.lower()) | (func.lower(User.email) == login_id.lower())),
            User.is_active == True,
        )
        .first()
    )

    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_session_token(user.username)

    # Set secure HttpOnly cookie (SameSite Lax allows cross-port local development)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in HTTPS production
        max_age=24 * 3600,
        path="/",
    )

    return {
        "message": "Login successful",
        "token": token,
        "user": AdminUserOut.model_validate(user),
    }


@router.post("/auth/logout")
def admin_logout(response: Response):
    """Log out admin and clear session cookie."""
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"message": "Logged out successfully"}


@router.get("/auth/me", response_model=AdminUserOut)
def get_current_admin_info(admin: User = Depends(get_current_admin)):
    """Return currently authenticated user details."""
    return AdminUserOut.model_validate(admin)


# ── Subadmin Account Management (Main Admin Only) ───────────────────────────

@router.get("/auth/subadmins", response_model=List[SubadminOut])
def list_subadmins(
    db: Session = Depends(get_db),
    admin: User = Depends(require_main_admin),
):
    """Main Admin endpoint: List all registered Subadmin accounts with created well counts."""
    users = db.query(User).filter(User.role == "SUBADMIN").order_by(User.created_at.desc()).all()
    results = []
    for u in users:
        w_count = db.query(Well).filter(Well.created_by == u.id).count()
        results.append(
            SubadminOut(
                id=u.id,
                username=u.username,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=u.is_active,
                created_at=u.created_at or datetime.utcnow(),
                wells_count=w_count,
            )
        )
    return results


@router.post("/auth/subadmins", response_model=SubadminOut, status_code=201)
def create_subadmin(
    payload: SignUpRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_main_admin),
):
    """Main Admin endpoint: Provision a new Subadmin account."""
    username = payload.username.strip()
    email = payload.email.strip().lower()

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")

    existing = db.query(User).filter(
        (User.username == username) | (User.email == email)
    ).first()
    if existing:
        if existing.username.lower() == username.lower():
            raise HTTPException(status_code=400, detail="Username is already taken")
        raise HTTPException(status_code=400, detail="Email is already registered")

    hashed = hash_password(payload.password)
    new_subadmin = User(
        username=username,
        email=email,
        full_name=payload.full_name.strip() if payload.full_name else None,
        hashed_password=hashed,
        role="SUBADMIN",
        is_active=True,
    )
    db.add(new_subadmin)
    db.commit()
    db.refresh(new_subadmin)

    return SubadminOut(
        id=new_subadmin.id,
        username=new_subadmin.username,
        email=new_subadmin.email,
        full_name=new_subadmin.full_name,
        role=new_subadmin.role,
        is_active=new_subadmin.is_active,
        created_at=new_subadmin.created_at or datetime.utcnow(),
        wells_count=0,
    )


@router.delete("/auth/subadmins/{user_id}")
def delete_subadmin(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_main_admin),
):
    """Main Admin endpoint: Delete a Subadmin account."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own Main Admin account.")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail=f"Subadmin with ID {user_id} not found.")

    if is_main_admin(target):
        raise HTTPException(status_code=400, detail="Cannot delete a Main Admin account.")

    # Reassign wells created by this Subadmin to Main Admin to preserve historical monitoring
    db.query(Well).filter(Well.created_by == user_id).update({"created_by": admin.id})
    db.delete(target)
    db.commit()

    return {"message": f"Subadmin '{target.username}' deleted successfully", "id": user_id}

