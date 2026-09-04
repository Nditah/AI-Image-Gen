from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from prisma.models import User

from .analytics import build_admin_analytics
from .auth import serialize_user
from .database import database
from .deps import require_admin, require_staff, raise_api_error
from .schemas import AdminModerationRequest, AdminReportUpdateRequest, AdminUserUpdateRequest
from .security import enum_value
from .serializers import serialize_moderation, serialize_prompt_log, serialize_report, serialize_public_user

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def admin_stats(_staff: User = Depends(require_staff)) -> dict:
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    users = await database.client.user.count()
    generations = await database.client.promptlog.count()
    blocked = await database.client.promptlog.count(where={"safetyStatus": "BLOCKED"})
    open_reports = await database.client.contentreport.count(where={"status": "OPEN"})
    recent_generations = await database.client.promptlog.count(where={"createdAt": {"gte": day_ago}})
    suspended = await database.client.user.count(where={"status": "SUSPENDED"})
    banned = await database.client.user.count(where={"status": "BANNED"})
    feedback_total = await database.client.generationfeedback.count()
    feedback_up = await database.client.generationfeedback.count(where={"verdict": "UP"})
    feedback_down = await database.client.generationfeedback.count(where={"verdict": "DOWN"})
    return {
        "users": users,
        "generations": generations,
        "blocked": blocked,
        "openReports": open_reports,
        "generationsLast24h": recent_generations,
        "suspended": suspended,
        "banned": banned,
        "feedbackTotal": feedback_total,
        "feedbackUp": feedback_up,
        "feedbackDown": feedback_down,
    }


@router.get("/analytics")
async def admin_analytics(
    _staff: User = Depends(require_staff),
    days: int | None = Query(default=30, ge=1, le=3650),
    date_from: str | None = Query(default=None, alias="from"),
    date_to: str | None = Query(default=None, alias="to"),
) -> dict:
    """Provider usage and satisfaction aggregates for charts (date-ranged)."""
    return await build_admin_analytics(days=days, date_from=date_from, date_to=date_to)


@router.get("/users")
async def list_users(
    _staff: User = Depends(require_staff),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    q: str | None = None,
) -> dict:
    skip = (page - 1) * limit
    where = {}
    if q:
        query = q.strip()
        where = {
            "OR": [
                {"email": {"contains": query}},
                {"displayName": {"contains": query}},
            ]
        }
    total = await database.client.user.count(where=where)
    items = await database.client.user.find_many(
        where=where,
        skip=skip,
        take=limit,
        order={"createdAt": "desc"},
    )
    return {
        "items": [serialize_user(item) for item in items],
        "page": page,
        "limit": limit,
        "total": total,
    }


@router.get("/users/{user_id}")
async def get_user(user_id: str, _staff: User = Depends(require_staff)) -> dict:
    user = await database.client.user.find_unique(where={"id": user_id})
    if user is None:
        raise_api_error(404, "User not found.", "NOT_FOUND")
    generation_count = await database.client.promptlog.count(where={"userId": user.id})
    actions = await database.client.moderationaction.find_many(
        where={"targetUserId": user.id},
        take=20,
        order={"createdAt": "desc"},
        include={"actor": True},
    )
    return {
        "user": serialize_user(user),
        "generationCount": generation_count,
        "moderation": [serialize_moderation(item) for item in actions],
    }


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    actor: User = Depends(require_admin),
) -> dict:
    user = await database.client.user.find_unique(where={"id": user_id})
    if user is None:
        raise_api_error(404, "User not found.", "NOT_FOUND")
    if user.id == actor.id and payload.role and payload.role != "ADMIN":
        raise_api_error(400, "You cannot remove your own admin role.", "INVALID_ACTION")

    data: dict = {}
    if payload.role is not None:
        data["role"] = payload.role
    if payload.status is not None:
        data["status"] = payload.status
        if payload.status == "ACTIVE":
            data["suspendedUntil"] = None
        if payload.status == "SUSPENDED":
            data["suspendedUntil"] = datetime.now(timezone.utc) + timedelta(days=7)
        if payload.status == "BANNED":
            data["suspendedUntil"] = None
    if not data:
        return {"user": serialize_user(user)}
    updated = await database.client.user.update(where={"id": user.id}, data=data)
    return {"user": serialize_user(updated)}


@router.get("/generations")
async def list_generations(
    _staff: User = Depends(require_staff),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    safety_status: str | None = None,
    q: str | None = None,
) -> dict:
    skip = (page - 1) * limit
    where: dict = {}
    if safety_status:
        where["safetyStatus"] = safety_status
    if q:
        where["promptText"] = {"contains": q.strip()}
    total = await database.client.promptlog.count(where=where)
    items = await database.client.promptlog.find_many(
        where=where,
        skip=skip,
        take=limit,
        order={"createdAt": "desc"},
        include={"user": True, "feedback": True},
    )
    return {
        "items": [serialize_prompt_log(item, include_image=False) for item in items],
        "page": page,
        "limit": limit,
        "total": total,
    }


@router.get("/generations/{generation_id}")
async def get_generation(generation_id: int, _staff: User = Depends(require_staff)) -> dict:
    item = await database.client.promptlog.find_unique(
        where={"id": generation_id},
        include={"user": True, "feedback": True},
    )
    if item is None:
        raise_api_error(404, "Generation not found.", "NOT_FOUND")
    return serialize_prompt_log(item, include_image=True)


@router.get("/reports")
async def list_reports(
    _staff: User = Depends(require_staff),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    status: str | None = None,
) -> dict:
    skip = (page - 1) * limit
    where = {"status": status} if status else {}
    total = await database.client.contentreport.count(where=where)
    items = await database.client.contentreport.find_many(
        where=where,
        skip=skip,
        take=limit,
        order={"createdAt": "desc"},
        include={"reporter": True, "promptLog": True},
    )
    return {
        "items": [serialize_report(item) for item in items],
        "page": page,
        "limit": limit,
        "total": total,
    }


@router.patch("/reports/{report_id}")
async def update_report(
    report_id: str,
    payload: AdminReportUpdateRequest,
    _staff: User = Depends(require_staff),
) -> dict:
    report = await database.client.contentreport.find_unique(where={"id": report_id})
    if report is None:
        raise_api_error(404, "Report not found.", "NOT_FOUND")
    updated = await database.client.contentreport.update(
        where={"id": report.id},
        data={"status": payload.status},
        include={"reporter": True, "promptLog": True},
    )
    return serialize_report(updated)


@router.post("/moderation")
async def create_moderation(payload: AdminModerationRequest, actor: User = Depends(require_staff)) -> dict:
    if payload.action in {"BAN", "REINSTATE"} and enum_value(actor.role) != "ADMIN":
        raise_api_error(403, "Only administrators can ban or reinstate accounts.", "FORBIDDEN")

    target = await database.client.user.find_unique(where={"id": payload.target_user_id})
    if target is None:
        raise_api_error(404, "User not found.", "NOT_FOUND")
    if target.id == actor.id:
        raise_api_error(400, "You cannot moderate your own account.", "INVALID_ACTION")

    user_data: dict = {}
    if payload.action == "SUSPEND":
        user_data = {
            "status": "SUSPENDED",
            "suspendedUntil": datetime.now(timezone.utc) + timedelta(days=7),
        }
    elif payload.action == "BAN":
        user_data = {"status": "BANNED", "suspendedUntil": None}
    elif payload.action == "REINSTATE":
        user_data = {"status": "ACTIVE", "suspendedUntil": None}

    if payload.action == "REMOVE_CONTENT":
        if payload.prompt_log_id is None:
            raise_api_error(400, "prompt_log_id is required to remove content.", "INVALID_ACTION")
        log = await database.client.promptlog.find_unique(where={"id": payload.prompt_log_id})
        if log is None:
            raise_api_error(404, "Generation not found.", "NOT_FOUND")
        await database.client.promptlog.update(
            where={"id": log.id},
            data={"imageBase64": "", "safetyStatus": "REMOVED", "safetyNotes": payload.reason},
        )

    if user_data:
        await database.client.user.update(where={"id": target.id}, data=user_data)

    action = await database.client.moderationaction.create(
        data={
            "targetUserId": target.id,
            "actorId": actor.id,
            "promptLogId": payload.prompt_log_id,
            "action": payload.action,
            "reason": payload.reason,
            "violationCategory": payload.violation_category,
        },
        include={"targetUser": True, "actor": True},
    )
    return serialize_moderation(action)


@router.get("/events")
async def list_auth_events(
    _staff: User = Depends(require_staff),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
) -> dict:
    skip = (page - 1) * limit
    total = await database.client.authevent.count()
    items = await database.client.authevent.find_many(
        skip=skip,
        take=limit,
        order={"createdAt": "desc"},
        include={"user": True},
    )
    return {
        "items": [
            {
                "id": item.id,
                "type": enum_value(item.type),
                "ipAddress": item.ipAddress,
                "userAgent": item.userAgent,
                "metadata": item.metadata,
                "createdAt": item.createdAt.isoformat() if item.createdAt else None,
                "user": serialize_public_user(item.user),
            }
            for item in items
        ],
        "page": page,
        "limit": limit,
        "total": total,
    }
