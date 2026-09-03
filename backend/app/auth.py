from __future__ import annotations

from datetime import datetime, timedelta, timezone

from prisma.models import AuthSession, User

from .database import database
from .security import enum_value, hash_token, new_session_token
from .utils import get_settings


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "displayName": user.displayName,
        "role": enum_value(user.role),
        "status": enum_value(user.status),
        "isAdult": bool(user.isAdult),
        "emailVerifiedAt": user.emailVerifiedAt.isoformat() if user.emailVerifiedAt else None,
        "lastLoginAt": user.lastLoginAt.isoformat() if user.lastLoginAt else None,
        "createdAt": user.createdAt.isoformat() if user.createdAt else None,
        "suspendedUntil": user.suspendedUntil.isoformat() if user.suspendedUntil else None,
    }


def account_is_blocked(user: User) -> str | None:
    status = enum_value(user.status)
    now = datetime.now(timezone.utc)
    if status == "BANNED":
        return "This account has been banned."
    if status == "SUSPENDED":
        return "This account is suspended."
    if user.suspendedUntil and user.suspendedUntil > now:
        return "This account is temporarily suspended."
    if status == "PENDING_VERIFICATION":
        return "This account is pending verification."
    return None


def account_can_generate(user: User) -> str | None:
    blocked = account_is_blocked(user)
    if blocked:
        return blocked
    if not user.isAdult:
        return "You must confirm you are 18 or older before generating images."
    if enum_value(user.status) != "ACTIVE":
        return "This account cannot generate images."
    return None


async def create_session(user: User, ip_address: str | None, user_agent: str | None) -> str:
    settings = get_settings()
    token = new_session_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.auth_session_days)
    await database.client.authsession.create(
        data={
            "userId": user.id,
            "tokenHash": hash_token(token),
            "ipAddress": ip_address,
            "userAgent": (user_agent or "")[:500] or None,
            "expiresAt": expires_at,
        }
    )
    return token


async def find_session_user(token: str) -> tuple[AuthSession, User] | None:
    session = await database.client.authsession.find_first(
        where={
            "tokenHash": hash_token(token),
            "revokedAt": None,
            "expiresAt": {"gt": datetime.now(timezone.utc)},
        },
        include={"user": True},
    )
    if session is None or session.user is None:
        return None
    return session, session.user


async def revoke_session(token: str) -> None:
    await database.client.authsession.update_many(
        where={"tokenHash": hash_token(token), "revokedAt": None},
        data={"revokedAt": datetime.now(timezone.utc)},
    )


async def record_auth_event(
    event_type: str,
    user_id: str | None,
    ip_address: str | None,
    user_agent: str | None,
    metadata: str | None = None,
) -> None:
    await database.client.authevent.create(
        data={
            "userId": user_id,
            "type": event_type,
            "ipAddress": ip_address,
            "userAgent": (user_agent or "")[:500] or None,
            "metadata": metadata,
        }
    )
