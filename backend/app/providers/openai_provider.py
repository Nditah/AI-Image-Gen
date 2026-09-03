from asyncio import to_thread

from openai import OpenAI

from ..utils import get_settings
from .provider_factory import ProviderConfigError, ProviderRuntimeError, extract_base64_payload, fetch_url_as_base64

PROVIDER_NAME = "openai"


async def generate_image(prompt: str) -> dict:
    settings = get_settings()
    if not settings.openai_api_key:
        raise ProviderConfigError("OPENAI_API_KEY is not configured", PROVIDER_NAME)

    client = OpenAI(api_key=settings.openai_api_key)

    try:
        response = await to_thread(
            client.images.generate,
            model=settings.openai_image_model,
            prompt=prompt,
            size=settings.image_size,
        )
        image = response.data[0]
    except Exception as exc:  # noqa: BLE001
        raise ProviderRuntimeError("OpenAI image generation request failed", PROVIDER_NAME) from exc

    if getattr(image, "b64_json", None):
        return {"image_base64": extract_base64_payload(image.b64_json, PROVIDER_NAME), "provider": PROVIDER_NAME}

    if getattr(image, "url", None):
        image_base64 = await fetch_url_as_base64(image.url, PROVIDER_NAME)
        return {"image_base64": image_base64, "provider": PROVIDER_NAME}

    raise ProviderRuntimeError("OpenAI response did not include image data", PROVIDER_NAME)
