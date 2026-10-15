"""
Environment-based initial admin bootstrap CLI command for AquaSense.
Usage:
  python -m app.bootstrap_admin [--username <name>] [--email <email>] [--password <pass>]
  or set env vars:
  INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD
Does not create public registration or hardcoded credentials.
"""

import sys
import argparse
from app.config import settings
from app.models.database import SessionLocal, init_db, User
from app.auth import hash_password


def bootstrap_admin(username: str = None, email: str = None, password: str = None) -> bool:
    init_db()

    username = username or settings.initial_admin_username or "admin"
    email = email or settings.initial_admin_email or "admin@aquasense.local"
    password = password or settings.initial_admin_password

    if not password:
        print("[BOOTSTRAP ERROR] Admin password must be provided via command argument or INITIAL_ADMIN_PASSWORD environment variable.")
        return False

    if len(password) < 8:
        print("[BOOTSTRAP ERROR] Admin password must be at least 8 characters long.")
        return False

    session = SessionLocal()
    try:
        existing_user = session.query(User).filter(
            (User.username == username) | (User.email == email)
        ).first()

        hashed = hash_password(password)

        if existing_user:
            # Update password and ensure active with MAIN_ADMIN role
            existing_user.username = username
            existing_user.email = email
            existing_user.hashed_password = hashed
            existing_user.role = "MAIN_ADMIN"
            existing_user.is_active = True
            session.commit()
            print(f"[BOOTSTRAP SUCCESS] Existing admin user '{username}' credentials updated.")
            return True
        else:
            new_user = User(
                username=username,
                email=email,
                full_name="AquaSense Platform Administrator",
                hashed_password=hashed,
                role="MAIN_ADMIN",
                is_active=True,
            )
            session.add(new_user)
            session.commit()
            print(f"[BOOTSTRAP SUCCESS] Initial admin user '{username}' successfully created.")
            return True
    except Exception as e:
        session.rollback()
        print(f"[BOOTSTRAP ERROR] Failed to bootstrap admin: {e}")
        return False
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bootstrap initial admin account for AquaSense")
    parser.add_argument("--username", "-u", default=None, help="Admin username")
    parser.add_argument("--email", "-e", default=None, help="Admin email")
    parser.add_argument("--password", "-p", default=None, help="Admin password")

    args = parser.parse_args()
    success = bootstrap_admin(username=args.username, email=args.email, password=args.password)
    sys.exit(0 if success else 1)
