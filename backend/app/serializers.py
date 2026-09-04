from __future__ import annotations

from datetime import datetime

from .security import enum_value


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def serialize_public_user(user) -> dict | None:
    if user is None:
        return None
    return {
        "id": user.id,
        "email": user.email,
        "displayName": user.displayName,
        "role": enum_value(user.role),
        "status": enum_value(getattr(user, "status", None)) or None,
    }


def serialize_feedback(feedback) -> dict | None:
    if feedback is None:
        return None
    tags = getattr(feedback, "tags", None) or []
    return {
        "id": feedback.id,
        "promptLogId": feedback.promptLogId,
        "userId": feedback.userId,
        "verdict": enum_value(feedback.verdict),
        "tags": list(tags),
        "remark": feedback.remark,
        "createdAt": iso(feedback.createdAt),
        "updatedAt": iso(feedback.updatedAt),
    }


def serialize_prompt_log(log, *, include_image: bool = False) -> dict:
    payload = {
        "id": log.id,
        "promptText": log.promptText,
        "provider": log.provider,
        "modelName": getattr(log, "modelName", None),
        "imageSize": getattr(log, "imageSize", None),
        "durationMs": getattr(log, "durationMs", None),
        "safetyStatus": enum_value(log.safetyStatus),
        "blockedReason": log.blockedReason,
        "violationCategory": enum_value(log.violationCategory) or None,
        "attestedEthicalUse": bool(log.attestedEthicalUse),
        "attestedNoRealPersonMisuse": bool(log.attestedNoRealPersonMisuse),
        "createdAt": iso(log.createdAt),
        "hasImage": bool(getattr(log, "imageBase64", "")),
        "user": serialize_public_user(getattr(log, "user", None)),
        "feedback": serialize_feedback(getattr(log, "feedback", None)),
    }
    if include_image:
        payload["image_base64"] = getattr(log, "imageBase64", "") or ""
    return payload


def serialize_report(report) -> dict:
    prompt_log = getattr(report, "promptLog", None)
    return {
        "id": report.id,
        "promptLogId": report.promptLogId,
        "reporterId": report.reporterId,
        "violationCategory": enum_value(report.violationCategory),
        "details": report.details,
        "status": enum_value(report.status),
        "createdAt": iso(report.createdAt),
        "reporter": serialize_public_user(getattr(report, "reporter", None)),
        "promptLog": serialize_prompt_log(prompt_log) if prompt_log is not None else None,
    }


def serialize_moderation(action) -> dict:
    return {
        "id": action.id,
        "targetUserId": action.targetUserId,
        "actorId": action.actorId,
        "promptLogId": action.promptLogId,
        "action": enum_value(action.action),
        "reason": action.reason,
        "violationCategory": enum_value(action.violationCategory) or None,
        "createdAt": iso(action.createdAt),
        "targetUser": serialize_public_user(getattr(action, "targetUser", None)),
        "actor": serialize_public_user(getattr(action, "actor", None)),
    }


def serialize_policy(document) -> dict:
    return {
        "id": document.id,
        "kind": enum_value(document.kind),
        "version": document.version,
        "effectiveAt": iso(document.effectiveAt),
        "summary": document.summary,
    }
