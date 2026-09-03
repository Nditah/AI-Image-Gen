import logging
from asyncio import to_thread
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException

from .models import create_prompt_log
from .schemas import GenerateImageRequest, GenerateImageResponse
from .utils import generate_image_url

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/generate", response_model=GenerateImageResponse)
async def generate_image(payload: GenerateImageRequest, x_session_id: str | None = Header(default=None)) -> GenerateImageResponse:
    session_id = x_session_id or str(uuid4())

    try:
        image_url = await to_thread(generate_image_url, payload.prompt)
        await create_prompt_log(session_id=session_id, prompt_text=payload.prompt, image_url=image_url)

        logger.info(
            "Image generated",
            extra={
                "session_id": session_id,
                "prompt": payload.prompt,
                "image_url": image_url,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        return GenerateImageResponse(image_url=image_url)
    except ValueError as exc:
        logger.warning("Configuration error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled image generation error")
        raise HTTPException(status_code=502, detail="Unable to generate image right now.") from exc
