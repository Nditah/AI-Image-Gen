from asyncio import to_thread
import json

from .provider_factory import ProviderConfigError, ProviderRuntimeError
from ..utils import get_settings

PROVIDER_NAME = "bedrock"


def _parse_size(image_size: str) -> tuple[int, int]:
    try:
        width_str, height_str = image_size.lower().split("x", 1)
        width, height = int(width_str), int(height_str)
        if width < 256 or height < 256:
            raise ValueError
        return width, height
    except ValueError:
        return 1024, 1024


def _invoke_titan(prompt: str, settings) -> str:
    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError as exc:
        raise ProviderConfigError(
            "boto3 is required for AWS Bedrock. Install backend requirements.",
            PROVIDER_NAME,
        ) from exc

    width, height = _parse_size(settings.image_size)
    body = {
        "taskType": "TEXT_IMAGE",
        "textToImageParams": {"text": prompt[:512]},
        "imageGenerationConfig": {
            "numberOfImages": 1,
            "quality": "standard",
            "height": height,
            "width": width,
            "cfgScale": 8.0,
        },
    }

    client_kwargs: dict = {"region_name": settings.aws_region}
    if settings.aws_access_key_id and settings.aws_secret_access_key:
        client_kwargs["aws_access_key_id"] = settings.aws_access_key_id
        client_kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        if settings.aws_session_token:
            client_kwargs["aws_session_token"] = settings.aws_session_token

    client = boto3.client("bedrock-runtime", **client_kwargs)

    try:
        response = client.invoke_model(
            modelId=settings.bedrock_image_model,
            body=json.dumps(body),
            accept="application/json",
            contentType="application/json",
        )
        payload = json.loads(response["body"].read())
    except (BotoCoreError, ClientError) as exc:
        raise ProviderRuntimeError(f"AWS Bedrock request failed: {exc}", PROVIDER_NAME) from exc
    except Exception as exc:  # noqa: BLE001
        raise ProviderRuntimeError("AWS Bedrock image generation request failed", PROVIDER_NAME) from exc

    if payload.get("error"):
        raise ProviderRuntimeError(f"AWS Bedrock image generation error: {payload['error']}", PROVIDER_NAME)

    images = payload.get("images") or []
    if not images:
        raise ProviderRuntimeError("AWS Bedrock response did not include image data", PROVIDER_NAME)
    return images[0]


async def generate_image(prompt: str) -> dict:
    settings = get_settings()
    if not settings.bedrock_image_model:
        raise ProviderConfigError("BEDROCK_IMAGE_MODEL is not configured", PROVIDER_NAME)
    if not settings.aws_region:
        raise ProviderConfigError("AWS_REGION is not configured", PROVIDER_NAME)

    image_base64 = await to_thread(_invoke_titan, prompt, settings)
    return {"image_base64": image_base64, "provider": PROVIDER_NAME}
