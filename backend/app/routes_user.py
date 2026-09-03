from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from prisma.errors import PrismaError
from prisma.models import User

from .auth import serialize_user
from .database import database
from .deps import get_current_user, raise_api_error
from .schemas import AcceptConsentRequest, CreateReportRequest, UpdateProfileRequest
from .serializers import serialize_policy, serialize_prompt_log, serialize_report

router = APIRouter(tags=["user"])


@router.get("/policies")
async def list_policies() -> dict:
    documents = await database.client.policydocument.find_many(order={"effectiveAt": "desc"})
    return {"items": [serialize_policy(item) for item in documents]}


@router.get("/me/generations")
async def list_my_generations(
    user: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=8, ge=1, le=24),
) -> dict:
    skip = (page - 1) * limit
    where = {"userId": user.id}
    total = await database.client.promptlog.count(where=where)
    items = await database.client.promptlog.find_many(
        where=where,
        skip=skip,
        take=limit,
        order={"createdAt": "desc"},
    )
    return {
        "items": [serialize_prompt_log(item, include_image=True) for item in items],
        "page": page,
        "limit": limit,
        "total": total,
    }


@router.get("/me/generations/{generation_id}")
async def get_my_generation(generation_id: int, user: User = Depends(get_current_user)) -> dict:
    item = await database.client.promptlog.find_first(where={"id": generation_id, "userId": user.id})
    if item is None:
        raise_api_error(404, "Generation not found.", "NOT_FOUND")
    return serialize_prompt_log(item, include_image=True)


@router.patch("/me")
async def update_me(payload: UpdateProfileRequest, user: User = Depends(get_current_user)) -> dict:
    data: dict = {}
    if payload.display_name is not None:
        data["displayName"] = " ".join(payload.display_name.split())
    if payload.is_adult is True:
        from datetime import datetime, timezone

        data["isAdult"] = True
        data["ageAttestedAt"] = datetime.now(timezone.utc)
    if not data:
        return {"user": serialize_user(user)}
    updated = await database.client.user.update(where={"id": user.id}, data=data)
    return {"user": serialize_user(updated)}


@router.get("/me/consents")
async def list_my_consents(user: User = Depends(get_current_user)) -> dict:
    consents = await database.client.userconsent.find_many(
        where={"userId": user.id},
        include={"policyDocument": True},
        order={"acceptedAt": "desc"},
    )
    return {
        "items": [
            {
                "id": item.id,
                "acceptedAt": item.acceptedAt.isoformat() if item.acceptedAt else None,
                "policy": serialize_policy(item.policyDocument) if item.policyDocument else None,
            }
            for item in consents
        ]
    }


@router.post("/me/consents")
async def accept_consent(payload: AcceptConsentRequest, user: User = Depends(get_current_user)) -> dict:
    document = await database.client.policydocument.find_unique(where={"id": payload.policy_document_id})
    if document is None:
        raise_api_error(404, "Policy document not found.", "NOT_FOUND")
    try:
        consent = await database.client.userconsent.create(
            data={
                "userId": user.id,
                "policyDocumentId": document.id,
            },
            include={"policyDocument": True},
        )
    except PrismaError:
        existing = await database.client.userconsent.find_first(
            where={"userId": user.id, "policyDocumentId": document.id},
            include={"policyDocument": True},
        )
        consent = existing
    return {
        "id": consent.id,
        "acceptedAt": consent.acceptedAt.isoformat() if consent.acceptedAt else None,
        "policy": serialize_policy(consent.policyDocument) if consent.policyDocument else None,
    }


@router.post("/me/reports")
async def create_report(payload: CreateReportRequest, user: User = Depends(get_current_user)) -> dict:
    log = await database.client.promptlog.find_unique(where={"id": payload.prompt_log_id})
    if log is None:
        raise_api_error(404, "Generation not found.", "NOT_FOUND")
    report = await database.client.contentreport.create(
        data={
            "promptLogId": payload.prompt_log_id,
            "reporterId": user.id,
            "violationCategory": payload.violation_category,
            "details": payload.details,
        },
        include={"reporter": True, "promptLog": True},
    )
    return serialize_report(report)
