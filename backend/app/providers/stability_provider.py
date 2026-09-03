from base64 import b64encode

import httpx

from .provider_factory import ProviderConfigError, ProviderRuntimeError
from ..utils import get_settings

PROVIDER_NAME = "stability"


async def generate_image(prompt: str) -> dict:
    settings = get_settings()
    if not settings.stability_api_key:
        raise ProviderConfigError("STABILITY_API_KEY is not configured", PROVIDER_NAME)

    headers = {
        "Authorization": f"******",
        "Accept": "image/*",
    }
    payload = {
        "prompt": prompt,
        "output_format": "png",
    }

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(
                "https://api.stability.ai/v2beta/stable-image/generate/core",
                headers=headers,
                files=payload,
            )
            response.raise_for_status()
            image_base64 = b64encode(response.content).decode("utf-8")
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text if exc.response is not None else ""
        raise ProviderRuntimeError(f"Stability AI request failed: {detail}", PROVIDER_NAME) from exc
    except httpx.HTTPError as exc:
        raise ProviderRuntimeError("Stability AI request failed", PROVIDER_NAME) from exc

    return {"image_base64": image_base64, "provider": PROVIDER_NAME}
