# AI-Image-Gen

Full-stack mono-repo for an **Artificial Intelligence Image Generator** built with FastAPI, Prisma/PostgreSQL, and Vite (Vanilla JS).

## Project Structure

- `/home/runner/work/AI-Image-Gen/AI-Image-Gen/backend` — FastAPI API + Prisma schema
- `/home/runner/work/AI-Image-Gen/AI-Image-Gen/frontend` — Vite frontend app
- `/home/runner/work/AI-Image-Gen/AI-Image-Gen/docker-compose.yml` — local orchestration for DB + backend + frontend

## Backend Setup

1. Copy `.env.example` to `.env` in `/home/runner/work/AI-Image-Gen/AI-Image-Gen/backend` and set values:
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Generate Prisma client and run migrations:
   ```bash
   prisma generate --schema backend/prisma/schema.prisma
   prisma db push --schema backend/prisma/schema.prisma
   ```
4. Start API:
   ```bash
   uvicorn backend.app.main:app --reload --port 8000
   ```

## Frontend Setup

1. Install dependencies:
   ```bash
   cd frontend && npm install
   ```
2. Start development server:
   ```bash
   npm run dev
   ```

The UI runs on `http://localhost:5173` and calls the backend at `http://localhost:8000` by default.

## API Endpoint

`POST /generate`

Request body:
```json
{ "prompt": "A cinematic view of mountains at dawn" }
```

Response body:
```json
{ "image_url": "https://..." }
```

## Run with Docker

```bash
docker compose up --build
```
