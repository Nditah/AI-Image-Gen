import httpx

from .provider_factory import ProviderConfigError, ProviderRuntimeError, fetch_url_as_base64
from ..utils import get_settings

PROVIDER_NAME = "replicate"


async def generate_image(prompt: str) -> dict:
    settings = get_settings()
    if not settings.replicate_api_key:
        raise ProviderConfigError("REPLICATE_API_KEY is not configured", PROVIDER_NAME)

    headers = {
        "Authorization": f"Token {settings.replicate_api_key}",
        "Content-Type": "application/json",
        "Prefer": "wait=120",
    }

    payload = {
        "input": {
            "prompt": prompt,
        }
    }

    try:
        async with httpx.AsyncClient(timeout=150) as client:
            response = await client.post(
                f"https://api.replicate.com/v1/models/{settings.replicate_image_model}/predictions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text if exc.response is not None else ""
        raise ProviderRuntimeError(f"Replicate request failed: {detail}", PROVIDER_NAME) from exc
    except httpx.HTTPError as exc:
        raise ProviderRuntimeError("Replicate request failed", PROVIDER_NAME) from exc

    output = data.get("output")

    if isinstance(output, str):
        image_base64 = await fetch_url_as_base64(output, PROVIDER_NAME)
        return {"image_base64": image_base64, "provider": PROVIDER_NAME}

    if isinstance(output, list) and output:
        first_output = output[0]
        if isinstance(first_output, str) and first_output.startswith("http"):
            image_base64 = await fetch_url_as_base64(first_output, PROVIDER_NAME)
            return {"image_base64": image_base64, "provider": PROVIDER_NAME}
        if isinstance(first_output, str):
            return {"image_base64": first_output, "provider": PROVIDER_NAME}

    if data.get("status") == "failed":
        error_message = data.get("error") or "Replicate image generation failed"
        raise ProviderRuntimeError(error_message, PROVIDER_NAME)

    raise ProviderRuntimeError("Replicate response did not include image data", PROVIDER_NAME)
