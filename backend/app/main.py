import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.responses import JSONResponse

from .database import database
from .routes import router
from .routes_admin import router as admin_router
from .routes_auth import router as auth_router
from .routes_user import router as user_router
from .utils import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await database.connect()
    try:
        yield
    finally:
        await database.disconnect()


settings = get_settings()
app = FastAPI(title="Artificial Intelligence Image Generator API", lifespan=lifespan)

origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if settings.enable_https_redirect:
    app.add_middleware(HTTPSRedirectMiddleware)

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(admin_router)
app.include_router(router)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict):
        return JSONResponse(status_code=exc.status_code, content=detail)
    return JSONResponse(status_code=exc.status_code, content={"error": str(detail), "code": "HTTP_ERROR"})


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
