import httpx

from .provider_factory import ProviderConfigError, ProviderRuntimeError
from ..utils import get_settings

PROVIDER_NAME = "gemini"


async def generate_image(prompt: str) -> dict:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise ProviderConfigError("GEMINI_API_KEY is not configured", PROVIDER_NAME)

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_image_model}:generateContent"
        f"?key={settings.gemini_api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(endpoint, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        error = exc.response.json().get("error", {}) if exc.response is not None else {}
        message = error.get("message", "Gemini image generation request failed")
        raise ProviderRuntimeError(message, PROVIDER_NAME) from exc
    except httpx.HTTPError as exc:
        raise ProviderRuntimeError("Gemini image generation request failed", PROVIDER_NAME) from exc

    candidates = data.get("candidates", [])
    for candidate in candidates:
        parts = candidate.get("content", {}).get("parts", [])
        for part in parts:
            inline_data = part.get("inlineData")
            if inline_data and inline_data.get("data"):
                return {"image_base64": inline_data["data"], "provider": PROVIDER_NAME}

    raise ProviderRuntimeError("Gemini response did not include image data", PROVIDER_NAME)
