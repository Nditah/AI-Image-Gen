"""Password and session-token helpers (no database access)."""

from __future__ import annotations

import hashlib
import secrets

import bcrypt

BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    payload = password.encode("utf-8")[:BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(payload, bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    payload = password.encode("utf-8")[:BCRYPT_MAX_BYTES]
    try:
        return bcrypt.checkpw(payload, password_hash.encode("utf-8"))
    except ValueError:
        return False


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def enum_value(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(getattr(value, "name", value))
