import logging

from prisma import Prisma

logger = logging.getLogger(__name__)


class Database:
    """Centralized Prisma connection manager."""

    def __init__(self) -> None:
        self.client = Prisma()

    async def connect(self) -> None:
        if not self.client.is_connected():
            await self.client.connect()
            logger.info("Database connection established")

    async def disconnect(self) -> None:
        if self.client.is_connected():
            await self.client.disconnect()
            logger.info("Database connection closed")


database = Database()
