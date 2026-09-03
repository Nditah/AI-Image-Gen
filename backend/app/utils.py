import logging
import os
from functools import lru_cache

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()
logger = logging.getLogger(__name__)


class Settings(BaseModel):
    openai_api_key: str = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    openai_image_model: str = Field(default_factory=lambda: os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1"))
    cors_origins: str = Field(default_factory=lambda: os.getenv("CORS_ORIGINS", "http://localhost:5173"))
    enable_https_redirect: bool = Field(
        default_factory=lambda: os.getenv("ENABLE_HTTPS_REDIRECT", "false").lower() == "true"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def generate_image_url(prompt: str) -> str:
    settings = get_settings()
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY is not configured")

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.images.generate(model=settings.openai_image_model, prompt=prompt, size="1024x1024")

    image = response.data[0]
    if getattr(image, "url", None):
        return image.url
    if getattr(image, "b64_json", None):
        return f"data:image/png;base64,{image.b64_json}"

    logger.error("OpenAI response did not include url or base64 image data")
    raise RuntimeError("Image generation failed: no image returned")
