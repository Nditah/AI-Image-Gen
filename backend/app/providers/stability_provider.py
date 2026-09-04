from base64 import b64encode

import httpx

from .provider_factory import ProviderConfigError, ProviderRuntimeError
from ..utils import get_settings

PROVIDER_NAME = "stability"


async def generate_image(prompt: str) -> dict:
    """Call Stable Image Core (multipart/form-data), same shape as Stability's public notebook."""
    settings = get_settings()
    if not settings.stability_api_key:
        raise ProviderConfigError("STABILITY_API_KEY is not configured", PROVIDER_NAME)

    headers = {
        "Authorization": f"Bearer {settings.stability_api_key}",
        "Accept": "image/*",
    }
    # Official Stable Image API expects multipart fields as strings (not JSON).
    # Force multipart with an empty file part, matching Stability's requests example.
    data = {
        "prompt": prompt,
        "output_format": "png",
        "aspect_ratio": "1:1",
    }
    files = {"none": ("", b"")}

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(
                "https://api.stability.ai/v2beta/stable-image/generate/core",
                headers=headers,
                data=data,
                files=files,
            )
            response.raise_for_status()
            image_base64 = b64encode(response.content).decode("utf-8")
    except httpx.HTTPStatusError as exc:
        detail = (exc.response.text if exc.response is not None else "")[:400]
        status = exc.response.status_code if exc.response is not None else 502
        if status == 402:
            raise ProviderRuntimeError(
                "Stability AI credits are exhausted. Top up at platform.stability.ai.",
                PROVIDER_NAME,
                status_code=402,
            ) from exc
        if status == 401:
            raise ProviderRuntimeError(
                "Stability AI rejected the API key.",
                PROVIDER_NAME,
                status_code=401,
            ) from exc
        raise ProviderRuntimeError(
            f"Stability AI request failed: {detail or f'HTTP {status}'}",
            PROVIDER_NAME,
            status_code=400 if status == 400 else 502,
        ) from exc
    except httpx.HTTPError as exc:
        raise ProviderRuntimeError("Stability AI request failed", PROVIDER_NAME) from exc

    return {"image_base64": image_base64, "provider": PROVIDER_NAME}
