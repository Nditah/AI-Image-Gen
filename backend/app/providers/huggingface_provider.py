from base64 import b64encode

import httpx

from .provider_factory import ProviderConfigError, ProviderRuntimeError, fetch_url_as_base64
from ..utils import get_settings

PROVIDER_NAME = "huggingface"
ROUTER_BASE = "https://router.huggingface.co"
HUB_MODEL_API = "https://huggingface.co/api/models"
# Prefer fal-ai for text-to-image; hf-inference no longer hosts FLUX / SDXL.
DEFAULT_PROVIDER_PREF = ("fal-ai", "nscale", "together", "wavespeed", "hf-inference")


async def _live_provider_routes(model_id: str, token: str) -> list[tuple[str, str]]:
    """Return [(provider, providerId), ...] for live Inference Providers routes."""
    url = f"{HUB_MODEL_API}/{model_id}"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            url,
            params={"expand": "inferenceProviderMapping"},
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()
        mapping = response.json().get("inferenceProviderMapping") or {}

    routes: list[tuple[str, str]] = []
    for provider, info in mapping.items():
        if not isinstance(info, dict):
            continue
        if info.get("status") != "live":
            continue
        provider_id = info.get("providerId")
        if not provider_id:
            continue
        routes.append((str(provider), str(provider_id)))
    return routes


def _pick_route(
    routes: list[tuple[str, str]],
    preferred: str,
) -> tuple[str, str]:
    if not routes:
        raise ProviderRuntimeError(
            "No live Inference Providers route for this model. "
            "Pick a text-to-image model with provider support, or enable fal-ai in "
            "https://huggingface.co/settings/inference-providers",
            PROVIDER_NAME,
        )

    by_name = {name: provider_id for name, provider_id in routes}
    preferred = (preferred or "auto").strip().lower()
    if preferred and preferred != "auto":
        if preferred not in by_name:
            available = ", ".join(sorted(by_name))
            raise ProviderRuntimeError(
                f"Provider '{preferred}' is not live for this model. Available: {available}",
                PROVIDER_NAME,
            )
        return preferred, by_name[preferred]

    for name in DEFAULT_PROVIDER_PREF:
        if name in by_name:
            return name, by_name[name]
    return routes[0]


def _extract_image_url(data: object) -> str | None:
    if isinstance(data, str) and data.startswith("http"):
        return data
    if isinstance(data, list) and data:
        return _extract_image_url(data[0])
    if not isinstance(data, dict):
        return None
    for key in ("url", "image", "output"):
        value = data.get(key)
        found = _extract_image_url(value)
        if found:
            return found
    images = data.get("images")
    if isinstance(images, list) and images:
        return _extract_image_url(images[0])
    return None


async def generate_image(prompt: str) -> dict:
    settings = get_settings()
    if not settings.huggingface_api_key:
        raise ProviderConfigError("HUGGINGFACE_API_KEY is not configured", PROVIDER_NAME)

    token = settings.huggingface_api_key
    model_id = settings.huggingface_image_model
    preferred = getattr(settings, "huggingface_inference_provider", None) or "auto"

    try:
        routes = await _live_provider_routes(model_id, token)
        provider, provider_id = _pick_route(routes, preferred)
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text if exc.response is not None else ""
        raise ProviderRuntimeError(
            f"HuggingFace model lookup failed: {detail}",
            PROVIDER_NAME,
        ) from exc
    except httpx.HTTPError as exc:
        raise ProviderRuntimeError(f"HuggingFace model lookup failed: {exc}", PROVIDER_NAME) from exc

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    # Partner APIs (e.g. fal-ai) expect `prompt`; hf-inference historically used `inputs`.
    payload = {"prompt": prompt} if provider != "hf-inference" else {"inputs": prompt}
    width_s, _, height_s = (settings.image_size or "1024x1024").partition("x")
    try:
        width, height = int(width_s), int(height_s)
        if provider == "hf-inference":
            payload["parameters"] = {"width": width, "height": height}
        else:
            payload["image_size"] = {"width": width, "height": height}
    except ValueError:
        pass

    url = f"{ROUTER_BASE}/{provider}/{provider_id}"

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, headers=headers, json=payload)
            # Some partners reject image_size; retry with prompt only.
            if response.status_code >= 400 and "image_size" in payload:
                retry_payload = {"prompt": prompt} if provider != "hf-inference" else {"inputs": prompt}
                response = await client.post(url, headers=headers, json=retry_payload)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")
            if content_type.startswith("image/") or response.content[:8] == b"\x89PNG\r\n\x1a\n":
                image_base64 = b64encode(response.content).decode("utf-8")
                return {"image_base64": image_base64, "provider": PROVIDER_NAME}

            data = response.json()
            if isinstance(data, dict) and data.get("error"):
                raise ProviderRuntimeError(str(data["error"]), PROVIDER_NAME)

            image_url = _extract_image_url(data)
            if not image_url:
                raise ProviderRuntimeError(
                    f"HuggingFace ({provider}) response did not include image data",
                    PROVIDER_NAME,
                )
            image_base64 = await fetch_url_as_base64(image_url, PROVIDER_NAME)
            return {"image_base64": image_base64, "provider": PROVIDER_NAME}
    except ProviderRuntimeError:
        raise
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text if exc.response is not None else ""
        raise ProviderRuntimeError(f"HuggingFace request failed: {detail}", PROVIDER_NAME) from exc
    except httpx.HTTPError as exc:
        raise ProviderRuntimeError(f"HuggingFace request failed: {exc}", PROVIDER_NAME) from exc
