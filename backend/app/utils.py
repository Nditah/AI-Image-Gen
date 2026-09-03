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

    cors_origins: str = Field(default_factory=lambda: os.getenv("CORS_ORIGINS", "http://localhost:5173"))
    enable_https_redirect: bool = Field(
        default_factory=lambda: os.getenv("ENABLE_HTTPS_REDIRECT", "false").lower() == "true"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
