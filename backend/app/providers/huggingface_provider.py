from base64 import b64encode

import httpx

from .provider_factory import ProviderConfigError, ProviderRuntimeError
from ..utils import get_settings

PROVIDER_NAME = "huggingface"


async def generate_image(prompt: str) -> dict:
    settings = get_settings()
    if not settings.huggingface_api_key:
        raise ProviderConfigError("HUGGINGFACE_API_KEY is not configured", PROVIDER_NAME)

    headers = {
        "Authorization": f"******",
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"https://api-inference.huggingface.co/models/{settings.huggingface_image_model}",
                headers=headers,
                json={"inputs": prompt},
            )
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")
            if "application/json" in content_type:
                detail = response.json().get("error", "HuggingFace image generation failed")
                raise ProviderRuntimeError(str(detail), PROVIDER_NAME)

            image_base64 = b64encode(response.content).decode("utf-8")
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text if exc.response is not None else ""
        raise ProviderRuntimeError(f"HuggingFace request failed: {detail}", PROVIDER_NAME) from exc
    except httpx.HTTPError as exc:
        raise ProviderRuntimeError("HuggingFace request failed", PROVIDER_NAME) from exc

    return {"image_base64": image_base64, "provider": PROVIDER_NAME}
