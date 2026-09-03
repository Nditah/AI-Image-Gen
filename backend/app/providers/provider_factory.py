import importlib
import re
from base64 import b64encode

import httpx

SUPPORTED_PROVIDERS = {"openai", "gemini", "stability", "huggingface", "replicate"}


class ProviderError(Exception):
    def __init__(self, message: str, provider: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.provider = provider
        self.status_code = status_code


class ProviderConfigError(ProviderError):
    def __init__(self, message: str, provider: str) -> None:
        super().__init__(message, provider, status_code=400)


class ProviderRuntimeError(ProviderError):
    def __init__(self, message: str, provider: str) -> None:
        super().__init__(message, provider, status_code=502)


def normalize_provider_name(provider: str) -> str:
    normalized = provider.strip().lower()
    if normalized not in SUPPORTED_PROVIDERS:
        raise ProviderConfigError(
            f"Unsupported IMAGE_PROVIDER '{provider}'. Supported providers: {', '.join(sorted(SUPPORTED_PROVIDERS))}",
            normalized or "unknown",
        )
    return normalized


def get_provider_module(provider: str):
    normalized = normalize_provider_name(provider)
    return importlib.import_module(f".{normalized}_provider", package=__package__)


async def fetch_url_as_base64(url: str, provider: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.get(url)
            response.raise_for_status()
            return b64encode(response.content).decode("utf-8")
    except httpx.HTTPError as exc:
        raise ProviderRuntimeError("Failed to download generated image", provider) from exc


def extract_base64_payload(data: str, provider: str) -> str:
    if data.startswith("data:"):
        match = re.match(r"^data:[^;]+;base64,(.+)$", data)
        if match:
            return match.group(1)
        raise ProviderRuntimeError("Provider returned invalid base64 data URL", provider)
    return data
