import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from prisma import Prisma

logger = logging.getLogger(__name__)

# Load backend/.env before Prisma reads DATABASE_URL.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


class Database:
    """Centralized Prisma connection manager."""

    def __init__(self) -> None:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise RuntimeError(
                "DATABASE_URL is not set. Copy backend/.env.example to backend/.env and configure Postgres."
            )
        self.client = Prisma(datasource={"url": database_url})

    async def connect(self) -> None:
        if not self.client.is_connected():
            await self.client.connect()
            logger.info("Database connection established")

    async def disconnect(self) -> None:
        if self.client.is_connected():
            await self.client.disconnect()
            logger.info("Database connection closed")


database = Database()
