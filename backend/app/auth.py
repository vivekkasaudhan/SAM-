import hashlib
import hmac
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.models.database import SessionLocal, User

SESSION_COOKIE_NAME = "aquasense_session"

# PBKDF2 Password Hashing parameters
PBKDF2_ALGORITHM = "sha256"
PBKDF2_ITERATIONS = 120_000


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with a unique random salt."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        PBKDF2_ALGORITHM,
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2:{PBKDF2_ALGORITHM}:{PBKDF2_ITERATIONS}${salt}${dk.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against the stored PBKDF2 hash."""
    if not hashed_password or not hashed_password.startswith("pbkdf2:"):
        return False
    try:
        header, salt, hash_hex = hashed_password.split("$")
        algo_info = header.split(":")
        iterations = int(algo_info[2])
        dk = hashlib.pbkdf2_hmac(
            PBKDF2_ALGORITHM,
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


def create_session_token(username: str) -> str:
    """
    Generate a cryptographically signed session token:
    format: username:expiry_timestamp:signature
    """
    expires_at = int(
        (datetime.now(timezone.utc) + timedelta(hours=settings.session_expire_hours)).timestamp()
    )
    payload = f"{username}:{expires_at}"
    sig = hmac.new(
        settings.secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}:{sig}"


def verify_session_token(token: str) -> Optional[str]:
    """Verify signed session token and return username if valid and not expired."""
    if not token:
        return None
    try:
        parts = token.split(":")
        if len(parts) != 3:
            return None
        username, expires_at_str, sig = parts
        payload = f"{username}:{expires_at_str}"
        expected_sig = hmac.new(
            settings.secret_key.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, sig):
            return None

        # Check expiry
        expires_at = int(expires_at_str)
        now_ts = int(datetime.now(timezone.utc).timestamp())
        if now_ts > expires_at:
            return None

        return username
    except Exception:
        return None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def is_main_admin(user: Optional[User]) -> bool:
    """Return True if user has Main Admin role."""
    if not user or not user.role:
        return False
    return user.role.upper() in ("MAIN_ADMIN", "ADMIN", "SUPER_ADMIN")


def is_subadmin(user: Optional[User]) -> bool:
    """Return True if user has Subadmin role."""
    if not user or not user.role:
        return False
    return user.role.upper() == "SUBADMIN"


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency to require an authenticated active user (Main Admin or Subadmin).
    Supports either HttpOnly cookie or Authorization Bearer header.
    Returns 401 for unauthenticated requests and 403 for inactive accounts.
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    username = verify_session_token(token) if token else None

    # Fallback to Authorization Bearer header if cookie is missing or failed verification
    if not username:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            bearer_token = auth_header[7:].strip()
            username = verify_session_token(bearer_token)

    if not username:
        raise HTTPException(status_code=401, detail="Authentication required or session expired")

    user = db.query(User).filter(User.username == username, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=403, detail="Account not found or inactive")

    return user


# Backwards compatibility alias
get_current_admin = get_current_user


def require_main_admin(
    user: User = Depends(get_current_user),
) -> User:
    """Dependency that enforces Main Admin privileges. Returns 403 for Subadmins."""
    if not is_main_admin(user):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Main Admin privileges required.",
        )
    return user


def get_optional_user(
    request: Request,
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Dependency to retrieve the authenticated user if session is present, without requiring auth."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    username = verify_session_token(token) if token else None

    if not username:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            bearer_token = auth_header[7:].strip()
            username = verify_session_token(bearer_token)

    if not username:
        return None

    return db.query(User).filter(User.username == username, User.is_active == True).first()

