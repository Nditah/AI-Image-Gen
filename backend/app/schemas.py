from typing import Literal

from pydantic import BaseModel, Field


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=1000, description="Text prompt for AI image generation")
    provider: Literal["openai", "gemini", "stability", "huggingface", "replicate"] | None = Field(
        default=None,
        description="Optional provider override. Defaults to IMAGE_PROVIDER env var.",
    )


class GenerateImageResponse(BaseModel):
    image_base64: str
    provider: str
