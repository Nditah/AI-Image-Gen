# AI Image Generator

A full-stack **multi-provider AI image generator** built with FastAPI, Prisma/PostgreSQL, and Vite (vanilla JS). The UI sends a prompt (and optional provider) to the API, which generates an image and stores `sessionId + promptText + imageBase64 + provider` in PostgreSQL.

[![GitHub stars](https://img.shields.io/github/stars/Nditah/AI-Image-Gen?style=flat&logo=github)](https://github.com/Nditah/AI-Image-Gen/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/Nditah/AI-Image-Gen?style=flat)](https://github.com/Nditah/AI-Image-Gen/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/Nditah/AI-Image-Gen?style=flat)](https://github.com/Nditah/AI-Image-Gen/commits/main)
[![GitHub top language](https://img.shields.io/github/languages/top/Nditah/AI-Image-Gen?style=flat)](https://github.com/Nditah/AI-Image-Gen)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.116-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-0.15-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT%20Image-412991?logo=openai&logoColor=white)](https://platform.openai.com/docs/guides/images)

## How it works

```mermaid
flowchart LR
  A[Browser<br/>localhost:5173] --> B[FastAPI<br/>localhost:8000]
  B --> C[Provider factory]
  C --> D[OpenAI / Gemini / Stability / HuggingFace / Replicate]
  B --> E[(PostgreSQL)]
```

1. You enter a prompt and pick a provider in the UI.
2. The frontend `POST`s `{ "prompt": "...", "provider": "openai" }` to `/generate`.
3. The backend loads that provider (or the `IMAGE_PROVIDER` default), generates a 1024×1024 image, and writes a `PromptLog` row with base64 image data.
4. The UI displays the returned image as a `data:image/png;base64,...` URL.

## Supported providers

| Provider | Default model / API | Env key |
| --- | --- | --- |
| OpenAI | `gpt-image-1` | `OPENAI_API_KEY` |
| Gemini | `gemini-2.0-flash-preview-image-generation` | `GEMINI_API_KEY` |
| Stability AI | Stable Image Core | `STABILITY_API_KEY` |
| HuggingFace | `stabilityai/stable-diffusion-xl-base-1.0` | `HUGGINGFACE_API_KEY` |
| Replicate | `black-forest-labs/flux-schnell` (`owner/model`) | `REPLICATE_API_KEY` |

Set `IMAGE_PROVIDER` to `openai`, `gemini`, `stability`, `huggingface`, or `replicate`. The frontend also sends a provider per request, which overrides the backend default for that call.

Never commit real API keys; keep them only in local `.env` files or secret managers.

## Project structure

```text
.
├── backend/                 FastAPI app + Prisma schema
│   ├── app/                 API, providers, DB helpers
│   │   └── providers/       OpenAI, Gemini, Stability, HuggingFace, Replicate
│   ├── prisma/schema.prisma PromptLog model
│   ├── requirements.txt
│   └── .env.example
├── frontend/                Vite + vanilla JS UI
├── Dockerfile.backend
├── Dockerfile.frontend
└── docker-compose.yml       Postgres + API + UI
```

## Prerequisites

You need an API key for at least one supported provider.

| Path | What you need |
| --- | --- |
| **Docker (recommended)** | [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2) |
| **Local (without Docker)** | Python **3.11+**, Node.js **20+**, PostgreSQL **16**, and `pip` |

## Run with Docker (recommended)

This starts PostgreSQL, the API on port **8000**, and the UI on port **5173**.

1. Clone the repo and enter it:

   ```bash
   git clone https://github.com/Nditah/AI-Image-Gen.git
   cd AI-Image-Gen
   ```

2. Create the backend env file (Compose reads `backend/.env`):

   ```bash
   cp backend/.env.example backend/.env
   ```

3. Put at least one provider key in `backend/.env`, and set `IMAGE_PROVIDER` to match:

   ```env
   IMAGE_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   ```

   Leave `DATABASE_URL` as-is in this file. Compose overrides it so the API talks to the `db` service.

4. Build and start everything:

   ```bash
   docker compose up --build
   ```

5. Open the app:

   | Service | URL |
   | --- | --- |
   | Frontend | http://localhost:5173 |
   | API | http://localhost:8000 |
   | Interactive docs | http://localhost:8000/docs |
   | Health check | http://localhost:8000/health |

Stop with `Ctrl+C`, or `docker compose down`. Add `-v` to also delete the Postgres volume.

## Run locally (without Docker)

Use this if you want hot reload and a local Postgres instance.

### 1. Start PostgreSQL

Create a database named `ai_image_gen` (user/password `postgres` match `.env.example`):

```bash
createdb ai_image_gen
```

Or run only the database container from this repo:

```bash
docker compose up db -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set at least:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_image_gen"
IMAGE_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
OPENAI_IMAGE_MODEL="gpt-image-1"
CORS_ORIGINS="http://localhost:5173"
ENABLE_HTTPS_REDIRECT="false"
```

Install Python deps, generate the Prisma client, and apply the schema:

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
prisma generate --schema prisma/schema.prisma
prisma db push --schema prisma/schema.prisma
```

Start the API (from the `backend/` directory):

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

From the repo root instead:

```bash
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

Confirm it is up: http://localhost:8000/health should return `{"status":"ok"}`.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The UI is at http://localhost:5173 and calls http://localhost:8000 by default.

To point the UI at a different API, create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `POST` | `/generate` | Generate an image from a prompt |

### `POST /generate`

Optional header: `X-Session-Id` (a UUID is created if omitted).

```bash
curl -s http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"A cinematic view of mountains at dawn","provider":"openai"}'
```

**Request**

```json
{
  "prompt": "A cinematic view of mountains at dawn",
  "provider": "openai"
}
```

- `prompt` is required (3–1000 characters)
- `provider` is optional (`openai` \| `gemini` \| `stability` \| `huggingface` \| `replicate`); defaults to `IMAGE_PROVIDER`

**Success response**

```json
{
  "image_base64": "iVBORw0KGgo...",
  "provider": "openai"
}
```

**Error response**

```json
{
  "error": "HUGGINGFACE_API_KEY is not configured",
  "provider": "huggingface"
}
```

- 4xx: validation or configuration errors
- 5xx: provider runtime or internal failures

Interactive OpenAPI docs: http://localhost:8000/docs

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `IMAGE_PROVIDER` | `backend/.env` | Default provider (`openai`, `gemini`, `stability`, `huggingface`, `replicate`) |
| `OPENAI_API_KEY` | `backend/.env` | OpenAI secret key |
| `OPENAI_IMAGE_MODEL` | `backend/.env` | OpenAI image model (default `gpt-image-1`) |
| `GEMINI_API_KEY` | `backend/.env` | Gemini secret key |
| `GEMINI_IMAGE_MODEL` | `backend/.env` | Gemini image model |
| `STABILITY_API_KEY` | `backend/.env` | Stability AI secret key |
| `HUGGINGFACE_API_KEY` | `backend/.env` | HuggingFace secret key |
| `HUGGINGFACE_IMAGE_MODEL` | `backend/.env` | HuggingFace model id |
| `REPLICATE_API_KEY` | `backend/.env` | Replicate secret key |
| `REPLICATE_IMAGE_MODEL` | `backend/.env` | Replicate model (`owner/model`) |
| `IMAGE_SIZE` | `backend/.env` | Image size (default `1024x1024`) |
| `DATABASE_URL` | `backend/.env` | PostgreSQL connection string |
| `CORS_ORIGINS` | `backend/.env` | Comma-separated allowed origins |
| `ENABLE_HTTPS_REDIRECT` | `backend/.env` | Set `true` only behind HTTPS |
| `VITE_API_BASE_URL` | frontend env | API base URL (default `http://localhost:8000`) |

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `OPENAI_API_KEY is not configured` (or another provider key) | `backend/.env` exists and the matching key is set; restart the API after editing |
| Database connection errors | Postgres is running; `DATABASE_URL` host is `localhost` locally and `db` in Docker |
| CORS / failed fetch in the browser | Frontend origin is listed in `CORS_ORIGINS` (default `http://localhost:5173`) |
| `docker compose` fails on missing env file | Copy `backend/.env.example` to `backend/.env` first |
| Image generation returns 4xx/502 | Key, billing, and model access on the selected provider account |

## License

No license file is published in this repository. All rights reserved unless the owner adds one.
