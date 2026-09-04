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

    gemini_api_key: str = Field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    gemini_image_model: str = Field(
        default_factory=lambda: os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.0-flash-preview-image-generation")
    )

    stability_api_key: str = Field(default_factory=lambda: os.getenv("STABILITY_API_KEY", ""))

    huggingface_api_key: str = Field(default_factory=lambda: os.getenv("HUGGINGFACE_API_KEY", ""))
    huggingface_image_model: str = Field(
        default_factory=lambda: os.getenv("HUGGINGFACE_IMAGE_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")
    )

    replicate_api_key: str = Field(default_factory=lambda: os.getenv("REPLICATE_API_KEY", ""))
    replicate_image_model: str = Field(
        default_factory=lambda: os.getenv("REPLICATE_IMAGE_MODEL", "black-forest-labs/flux-schnell")
    )

    aws_region: str = Field(default_factory=lambda: os.getenv("AWS_REGION", "us-east-1"))
    aws_access_key_id: str = Field(default_factory=lambda: os.getenv("AWS_ACCESS_KEY_ID", ""))
    aws_secret_access_key: str = Field(default_factory=lambda: os.getenv("AWS_SECRET_ACCESS_KEY", ""))
    aws_session_token: str = Field(default_factory=lambda: os.getenv("AWS_SESSION_TOKEN", ""))
    bedrock_image_model: str = Field(
        default_factory=lambda: os.getenv("BEDROCK_IMAGE_MODEL", "amazon.titan-image-generator-v2:0")
    )

    azure_openai_api_key: str = Field(default_factory=lambda: os.getenv("AZURE_OPENAI_API_KEY", ""))
    azure_openai_endpoint: str = Field(default_factory=lambda: os.getenv("AZURE_OPENAI_ENDPOINT", ""))
    azure_openai_api_version: str = Field(
        default_factory=lambda: os.getenv("AZURE_OPENAI_API_VERSION", "2025-04-01-preview")
    )
    azure_openai_deployment: str = Field(
        default_factory=lambda: os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-image-1")
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
        "gemini": cfg.gemini_image_model,
        "huggingface": cfg.huggingface_image_model,
        "replicate": cfg.replicate_image_model,
        "bedrock": cfg.bedrock_image_model,
        "azure": cfg.azure_openai_deployment,
        "stability": "stable-image-core",
    }
    value = mapping.get(key)
    return value or None
