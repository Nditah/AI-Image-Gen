#!/usr/bin/env python3
"""Create or update default local accounts.

Run from the backend directory after `prisma generate` and migrations:

    python prisma/seed.py

Override passwords with env vars (optional):

    SEED_ADMIN_PASSWORD
    SEED_USER_PASSWORD
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from prisma import Prisma

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "Admin123!")
USER_PASSWORD = os.getenv("SEED_USER_PASSWORD", "User123!")

SEED_USERS = (
    {
        "email": "admin@ai-image-gen.local",
        "displayName": "Site Admin",
        "role": "ADMIN",
        "password": ADMIN_PASSWORD,
    },
    {
        "email": "ada@ai-image-gen.local",
        "displayName": "Ada Lovelace",
        "role": "USER",
        "password": USER_PASSWORD,
    },
    {
        "email": "linus@ai-image-gen.local",
        "displayName": "Linus Torvalds",
        "role": "USER",
        "password": USER_PASSWORD,
    },
    {
        "email": "grace@ai-image-gen.local",
        "displayName": "Grace Hopper",
        "role": "USER",
        "password": USER_PASSWORD,
    },
)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


async def upsert_user(db: Prisma, spec: dict[str, str]) -> None:
    now = datetime.now(timezone.utc)
    password_hash = hash_password(spec["password"])
    profile = {
        "displayName": spec["displayName"],
        "passwordHash": password_hash,
        "role": spec["role"],
        "status": "ACTIVE",
        "emailVerifiedAt": now,
        "isAdult": True,
        "ageAttestedAt": now,
        "suspendedUntil": None,
    }

    user = await db.user.upsert(
        where={"email": spec["email"]},
        data={
            "create": {
                "email": spec["email"],
                **profile,
            },
            "update": profile,
        },
    )
    await db.authidentity.upsert(
        where={
            "provider_providerUserId": {
                "provider": "local",
                "providerUserId": spec["email"],
            }
        },
        data={
            "create": {
                "userId": user.id,
                "provider": "local",
                "providerUserId": spec["email"],
            },
            "update": {"userId": user.id},
        },
    )
    print(f"  {spec['role']:<6} {spec['email']:<32} password={spec['password']}")


POLICIES = (
    {
        "kind": "AGE_GATE",
        "version": "1.0",
        "summary": "You must be 18 or older to use this service. Accounts for minors are not permitted.",
    },
    {
        "kind": "ACCEPTABLE_USE",
        "version": "1.0",
        "summary": "Do not request sexual content involving minors, non-consensual intimate imagery, deepfakes of real people without consent, hate, or violent extremism.",
    },
    {
        "kind": "PRIVACY",
        "version": "1.0",
        "summary": "Prompts and generated images are stored so you can review your gallery and so staff can moderate abuse. Images may be deleted after the retention window.",
    },
    {
        "kind": "TERMS_OF_SERVICE",
        "version": "1.0",
        "summary": "Staff may suspend or ban accounts that violate these rules. You are responsible for how you use generated images.",
    },
)


async def seed_policies(db: Prisma) -> None:
    now = datetime.now(timezone.utc)
    for spec in POLICIES:
        await db.policydocument.upsert(
            where={"kind_version": {"kind": spec["kind"], "version": spec["version"]}},
            data={
                "create": {
                    "kind": spec["kind"],
                    "version": spec["version"],
                    "effectiveAt": now,
                    "summary": spec["summary"],
                },
                "update": {"summary": spec["summary"]},
            },
        )
        print(f"  policy {spec['kind']:<22} v{spec['version']}")


async def main() -> int:
    if not os.getenv("DATABASE_URL"):
        print("DATABASE_URL is not set. Copy backend/.env.example to backend/.env first.", file=sys.stderr)
        return 1

    db = Prisma(
        datasource={
            "url": os.getenv("DATABASE_URL"),
        }
    )
    await db.connect()
    try:
        print("Seeding default users (create or update)...")
        for spec in SEED_USERS:
            await upsert_user(db, spec)
        print("Seeding policy documents...")
        await seed_policies(db)
        print("Done.")
        return 0
    finally:
        await db.disconnect()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
