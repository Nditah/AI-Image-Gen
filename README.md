# AI-Image-Gen

A full-stack **Multi-Provider AI Image Generator** built with FastAPI, Prisma/PostgreSQL, and Vite (Vanilla JS).

## Overview

The backend uses a provider factory (`backend/app/providers/provider_factory.py`) to load an image provider at runtime. The selected provider generates an image, returns base64, and the API logs `sessionId + promptText + imageBase64 + provider` to PostgreSQL via Prisma.

## Supported Providers

- OpenAI (`gpt-image-1`)
- Gemini (`gemini-2.0-flash-preview-image-generation` by default)
- Stability AI (Stable Image Core API)
- HuggingFace Inference API
- Replicate

## Project Structure

- `/home/runner/work/AI-Image-Gen/AI-Image-Gen/backend` — FastAPI API + Prisma schema
- `/home/runner/work/AI-Image-Gen/AI-Image-Gen/frontend` — Vite frontend app
- `/home/runner/work/AI-Image-Gen/AI-Image-Gen/docker-compose.yml` — local orchestration for DB + backend + frontend

## Environment Setup

Copy `/home/runner/work/AI-Image-Gen/AI-Image-Gen/backend/.env.example` to `backend/.env` and configure:

```env
DATABASE_URL=
IMAGE_PROVIDER=openai
OPENAI_API_KEY=
GEMINI_API_KEY=
STABILITY_API_KEY=
HUGGINGFACE_API_KEY=
REPLICATE_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-1
GEMINI_IMAGE_MODEL=gemini-2.0-flash-preview-image-generation
HUGGINGFACE_IMAGE_MODEL=stabilityai/stable-diffusion-xl-base-1.0
REPLICATE_IMAGE_MODEL=black-forest-labs/flux-schnell
IMAGE_SIZE=1024x1024
CORS_ORIGINS=http://localhost:5173
ENABLE_HTTPS_REDIRECT=false
```

## Provider Selection

Set `IMAGE_PROVIDER` to one of:

```env
IMAGE_PROVIDER=openai|gemini|stability|huggingface|replicate
```

The frontend also sends a provider value per request, which overrides the backend default for that request.

## Run Instructions

### Backend

```bash
pip install -r backend/requirements.txt
cd backend
prisma generate --schema=prisma/schema.prisma
prisma db push --schema=prisma/schema.prisma
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:8000`.

## API: `POST /generate`

### Request

```json
{
  "prompt": "A cinematic view of mountains at dawn",
  "provider": "openai"
}
```

- `prompt` is required (3-1000 chars)
- `provider` is optional (`openai|gemini|stability|huggingface|replicate`)

### Success Response

```json
{
  "image_base64": "iVBORw0KGgo...",
  "provider": "openai"
}
```

### Error Response

```json
{
  "error": "HUGGINGFACE_API_KEY is not configured",
  "provider": "huggingface"
}
```

- 4xx: validation/configuration errors
- 5xx: provider runtime/internal failures

## Provider-Specific Notes

- **OpenAI**: uses `OPENAI_API_KEY` and `OPENAI_IMAGE_MODEL`.
- **Gemini**: uses `GEMINI_API_KEY` and `GEMINI_IMAGE_MODEL`.
- **Stability AI**: uses `STABILITY_API_KEY` with the Stable Image Core endpoint.
- **HuggingFace**: uses `HUGGINGFACE_API_KEY` and `HUGGINGFACE_IMAGE_MODEL`.
- **Replicate**: uses `REPLICATE_API_KEY` and `REPLICATE_IMAGE_MODEL` (`owner/model` format).

Never commit real API keys; keep them only in local `.env` files or secret managers.

## Docker

```bash
docker compose up --build
```
