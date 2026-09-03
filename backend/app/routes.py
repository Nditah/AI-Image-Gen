import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header
from fastapi.responses import JSONResponse
from prisma.models import User

from .deps import require_active_user
from .models import create_prompt_log
from .providers.provider_factory import ProviderConfigError, ProviderRuntimeError, get_provider_module
from .safety import BLOCKED_PROMPT_MESSAGE, PromptBlockedError, ensure_prompt_allowed
from .schemas import GenerateImageRequest, GenerateImageResponse
from .utils import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)


def _safe_error_message(message: str, fallback: str) -> str:
    lowered = message.lower()
    if "traceback" in lowered or "\n" in message:
        return fallback
    return message[:300] if message else fallback


async def _persist_blocked_prompt(
    session_id: str,
    prompt: str,
    provider: str,
    error: PromptBlockedError,
    user_id: str | None,
) -> None:
    try:
        await create_prompt_log(
            session_id=session_id,
            prompt_text=prompt,
            image_base64="",
            provider=provider,
            user_id=user_id,
            safety_status="BLOCKED",
            blocked_reason=error.violation.reason,
            violation_category=error.violation.category,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to persist blocked prompt log")


@router.post("/generate", response_model=GenerateImageResponse)
async def generate_image(
    payload: GenerateImageRequest,
    user: User = Depends(require_active_user),
    x_session_id: str | None = Header(default=None),
):
    session_id = x_session_id or str(uuid4())
    settings = get_settings()
    requested_provider = payload.provider or settings.image_provider

    if not payload.attested_ethical_use or not payload.attested_no_real_person_misuse:
        return JSONResponse(
            status_code=400,
            content={
                "error": "Confirm the ethical-use attestations before generating.",
                "provider": requested_provider,
                "code": "ATTESTATION_REQUIRED",
            },
        )

    try:
        ensure_prompt_allowed(payload.prompt)
    except PromptBlockedError as exc:
        logger.warning(
            "Prompt blocked by safety filter",
            extra={
                "session_id": session_id,
                "user_id": user.id,
                "provider": requested_provider,
                "category": exc.violation.category,
                "reason": exc.violation.reason,
            },
        )
        await _persist_blocked_prompt(session_id, payload.prompt, requested_provider, exc, user.id)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": BLOCKED_PROMPT_MESSAGE,
                "provider": requested_provider,
                "code": exc.code,
            },
        )

    try:
        provider_module = get_provider_module(requested_provider)
        result = await provider_module.generate_image(payload.prompt)

        image_base64 = result.get("image_base64")
        provider = result.get("provider") or requested_provider
        if not image_base64:
            raise ProviderRuntimeError("Provider returned no image data", provider)

        retention = datetime.now(timezone.utc) + timedelta(days=30)
        log = await create_prompt_log(
            session_id=session_id,
            prompt_text=payload.prompt,
            image_base64=image_base64,
            provider=provider,
            user_id=user.id,
            attested_ethical_use=True,
            attested_no_real_person_misuse=True,
            retention_expires_at=retention,
            safety_status="ALLOWED",
        )

        logger.info(
            "Image generated",
            extra={
                "session_id": session_id,
                "user_id": user.id,
                "provider": provider,
                "prompt": payload.prompt,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        return GenerateImageResponse(image_base64=image_base64, provider=provider, generation_id=log.id)
    except ProviderConfigError as exc:
        logger.warning("Provider configuration error: %s", exc)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": _safe_error_message(str(exc), "Provider configuration error"), "provider": exc.provider},
        )
    except ProviderRuntimeError as exc:
        logger.exception("Provider runtime error")
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": _safe_error_message(str(exc), "Provider request failed"), "provider": exc.provider},
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled image generation error")
        return JSONResponse(
            status_code=500,
            content={"error": "Unable to generate image right now.", "provider": requested_provider},
        )
