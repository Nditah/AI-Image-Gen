# AI Image Generator

<p>
  <a href="https://github.com/Nditah/AI-Image-Gen/stargazers"><img src="https://img.shields.io/github/stars/Nditah/AI-Image-Gen?style=flat-square&logo=github" alt="GitHub stars" /></a>
  <a href="https://github.com/Nditah/AI-Image-Gen/issues"><img src="https://img.shields.io/github/issues/Nditah/AI-Image-Gen?style=flat-square" alt="GitHub issues" /></a>
  <a href="https://github.com/Nditah/AI-Image-Gen/commits/main"><img src="https://img.shields.io/github/last-commit/Nditah/AI-Image-Gen?style=flat-square" alt="GitHub last commit" /></a>
  <a href="https://github.com/Nditah/AI-Image-Gen"><img src="https://img.shields.io/github/languages/top/Nditah/AI-Image-Gen?style=flat-square" alt="GitHub top language" /></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" /></a>
  <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.116-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-0.15-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" /></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://docs.docker.com/compose/"><img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" /></a>
  <a href="https://platform.openai.com/docs/guides/images"><img src="https://img.shields.io/badge/OpenAI-GPT%20Image-412991?style=flat-square&logo=openai&logoColor=white" alt="OpenAI" /></a>
  <a href="https://ai.google.dev/"><img src="https://img.shields.io/badge/Gemini-Image-4285F4?style=flat-square&logo=googlegemini&logoColor=white" alt="Google Gemini" /></a>
  <a href="https://platform.stability.ai/"><img src="https://img.shields.io/badge/Stability-Core-7C3AED?style=flat-square" alt="Stability AI" /></a>
  <a href="https://huggingface.co/"><img src="https://img.shields.io/badge/HuggingFace-Inference-FFD21E?style=flat-square&logo=huggingface&logoColor=black" alt="Hugging Face" /></a>
  <a href="https://replicate.com/"><img src="https://img.shields.io/badge/Replicate-Flux-000000?style=flat-square" alt="Replicate" /></a>
  <a href="https://console.aws.amazon.com/bedrock/home"><img src="https://img.shields.io/badge/AWS-Bedrock-FF9900?style=flat-square&logo=amazonaws&logoColor=white" alt="AWS Bedrock" /></a>
  <a href="https://portal.azure.com"><img src="https://img.shields.io/badge/Azure-OpenAI-0078D4?style=flat-square&logo=microsoftazure&logoColor=white" alt="Azure OpenAI" /></a>
</p>

Turn a text prompt into an image. A Vite frontend talks to a FastAPI backend, which screens the prompt, calls the selected provider, and stores `sessionId`, prompt, base64 image, and provider in PostgreSQL via Prisma.

<p align="center">
  <a href="#run-with-docker-recommended"><strong>Quick start (Docker)</strong></a>
  &nbsp;·&nbsp;
  <a href="#run-locally-without-docker">Local setup</a>
  &nbsp;·&nbsp;
  <a href="#safety-platform">Safety</a>
  &nbsp;·&nbsp;
  <a href="#api">API</a>
  &nbsp;·&nbsp;
  <a href="http://localhost:8000/docs">OpenAPI docs</a>
</p>

---

## Contents

- [How it works](#how-it-works)
- [Safety platform](#safety-platform)
- [Supported providers](#supported-providers)
- [Prerequisites](#prerequisites)
- [Run with Docker](#run-with-docker-recommended)
- [Run locally](#run-locally-without-docker)
- [Seed accounts](#seed-accounts)
- [API](#api)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## How it works

```mermaid
flowchart LR
  A[Browser<br/>:5173] --> B[FastAPI<br/>:8000]
  B --> C{Auth + account}
  C -->|blocked| B
  C --> D{Policy consents}
  D -->|missing| B
  D --> E{Prompt attestations}
  E --> F[Safety filter]
  F -->|blocked| B
  F -->|allowed| G[Provider factory]
  G --> H[OpenAI / Gemini / Stability<br/>HuggingFace / Replicate<br/>Bedrock / Azure]
  B --> I[(PostgreSQL)]
```

1. Sign in as a user (`#/login`) or admin (`#/admin/login`).
2. Accept the current **Age gate**, **Acceptable use**, **Privacy**, and **Terms** on `#/app/guidelines` (required before Generate).
3. Enter a prompt, pick a provider, and confirm the per-prompt ethical attestations in the studio.
4. The frontend `POST`s `{ "prompt", "provider", attestations }` to `/generate` with a bearer token.
5. The API re-checks auth, account status, policy consents, and attestations, then screens the prompt. Blocked text never reaches a provider.
6. The selected provider returns a 1024×1024 image as base64. A `PromptLog` row is stored against the user (with retention metadata).
7. The UI renders the image and saves it to **My gallery**.

## Safety platform

This project is designed for **defense in depth**: consent and attestations are enforced on the server, prompts are screened before any provider call, and moderation artifacts are stored for review. Client-only checks are treated as UX helpers, not security boundaries.

### Layers (what is enforced)

| Layer | Where | What happens if it fails |
| :--- | :--- | :--- |
| **Authentication** | Bearer session on `/generate` | `401 UNAUTHORIZED` |
| **Account gate** | Active status + 18+ (`isAdult`) | `403 ACCOUNT_RESTRICTED` |
| **Policy consents** | Latest `AGE_GATE`, `ACCEPTABLE_USE`, `PRIVACY`, `TERMS_OF_SERVICE` | `403 CONSENT_REQUIRED` (Generate form disabled with link to Guidelines) |
| **Per-prompt attestations** | `attested_ethical_use`, `attested_no_real_person_misuse` | `400 ATTESTATION_REQUIRED` |
| **Prompt safety filter** | Denylist / category rules before provider call | `400 PROMPT_BLOCKED`; blocked attempt may be logged |
| **Provider policies** | Upstream model/API safety (varies by vendor) | Provider `4xx` / `502` |
| **Human review** | Admin generations, reports, moderation actions | Staff can warn / suspend / ban |
| **Generation feedback** | Optional thumbs + tags + remark on each result | Stored for evaluation; separate from abuse reports |

### Policy consents (account-level)

Versioned `PolicyDocument` rows are seeded by `python prisma/seed.py`. A user must accept the **latest effective** document for each required kind. Acceptances are stored as immutable `UserConsent` records (optional IP). Accepting the Age gate also sets `isAdult` / `ageAttestedAt`.

- UI: `#/app/generate` stays reachable but the form is **disabled** until consents are complete, with a status message and link to `#/app/guidelines`. Policies are accepted one-by-one (no bulk accept). The API still rejects `/generate` without consents.
- API: `GET /me/consents` returns `{ complete, required, missing, items }`; `POST /me/consents` records acceptance.
- Generate dependency: `require_consenting_user` fails closed if the four policy kinds are not seeded (`503 POLICIES_NOT_CONFIGURED`).

### Per-prompt attestations

Separate from account consents. Every `/generate` call must send both attestations as `true`. Values are persisted on `PromptLog` for auditability.

### Automated prompt filter

`backend/app/safety.py` runs **before** the provider factory. It does not claim perfect moderation (evasion and false positives are possible). Blocked prompts return a stable user-facing message and may be written with `safetyStatus=BLOCKED` for staff review.

### Retention and admin oversight

- Successful generations set `retentionExpiresAt` (default +30 days) as a data-minimization hook for later purge jobs.
- Admins can inspect generations, open reports, and apply moderation actions (`WARN`, `SUSPEND`, `BAN`, …).

### Generation feedback (optional)

After a successful generate (and again in **My gallery**), the owner can leave:

- **Verdict:** thumbs up / down (`UP` | `DOWN`)
- **Tags:** structured reasons (`accurate`, `creative`, `not_what_i_asked`, `low_quality`, `felt_unsafe`, `overblocked`, `slow`, `provider_issue`)
- **Remark:** optional free text (max 500 chars)

One `GenerationFeedback` row per generation (`PUT /me/generations/{id}/feedback`). This is **not** an abuse report — use `POST /me/reports` (or admin tools) for policy violations. Admin overview shows feedback counts; the generations table shows the owner’s verdict and tags.

Staff analytics (`GET /admin/analytics`, also on `#/admin`) chart provider usage (pie + bar), thumbs up/down overall and per provider, feedback reason tags, daily volume, safety status, and **provider latency** (avg / P50 / P95 ms) for a chosen date range (7 / 14 / 30 days, all time, or custom from/to).

Successful `/generate` calls store `durationMs` (provider wall-clock), `modelName`, and `imageSize` on `PromptLog`. Image APIs generally do not expose a text-model `temperature`, so that field is not logged.

### Limits (document honestly)

Consent + attestations + denylist reduce risk; they do **not** guarantee that every unsafe request is caught, nor do they replace legal counsel or production-grade CSAM classifiers. Treat provider-side filters as an extra layer, not the primary control.

## Supported providers

Set `IMAGE_PROVIDER` to one of the values below. The UI can override it per request. You need an API key for **at least one** provider — never commit real keys.

| Provider | Default model / API | Environment variable | API key / console |
| :--- | :--- | :--- | :--- |
| OpenAI | `gpt-image-1` | `OPENAI_API_KEY` | [platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys) |
| Gemini | `gemini-2.0-flash-preview-image-generation` | `GEMINI_API_KEY` | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| Stability AI | Stable Image Core | `STABILITY_API_KEY` | [platform.stability.ai/account/keys](https://platform.stability.ai/account/keys) |
| HuggingFace | `stabilityai/stable-diffusion-xl-base-1.0` | `HUGGINGFACE_API_KEY` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |
| Replicate | `black-forest-labs/flux-schnell` | `REPLICATE_API_KEY` | [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) |
| AWS Bedrock | `amazon.titan-image-generator-v2:0` | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | [console.aws.amazon.com/bedrock](https://console.aws.amazon.com/bedrock/home) |
| Azure OpenAI | deployment `gpt-image-1` | `AZURE_OPENAI_API_KEY` / `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_DEPLOYMENT` | [portal.azure.com](https://portal.azure.com) (Azure OpenAI Service) |

## Prerequisites

| Path | Requirements |
| :--- | :--- |
| **Docker** (recommended) | [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine + Compose v2 |
| **Local** | Python **3.11+**, Node.js **20+**, PostgreSQL **16**, `pip` |

## Run with Docker (recommended)

Starts PostgreSQL, the API on port **8000**, and the UI on port **5173**.

```bash
git clone https://github.com/Nditah/AI-Image-Gen.git
cd AI-Image-Gen
cp backend/.env.example backend/.env
```

Add at least one provider key in `backend/.env` and set `IMAGE_PROVIDER` to match:

```env
IMAGE_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Leave `DATABASE_URL` as-is. Compose overrides it so the API talks to the `db` service.

Stop any stack that is already running (safe if nothing is up), then rebuild and start:

```bash
docker compose down
docker compose up --build
```

On first run (or after schema changes), apply the schema and seed accounts:

```bash
docker compose exec backend prisma db push --schema prisma/schema.prisma
docker compose exec backend python prisma/seed.py
```

| Service | URL |
| :--- | :--- |
| Frontend | http://localhost:5173 |
| API | http://localhost:8000 |
| OpenAPI docs | http://localhost:8000/docs |
| Health | http://localhost:8000/health |

Stop with `Ctrl+C` or `docker compose down`. Add `-v` to drop the Postgres volume.

## Run locally (without Docker)

### 1. PostgreSQL

```bash
createdb ai_image_gen
```

Or start only the database container:

```bash
docker compose up db -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
```

Set at least:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_image_gen"
IMAGE_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
CORS_ORIGINS="http://localhost:5173"
ENABLE_HTTPS_REDIRECT="false"
```

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
prisma generate --schema prisma/schema.prisma
prisma db push --schema prisma/schema.prisma
python prisma/seed.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

From the repo root instead:

```bash
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

Confirm http://localhost:8000/health returns `{"status":"ok"}`.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173 (calls http://localhost:8000 by default).

Optional `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Seed accounts

From `backend/`, `python prisma/seed.py` creates or **updates** these accounts and resets their passwords. Local/dev only.

| Role | Email | Password |
| :--- | :--- | :--- |
| `ADMIN` | `admin@ai-image-gen.local` | `Admin123!` |
| `USER` | `ada@ai-image-gen.local` | `User123!` |
| `USER` | `linus@ai-image-gen.local` | `User123!` |
| `USER` | `nicholas@ai-image-gen.local` | `User123!` |

Override with `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD`. Seed users still must **accept policies** on Guidelines before Generate (consents are not auto-granted).

## API

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Liveness check |
| `POST` | `/auth/register` | Create a user account |
| `POST` | `/auth/login` | Sign in (returns a bearer token) |
| `POST` | `/auth/logout` | Revoke the current session |
| `GET` | `/auth/me` | Current user |
| `GET` | `/policies` | Latest policy documents |
| `GET` | `/me/consents` | Consent status (`complete`, `required`, `missing`) |
| `POST` | `/me/consents` | Accept a policy document |
| `POST` | `/generate` | Generate an image (auth + consents + attestations) |
| `GET` | `/me/generations` | The signed-in user's gallery (includes feedback when present) |
| `PUT` | `/me/generations/{id}/feedback` | Upsert thumbs + tags + remark for a generation |
| `GET` | `/admin/stats` | Admin overview counts |
| `GET` | `/admin/analytics` | Date-ranged provider usage + satisfaction chart data |

Interactive docs: http://localhost:8000/docs

The UI uses hash routes: `#/login`, `#/admin/login`, `#/app/guidelines`, `#/app/generate`, `#/admin`.

### `POST /generate`

Requires `Authorization: Bearer <token>`, an **ACTIVE** adult account, acceptance of the **latest required policies**, and both ethical attestations. Prompts are screened **before** any provider call.

| Code | HTTP | Meaning |
| :--- | :--- | :--- |
| `UNAUTHORIZED` | 401 | Missing or expired session |
| `ACCOUNT_RESTRICTED` | 403 | Banned, suspended, not adult, or inactive |
| `CONSENT_REQUIRED` | 403 | Missing one or more current policy acceptances |
| `ATTESTATION_REQUIRED` | 400 | Per-prompt checkboxes not both `true` |
| `PROMPT_BLOCKED` | 400 | Safety filter rejected the prompt |
| `POLICIES_NOT_CONFIGURED` | 503 | Seed policy documents before generating |

Optional header: `X-Session-Id` (a UUID is created if omitted).

```bash
TOKEN=$(curl -s http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@ai-image-gen.local","password":"User123!"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')

# Accept each required policy (ids from GET /me/consents → required[].id), then:
curl -s http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prompt":"A cinematic view of mountains at dawn","provider":"openai","attested_ethical_use":true,"attested_no_real_person_misuse":true}'
```

<details>
<summary><strong>Request</strong></summary>

```json
{
  "prompt": "A cinematic view of mountains at dawn",
  "provider": "openai",
  "attested_ethical_use": true,
  "attested_no_real_person_misuse": true
}
```

- `prompt` — required, 3–1000 characters
- `provider` — optional: `openai` · `gemini` · `stability` · `huggingface` · `replicate` · `bedrock` · `azure` (defaults to `IMAGE_PROVIDER`)
- `attested_ethical_use` / `attested_no_real_person_misuse` — required `true`
- Header `Authorization: Bearer <token>` — required

</details>

<details>
<summary><strong>Success</strong></summary>

```json
{
  "image_base64": "iVBORw0KGgo...",
  "provider": "openai"
}
```

</details>

<details>
<summary><strong>Consent required</strong></summary>

```json
{
  "error": "Accept the current Age gate, Acceptable use, Privacy, and Terms policies before generating.",
  "code": "CONSENT_REQUIRED",
  "missing": [
    { "id": "...", "kind": "ACCEPTABLE_USE", "version": "1.0" }
  ]
}
```

</details>

<details>
<summary><strong>Blocked prompt</strong></summary>

```json
{
  "error": "This prompt was blocked by the content safety filter.",
  "provider": "openai",
  "code": "PROMPT_BLOCKED"
}
```

</details>

## Project structure

```text
.
├── backend/                 FastAPI app, Prisma schema, seed script
│   ├── app/                 Routes, providers, consent + safety gates
│   ├── prisma/              schema.prisma, migrations, seed.py
│   └── .env.example
├── frontend/                Vite + vanilla JS UI
├── Dockerfile.backend
├── Dockerfile.frontend
└── docker-compose.yml       Postgres + API + UI
```

## Troubleshooting

| Symptom | What to check |
| :--- | :--- |
| `OPENAI_API_KEY is not configured` | `backend/.env` exists; matching key is set; restart the API |
| Database connection errors | Postgres is up; host is `localhost` locally and `db` in Docker |
| Prisma / `User` client errors | Run `prisma generate` and `prisma db push` after schema changes |
| CORS / failed fetch | Origin listed in `CORS_ORIGINS` (default `http://localhost:5173`) |
| Compose fails on missing env | Copy `backend/.env.example` to `backend/.env` first |
| Generation returns 4xx / 502 | Provider key, billing, and model access |
| Generate form disabled / `CONSENT_REQUIRED` | Accept each required policy on `#/app/guidelines`, then return to Generate |
| `POLICIES_NOT_CONFIGURED` | Run `python prisma/seed.py` so Age/AUP/Privacy/Terms exist |
| `PROMPT_BLOCKED` | Safety filter rejected the prompt before a provider was called |
