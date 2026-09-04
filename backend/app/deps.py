from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from prisma.models import User

from .auth import account_can_generate, find_session_user
from .consent import (
    CONSENT_REQUIRED_CODE,
    CONSENT_REQUIRED_MESSAGE,
    latest_required_policies,
    missing_required_policies,
)
from .security import enum_value
from .serializers import serialize_policy

_bearer = HTTPBearer(auto_error=False)


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def raise_api_error(status_code: int, message: str, code: str) -> None:
    raise HTTPException(status_code=status_code, detail={"error": message, "code": code})


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> User:
    token = credentials.credentials if credentials else None
    if not token:
        raise_api_error(401, "Sign in to continue.", "UNAUTHORIZED")
    found = await find_session_user(token)
    if found is None:
        raise_api_error(401, "Your session has expired. Please sign in again.", "UNAUTHORIZED")
    _session, user = found
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> User | None:
    token = credentials.credentials if credentials else None
    if not token:
        return None
    found = await find_session_user(token)
    if found is None:
        return None
    return found[1]


async def require_active_user(user: User = Depends(get_current_user)) -> User:
    reason = account_can_generate(user)
    if reason:
        raise_api_error(403, reason, "ACCOUNT_RESTRICTED")
    return user


async def require_consenting_user(user: User = Depends(require_active_user)) -> User:
    """Active adult users must have accepted the latest required policy versions."""
    required = await latest_required_policies()
    if len(required) < 4:
        raise_api_error(
            503,
            "Required policy documents are not configured. Run the seed script.",
            "POLICIES_NOT_CONFIGURED",
        )
    missing = await missing_required_policies(user.id)
    if missing:
        raise HTTPException(
            status_code=403,
            detail={
                "error": CONSENT_REQUIRED_MESSAGE,
                "code": CONSENT_REQUIRED_CODE,
                "missing": [serialize_policy(item) for item in missing],
            },
        )
    return user


def _is_staff(user: User) -> bool:
    return enum_value(user.role) in {"ADMIN", "MODERATOR"}


async def require_staff(user: User = Depends(get_current_user)) -> User:
    if not _is_staff(user):
        raise_api_error(403, "Admin access required.", "FORBIDDEN")
    return user


async def require_admin(user: User = Depends(require_staff)) -> User:
    if enum_value(user.role) != "ADMIN":
        raise_api_error(403, "Only administrators can perform this action.", "FORBIDDEN")
    return user


def bearer_token(authorization: str | None = Header(default=None)) -> str | None:
    if not authorization:
        return None
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value:
        return None
    return value
