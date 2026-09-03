from prisma.models import PromptLog

from .database import database


async def create_prompt_log(session_id: str, prompt_text: str, image_url: str) -> PromptLog:
    return await database.client.promptlog.create(
        data={
            "sessionId": session_id,
            "promptText": prompt_text,
            "imageUrl": image_url,
        }
    )
