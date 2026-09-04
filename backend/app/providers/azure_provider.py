from asyncio import to_thread

from openai import AzureOpenAI

from .provider_factory import ProviderConfigError, ProviderRuntimeError, extract_base64_payload, fetch_url_as_base64
from ..utils import get_settings

PROVIDER_NAME = "azure"


async def generate_image(prompt: str) -> dict:
    settings = get_settings()
    if not settings.azure_openai_api_key:
        raise ProviderConfigError("AZURE_OPENAI_API_KEY is not configured", PROVIDER_NAME)
    if not settings.azure_openai_endpoint:
        raise ProviderConfigError("AZURE_OPENAI_ENDPOINT is not configured", PROVIDER_NAME)
    if not settings.azure_openai_deployment:
        raise ProviderConfigError("AZURE_OPENAI_DEPLOYMENT is not configured", PROVIDER_NAME)

    client = AzureOpenAI(
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
        azure_endpoint=settings.azure_openai_endpoint,
    )

    try:
        response = await to_thread(
            client.images.generate,
            model=settings.azure_openai_deployment,
            prompt=prompt,
            size=settings.image_size,
            n=1,
        )
        image = response.data[0]
    except Exception as exc:  # noqa: BLE001
        raise ProviderRuntimeError("Azure OpenAI image generation request failed", PROVIDER_NAME) from exc

    if getattr(image, "b64_json", None):
        return {
            "image_base64": extract_base64_payload(image.b64_json, PROVIDER_NAME),
            "provider": PROVIDER_NAME,
        }

    if getattr(image, "url", None):
        image_base64 = await fetch_url_as_base64(image.url, PROVIDER_NAME)
        return {"image_base64": image_base64, "provider": PROVIDER_NAME}

    raise ProviderRuntimeError("Azure OpenAI response did not include image data", PROVIDER_NAME)
