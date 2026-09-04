from datetime import datetime

from prisma.models import PromptLog

from .database import database


async def create_prompt_log(
    session_id: str,
    prompt_text: str,
    image_base64: str,
    provider: str,
    user_id: str | None = None,
    attested_ethical_use: bool = False,
    attested_no_real_person_misuse: bool = False,
    retention_expires_at: datetime | None = None,
    safety_status: str = "ALLOWED",
    blocked_reason: str | None = None,
    violation_category: str | None = None,
    duration_ms: int | None = None,
    model_name: str | None = None,
    image_size: str | None = None,
) -> PromptLog:
    return await database.client.promptlog.create(
        data={
            "sessionId": session_id,
            "promptText": prompt_text,
            "imageBase64": image_base64,
            "provider": provider,
            "userId": user_id,
            "attestedEthicalUse": attested_ethical_use,
            "attestedNoRealPersonMisuse": attested_no_real_person_misuse,
            "retentionExpiresAt": retention_expires_at,
            "safetyStatus": safety_status,
            "blockedReason": blocked_reason,
            "violationCategory": violation_category,
            "durationMs": duration_ms,
            "modelName": model_name,
            "imageSize": image_size,
        }
    )
