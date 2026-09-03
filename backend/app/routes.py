import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

from .models import create_prompt_log
from .providers.provider_factory import ProviderConfigError, ProviderRuntimeError, get_provider_module
from .schemas import GenerateImageRequest, GenerateImageResponse
from .utils import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/generate", response_model=GenerateImageResponse)
async def generate_image(payload: GenerateImageRequest, x_session_id: str | None = Header(default=None)) -> GenerateImageResponse:
    session_id = x_session_id or str(uuid4())
    settings = get_settings()
    requested_provider = payload.provider or settings.image_provider

    try:
        provider_module = get_provider_module(requested_provider)
        result = await provider_module.generate_image(payload.prompt)

        image_base64 = result.get("image_base64")
        provider = result.get("provider") or requested_provider
        if not image_base64:
            raise ProviderRuntimeError("Provider returned no image data", provider)

        await create_prompt_log(
            session_id=session_id,
            prompt_text=payload.prompt,
            image_base64=image_base64,
            provider=provider,
        )

        logger.info(
            "Image generated",
            extra={
                "session_id": session_id,
                "provider": provider,
                "prompt": payload.prompt,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        return GenerateImageResponse(image_base64=image_base64, provider=provider)
    except ProviderConfigError as exc:
        logger.warning("Provider configuration error: %s", exc)
        return JSONResponse(status_code=exc.status_code, content={"error": str(exc), "provider": exc.provider})
    except ProviderRuntimeError as exc:
        logger.exception("Provider runtime error")
        return JSONResponse(status_code=exc.status_code, content={"error": str(exc), "provider": exc.provider})
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled image generation error")
        return JSONResponse(
            status_code=500,
            content={"error": "Unable to generate image right now.", "provider": requested_provider},
        )
