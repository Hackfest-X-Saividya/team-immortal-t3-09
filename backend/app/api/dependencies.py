from typing import Any, Dict, Optional
from fastapi import Depends, Header
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from app.core.exceptions import DatabaseConnectionException, ForbiddenException, UnauthorizedException
from app.core.security import decode_access_token
from app.db.mongodb import get_database

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_db_dep() -> Any:
    """Dependency that ensures the database connection is available."""
    db = get_database()
    if db is None:
        raise DatabaseConnectionException("Database is currently unavailable.")
    return db


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Any = Depends(get_db_dep),
) -> Dict[str, Any]:
    """
    Validates the JWT access token and loads the authenticated user.
    Server-side authentication validation.
    """
    if not token:
        raise UnauthorizedException("Authentication token required.")

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedException("Invalid token payload: missing subject identifier.")
    except JWTError:
        raise UnauthorizedException("Invalid or expired authentication token.")

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise UnauthorizedException("User associated with this token does not exist.")

    return user


async def get_current_workspace_id(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> str:
    """
    Enforces strict workspace authorization derived from the authenticated user.
    Never trusts client-supplied workspace IDs.
    """
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise UnauthorizedException("No authorized workspace associated with current user.")
    return workspace_id


def require_account_types(allowed_types: list[str]):
    """
    Dependency factory enforcing role-based access control based on the
    authenticated user's stored account_type profile.
    """
    async def _role_checker(
        current_user: Dict[str, Any] = Depends(get_current_user),
    ) -> Dict[str, Any]:
        account_type = current_user.get("account_type", "individual")
        if account_type not in allowed_types:
            allowed_str = " or ".join(t.capitalize() for t in allowed_types)
            raise ForbiddenException(
                f"Access forbidden: this feature is restricted to {allowed_str} accounts. "
                f"Your account type is '{account_type}'."
            )
        return current_user

    return _role_checker


# Dedicated dependency for organizational transportation and bus route management
require_transportation_access = require_account_types(["college", "organization"])

