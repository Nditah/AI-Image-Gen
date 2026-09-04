import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()


class Settings(BaseModel):
    image_provider: str = Field(default_factory=lambda: os.getenv("IMAGE_PROVIDER", "openai"))
    image_size: str = Field(default_factory=lambda: os.getenv("IMAGE_SIZE", "1024x1024"))

    openai_api_key: str = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    openai_image_model: str = Field(default_factory=lambda: os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1"))

    stability_api_key: str = Field(default_factory=lambda: os.getenv("STABILITY_API_KEY", ""))

    huggingface_api_key: str = Field(default_factory=lambda: os.getenv("HUGGINGFACE_API_KEY", ""))
    huggingface_image_model: str = Field(
        default_factory=lambda: os.getenv("HUGGINGFACE_IMAGE_MODEL", "black-forest-labs/FLUX.1-schnell")
    )
    # Inference Providers partner: auto | fal-ai | nscale | ...
    # (hf-inference no longer hosts popular text-to-image models like FLUX/SDXL)
    huggingface_inference_provider: str = Field(
        default_factory=lambda: os.getenv("HUGGINGFACE_INFERENCE_PROVIDER", "auto")
    )

    cors_origins: str = Field(default_factory=lambda: os.getenv("CORS_ORIGINS", "http://localhost:5173"))
    enable_https_redirect: bool = Field(
        default_factory=lambda: os.getenv("ENABLE_HTTPS_REDIRECT", "false").lower() == "true"
    )
    auth_session_days: int = Field(
        default_factory=lambda: int(os.getenv("AUTH_SESSION_DAYS", "7"))
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def resolve_model_name(provider: str, settings: Settings | None = None) -> str | None:
    """Best-effort model / deployment id for analytics (image APIs have no temperature)."""
    cfg = settings or get_settings()
    key = (provider or cfg.image_provider or "").lower()
    mapping = {
        "openai": cfg.openai_image_model,
        "huggingface": cfg.huggingface_image_model,
        "stability": "stable-image-core",
    }
    value = mapping.get(key)
    return value or None
