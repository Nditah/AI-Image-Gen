from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request
from prisma.errors import PrismaError
from prisma.models import User

from .auth import serialize_user
from .consent import REQUIRED_POLICY_KINDS, latest_required_policies, missing_required_policies
from .database import database
from .deps import client_ip, get_current_user, raise_api_error
from .schemas import AcceptConsentRequest, CreateReportRequest, UpdateProfileRequest, UpsertGenerationFeedbackRequest
from .security import enum_value
from .serializers import serialize_feedback, serialize_policy, serialize_prompt_log, serialize_report

router = APIRouter(tags=["user"])


@router.get("/policies")
async def list_policies(latest_only: bool = Query(default=True)) -> dict:
    documents = await database.client.policydocument.find_many(order={"effectiveAt": "desc"})
    if not latest_only:
        return {"items": [serialize_policy(item) for item in documents]}

    by_kind: dict[str, object] = {}
    for document in documents:
        kind = enum_value(document.kind)
        if kind not in by_kind:
            by_kind[kind] = document
    ordered = [by_kind[kind] for kind in REQUIRED_POLICY_KINDS if kind in by_kind]
    ordered.extend(doc for kind, doc in by_kind.items() if kind not in REQUIRED_POLICY_KINDS)
    return {"items": [serialize_policy(item) for item in ordered]}


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
        include={"feedback": True},
    )
    return {
        "items": [serialize_prompt_log(item, include_image=True) for item in items],
        "page": page,
        "limit": limit,
        "total": total,
    }


@router.get("/me/generations/{generation_id}")
async def get_my_generation(generation_id: int, user: User = Depends(get_current_user)) -> dict:
    item = await database.client.promptlog.find_first(
        where={"id": generation_id, "userId": user.id},
        include={"feedback": True},
    )
    if item is None:
        raise_api_error(404, "Generation not found.", "NOT_FOUND")
    return serialize_prompt_log(item, include_image=True)


@router.put("/me/generations/{generation_id}/feedback")
async def upsert_generation_feedback(
    generation_id: int,
    payload: UpsertGenerationFeedbackRequest,
    user: User = Depends(get_current_user),
) -> dict:
    log = await database.client.promptlog.find_first(where={"id": generation_id, "userId": user.id})
    if log is None:
        raise_api_error(404, "Generation not found.", "NOT_FOUND")
    if enum_value(log.safetyStatus) == "REMOVED":
        raise_api_error(400, "This generation can no longer receive feedback.", "FEEDBACK_CLOSED")

    data = {
        "verdict": payload.verdict,
        "tags": payload.tags,
        "remark": payload.remark,
    }
    feedback = await database.client.generationfeedback.upsert(
        where={"promptLogId": generation_id},
        data={
            "create": {
                "promptLogId": generation_id,
                "userId": user.id,
                **data,
            },
            "update": data,
        },
    )
    return serialize_feedback(feedback)


@router.patch("/me")
async def update_me(payload: UpdateProfileRequest, user: User = Depends(get_current_user)) -> dict:
    data: dict = {}
    if payload.display_name is not None:
        data["displayName"] = " ".join(payload.display_name.split())
    if payload.is_adult is True:
        data["isAdult"] = True
        data["ageAttestedAt"] = datetime.now(timezone.utc)
    if not data:
        return {"user": serialize_user(user)}
    updated = await database.client.user.update(where={"id": user.id}, data=data)
    return {"user": serialize_user(updated)}


@router.get("/me/consents")
async def list_my_consents(user: User = Depends(get_current_user)) -> dict:
    required = await latest_required_policies()
    missing = await missing_required_policies(user.id)
    consents = await database.client.userconsent.find_many(
        where={"userId": user.id},
        include={"policyDocument": True},
        order={"acceptedAt": "desc"},
    )
    accepted_required_ids = {document.id for document in required} - {document.id for document in missing}
    return {
        "complete": len(required) == len(REQUIRED_POLICY_KINDS) and not missing,
        "required": [serialize_policy(item) for item in required],
        "missing": [serialize_policy(item) for item in missing],
        "acceptedRequiredIds": list(accepted_required_ids),
        "items": [
            {
                "id": item.id,
                "acceptedAt": item.acceptedAt.isoformat() if item.acceptedAt else None,
                "ipAddress": item.ipAddress,
                "policy": serialize_policy(item.policyDocument) if item.policyDocument else None,
            }
            for item in consents
        ],
    }


@router.post("/me/consents")
async def accept_consent(
    payload: AcceptConsentRequest,
    request: Request,
    user: User = Depends(get_current_user),
) -> dict:
    document = await database.client.policydocument.find_unique(where={"id": payload.policy_document_id})
    if document is None:
        raise_api_error(404, "Policy document not found.", "NOT_FOUND")
    ip = client_ip(request)
    try:
        consent = await database.client.userconsent.create(
            data={
                "userId": user.id,
                "policyDocumentId": document.id,
                "ipAddress": ip,
            },
            include={"policyDocument": True},
        )
    except PrismaError:
        existing = await database.client.userconsent.find_first(
            where={"userId": user.id, "policyDocumentId": document.id},
            include={"policyDocument": True},
        )
        consent = existing

    if enum_value(document.kind) == "AGE_GATE" and not user.isAdult:
        await database.client.user.update(
            where={"id": user.id},
            data={"isAdult": True, "ageAttestedAt": datetime.now(timezone.utc)},
        )

    return {
        "id": consent.id,
        "acceptedAt": consent.acceptedAt.isoformat() if consent.acceptedAt else None,
        "ipAddress": consent.ipAddress,
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
