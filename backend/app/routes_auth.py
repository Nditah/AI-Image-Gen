from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from prisma.errors import PrismaError

from .auth import (
    account_is_blocked,
    create_session,
    record_auth_event,
    revoke_session,
    serialize_user,
)
from .database import database
from .deps import bearer_token, client_ip, get_current_user, raise_api_error
from .schemas import AuthResponse, LoginRequest, RegisterRequest
from .security import hash_password, hash_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_payload(token: str, user) -> dict:
    return {"token": token, "user": serialize_user(user)}


@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest, request: Request) -> dict:
    if not payload.is_adult:
        raise_api_error(400, "You must confirm you are 18 or older.", "AGE_GATE")

    ip = client_ip(request)
    user_agent = request.headers.get("user-agent")
    now = datetime.now(timezone.utc)
    password_hash = hash_password(payload.password)

    try:
        user = await database.client.user.create(
            data={
                "email": payload.email,
                "passwordHash": password_hash,
                "displayName": payload.display_name,
                "role": "USER",
                "status": "ACTIVE",
                "emailVerifiedAt": now,
                "isAdult": True,
                "ageAttestedAt": now,
            }
        )
        await database.client.authidentity.create(
            data={
                "userId": user.id,
                "provider": "local",
                "providerUserId": payload.email,
            }
        )
    except PrismaError as exc:
        if "unique" in str(exc).lower():
            raise_api_error(409, "An account with that email already exists.", "EMAIL_TAKEN")
        raise

    token = await create_session(user, ip, user_agent)
    await record_auth_event("REGISTER", user.id, ip, user_agent)
    await database.client.user.update(where={"id": user.id}, data={"lastLoginAt": now})
    return _auth_payload(token, user)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, request: Request):
    ip = client_ip(request)
    user_agent = request.headers.get("user-agent")
    user = await database.client.user.find_unique(where={"email": payload.email})

    if user is None or not user.passwordHash or not verify_password(payload.password, user.passwordHash):
        await record_auth_event(
            "LOGIN_FAILED",
            user.id if user else None,
            ip,
            user_agent,
            metadata=payload.email,
        )
        return JSONResponse(
            status_code=401,
            content={"error": "Invalid email or password.", "code": "INVALID_CREDENTIALS"},
        )

    blocked = account_is_blocked(user)
    if blocked:
        await record_auth_event("LOGIN_FAILED", user.id, ip, user_agent, metadata="restricted")
        return JSONResponse(status_code=403, content={"error": blocked, "code": "ACCOUNT_RESTRICTED"})

    token = await create_session(user, ip, user_agent)
    now = datetime.now(timezone.utc)
    await database.client.user.update(where={"id": user.id}, data={"lastLoginAt": now})
    await record_auth_event("LOGIN", user.id, ip, user_agent)
    refreshed = await database.client.user.find_unique(where={"id": user.id})
    return _auth_payload(token, refreshed or user)


@router.post("/logout")
async def logout(request: Request, token: str | None = Depends(bearer_token)) -> dict:
    if token:
        found = await database.client.authsession.find_first(where={"tokenHash": hash_token(token)})
        user_id = found.userId if found else None
        await revoke_session(token)
        await record_auth_event("LOGOUT", user_id, client_ip(request), request.headers.get("user-agent"))
    return {"ok": True}


@router.get("/me")
async def me(user=Depends(get_current_user)) -> dict:
    return {"user": serialize_user(user)}
