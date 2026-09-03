from pydantic import BaseModel, Field, HttpUrl


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=1000, description="Text prompt for AI image generation")


class GenerateImageResponse(BaseModel):
    image_url: HttpUrl | str
