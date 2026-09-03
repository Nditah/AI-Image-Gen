from prisma.models import PromptLog

from .database import database


async def create_prompt_log(session_id: str, prompt_text: str, image_base64: str, provider: str) -> PromptLog:
    return await database.client.promptlog.create(
        data={
            "sessionId": session_id,
            "promptText": prompt_text,
            "imageBase64": image_base64,
            "provider": provider,
        }
    )
