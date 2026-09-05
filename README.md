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
  <a href="https://platform.stability.ai/"><img src="https://img.shields.io/badge/Stability-Core-7C3AED?style=flat-square" alt="Stability AI" /></a>
  <a href="https://huggingface.co/"><img src="https://img.shields.io/badge/HuggingFace-Inference-FFD21E?style=flat-square&logo=huggingface&logoColor=black" alt="Hugging Face" /></a>
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

- [AI Image Generator](#ai-image-generator)
  - [Contents](#contents)
  - [How it works](#how-it-works)
    - [Overall system](#overall-system)
  - [Actors and use cases](#actors-and-use-cases)
  - [Class diagram](#class-diagram)
  - [ERD](#erd)
  - [Safety platform](#safety-platform)
    - [Layers (what is enforced)](#layers-what-is-enforced)
    - [Policy consents (account-level)](#policy-consents-account-level)
    - [Per-prompt attestations](#per-prompt-attestations)
    - [Automated prompt filter](#automated-prompt-filter)
    - [Retention and admin oversight](#retention-and-admin-oversight)
    - [Generation feedback (optional)](#generation-feedback-optional)
    - [Limits (document honestly)](#limits-document-honestly)
  - [Supported providers](#supported-providers)
  - [Prerequisites](#prerequisites)
  - [Run with Docker (recommended)](#run-with-docker-recommended)
  - [Run locally (without Docker)](#run-locally-without-docker)
    - [1. PostgreSQL](#1-postgresql)
    - [2. Backend](#2-backend)
    - [3. Frontend](#3-frontend)
  - [Seed accounts](#seed-accounts)
  - [API](#api)
    - [`POST /generate`](#post-generate)
  - [Project structure](#project-structure)
  - [Troubleshooting](#troubleshooting)

## How it works

### Overall system

Actors use the Vite UI. FastAPI is the only process that reads PostgreSQL and calls a cloud image API. Staff can use the studio and the admin console.

```mermaid
flowchart TB
    Guest([Guest])
    Member([Registered user])
    Staff([Moderator / Admin])

    subgraph FE["Vite frontend :5173"]
        AuthUI["Login · register · admin login"]
        Studio["Generate · gallery · guidelines · account · help"]
        AdminUI["Overview · users · generations · reports · auth events"]
    end

    subgraph API["FastAPI :8000"]
        AuthR["Auth router"]
        UserR["User / consent / gallery router"]
        GenR["Generate router"]
        AdminR["Admin router"]
        Gates{"Session · ACTIVE+18+ · policies · attestations"}
        Filter{"Safety filter"}
        Factory["Provider factory"]
    end

    PG[("PostgreSQL")]
    Cloud["OpenAI · Stability · Hugging Face"]

    Guest --> AuthUI
    Member --> Studio
    Staff --> AdminUI
    Staff --> Studio

    AuthUI -->|"POST /auth/*"| AuthR
    Studio -->|"/policies /me/*"| UserR
    Studio -->|"POST /generate + Bearer"| GenR
    AdminUI -->|"/admin/*"| AdminR

    AuthR --> PG
    UserR --> PG
    AdminR --> PG

    GenR --> Gates
    Gates -->|401 / 403 / 400| Studio
    Gates --> Filter
    Filter -->|blocked: write PromptLog| PG
    Filter -->|400 PROMPT_BLOCKED| Studio
    Filter -->|allowed| Factory
    Factory -->|"HTTPS + API key"| Cloud
    Cloud -->|image bytes / base64| Factory
    Factory -->|write PromptLog ALLOWED| PG
    Factory -->|JSON image_base64| Studio
```

Four tiers. The browser never calls a provider, and PostgreSQL never calls the cloud. The FastAPI process is the only hop that talks to both.

```mermaid
flowchart TD
    Client["<b>Client tier</b><br/>Vite frontend :5173<br/>login, guidelines, studio, gallery, admin"]
    Server["<b>Server tier</b><br/>FastAPI :8000<br/>Pydantic · bearer auth · consents<br/>attestations · safety filter<br/>provider factory · Prisma"]
    Database[("<b>Database tier</b><br/>PostgreSQL<br/>users, sessions, policies<br/>PromptLog, feedback, reports")]
    Cloud["<b>Cloud inference tier</b><br/>OpenAI · Stability · Hugging Face"]

    Client -->|"HTTP + Bearer token"| Server
    Server -->|"Prisma / SQL"| Database
    Database -->|"session, user, consents, logs"| Server
    Server -->|"HTTPS + provider API key"| Cloud
    Cloud -->|"image bytes / base64"| Server
    Server -->|"JSON image_base64"| Client
```

`POST /generate` fails closed at each gate. Blocked prompts are logged and never sent to a provider.

```mermaid
flowchart TD
    Req["POST /generate<br/>prompt, provider, attestations"] --> Auth{"Bearer session<br/>ACTIVE + 18+"}
    Auth -->|401 UNAUTHORIZED<br/>403 ACCOUNT_RESTRICTED| Err[JSON error to client]
    Auth --> Consents{"Latest Age gate, AUP,<br/>Privacy, Terms"}
    Consents -->|403 CONSENT_REQUIRED| Err
    Consents --> Attest{"Both attestations true"}
    Attest -->|400 ATTESTATION_REQUIRED| Err
    Attest --> Filter{"Prompt safety filter"}
    Filter -->|blocked| LogB["Write PromptLog<br/>safetyStatus = BLOCKED"]
    LogB --> Blocked["400 PROMPT_BLOCKED"]
    Filter -->|allowed| Factory[Provider factory]
    Factory --> Cloud["Selected provider API"]
    Cloud --> LogA["Write PromptLog<br/>safetyStatus = ALLOWED"]
    LogA --> Ok["200 image_base64"]
```

1. Sign in as a user (`#/login`) or admin (`#/admin/login`).
2. Accept the current **Age gate**, **Acceptable use**, **Privacy**, and **Terms** on `#/app/guidelines` (required before Generate).
3. Enter a prompt, pick a provider, and confirm the per-prompt ethical attestations in the studio.
4. The frontend `POST`s `{ "prompt", "provider", attestations }` to `/generate` with a bearer token.
5. The API re-checks auth, account status, policy consents, and attestations, then screens the prompt. Blocked text never reaches a provider.
6. The selected provider returns a 1024×1024 image as base64. A `PromptLog` row is stored against the user (with retention metadata).
7. The UI renders the image and saves it to **My gallery**.

## Actors and use cases

Primary actors sit on the left. The **image provider** is a secondary actor (OpenAI, Stability, or Hugging Face). `ADMIN` and `MODERATOR` are both staff; only an administrator can ban, reinstate, or change roles.

### Actors

| Actor | Kind | Who |
| :--- | :--- | :--- |
| **Guest** | Primary | Unauthenticated visitor (`#/login`, `#/register`, `#/admin/login`) |
| **Registered user** | Primary | Signed-in `USER` (studio, gallery, guidelines, account) |
| **Moderator** | Primary | Staff: review queues, warn / suspend, remove content. Cannot ban or change roles |
| **Administrator** | Primary | Staff plus ban, reinstate, and `PATCH /admin/users` role/status |
| **Image provider** | Secondary | External image API invoked only after all generate gates pass |

Staff can also use the studio (same generate path as a registered user).

### Use cases

| ID | Use case | Actor(s) | Notes |
| :--- | :--- | :--- | :--- |
| UC01 | Register account | Guest | Must confirm 18+ (`AGE_GATE`); creates `USER` + session |
| UC02 | Sign in | Guest | User or admin login form; same `/auth/login` |
| UC03 | Sign out | User, Moderator, Admin | Revokes bearer session |
| UC04 | View / update profile | User, Moderator, Admin | `#/app/account`, `PATCH /me` |
| UC05 | View help | User, Moderator, Admin | `#/app/help` |
| UC06 | Accept policies | User, Moderator, Admin | Age gate, AUP, Privacy, Terms — one-by-one |
| UC07 | Generate image | User, Moderator, Admin | `#/app/generate` → `POST /generate` |
| UC08 | Confirm attestations | *(included by UC07)* | `attested_ethical_use`, `attested_no_real_person_misuse` |
| UC09 | Screen prompt | *(included by UC07)* | Safety filter before any provider call |
| UC10 | Invoke image provider | UC07 + Image provider | Factory → OpenAI / Stability / Hugging Face |
| UC11 | Browse own gallery | User, Moderator, Admin | `#/app/gallery` |
| UC12 | Leave generation feedback | User, Moderator, Admin | Thumbs + tags; not an abuse report |
| UC13 | Report content | User, Moderator, Admin | `POST /me/reports` |
| UC14 | View overview / analytics | Moderator, Admin | `#/admin` stats and charts |
| UC15 | Search users | Moderator, Admin | `#/admin/users` |
| UC16 | Review generations | Moderator, Admin | `#/admin/generations` |
| UC17 | Review reports | Moderator, Admin | Open / under review / actioned / dismissed |
| UC18 | Apply moderation | Moderator, Admin | `WARN`, `SUSPEND`, `REMOVE_CONTENT` |
| UC19 | Ban or reinstate account | Admin | `BAN` / `REINSTATE` only |
| UC20 | Change user role or status | Admin | `PATCH /admin/users/{id}` |
| UC21 | View auth events | Moderator, Admin | Register / login / logout / failures |

**Include:** UC07 includes UC06 (must already be complete), UC08, UC09, and UC10.

**Extend:** UC19 and UC20 extend staff administration; only **Administrator** may perform them.

### Use-case diagram (studio)

```mermaid
flowchart LR
    Guest(["Guest"])
    Member(["Registered user"])
    Provider(["Image provider"])

    subgraph Studio["AI Image Generator — studio"]
        UC01((Register account))
        UC02((Sign in))
        UC03((Sign out))
        UC04((View / update profile))
        UC06((Accept policies))
        UC07((Generate image))
        UC08((Confirm attestations))
        UC09((Screen prompt))
        UC10((Invoke image provider))
        UC11((Browse own gallery))
        UC12((Leave feedback))
        UC13((Report content))
    end

    Guest --- UC01
    Guest --- UC02
    Member --- UC03
    Member --- UC04
    Member --- UC06
    Member --- UC07
    Member --- UC11
    Member --- UC12
    Member --- UC13
    UC07 -.->|<<include>>| UC06
    UC07 -.->|<<include>>| UC08
    UC07 -.->|<<include>>| UC09
    UC07 -.->|<<include>>| UC10
    UC10 --- Provider
```

### Use-case diagram (staff)

```mermaid
flowchart LR
    Mod(["Moderator"])
    Admin(["Administrator"])

    subgraph Staff["AI Image Generator — admin console"]
        UC14((View analytics))
        UC15((Search users))
        UC16((Review generations))
        UC17((Review reports))
        UC18((Apply moderation))
        UC19((Ban or reinstate))
        UC20((Change role or status))
        UC21((View auth events))
    end

    Mod --- UC14
    Mod --- UC15
    Mod --- UC16
    Mod --- UC17
    Mod --- UC18
    Mod --- UC21
    Admin --- UC14
    Admin --- UC15
    Admin --- UC16
    Admin --- UC17
    Admin --- UC18
    Admin --- UC19
    Admin --- UC20
    Admin --- UC21
    UC19 -.->|<<extend>>| UC18
```

## Class diagram

Two views: **domain** (Prisma / PostgreSQL) and **application** (FastAPI, safety, providers). There is no `image_url` entity — generations store `imageBase64` on `PromptLog`. `AuthSession` is the login session; `PromptLog.sessionId` is only the client `X-Session-Id` correlation id.

### Domain (Prisma)

```mermaid
classDiagram
    class User {
        +String id
        +String email
        +String passwordHash
        +String displayName
        +UserRole role
        +AccountStatus status
        +Boolean isAdult
        +DateTime ageAttestedAt
        +DateTime suspendedUntil
        +DateTime lastLoginAt
    }

    class AuthIdentity {
        +String id
        +String provider
        +String providerUserId
    }

    class AuthSession {
        +String id
        +String tokenHash
        +String ipAddress
        +DateTime expiresAt
        +DateTime revokedAt
    }

    class AuthEvent {
        +String id
        +AuthEventType type
        +String ipAddress
        +String metadata
    }

    class PolicyDocument {
        +String id
        +PolicyKind kind
        +String version
        +DateTime effectiveAt
        +String summary
    }

    class UserConsent {
        +String id
        +DateTime acceptedAt
        +String ipAddress
    }

    class PromptLog {
        +Int id
        +String sessionId
        +String promptText
        +String imageBase64
        +String provider
        +Int durationMs
        +String modelName
        +String imageSize
        +Boolean attestedEthicalUse
        +Boolean attestedNoRealPersonMisuse
        +SafetyStatus safetyStatus
        +String blockedReason
        +ViolationCategory violationCategory
        +DateTime retentionExpiresAt
    }

    class GenerationFeedback {
        +String id
        +FeedbackVerdict verdict
        +String[] tags
        +String remark
    }

    class ContentReport {
        +String id
        +ViolationCategory violationCategory
        +String details
        +ReportStatus status
    }

    class ModerationAction {
        +String id
        +ModerationActionType action
        +String reason
        +Int promptLogId
        +ViolationCategory violationCategory
    }

    User "1" --> "*" AuthIdentity
    User "1" --> "*" AuthSession
    User "0..1" --> "*" AuthEvent
    User "1" --> "*" UserConsent
    PolicyDocument "1" --> "*" UserConsent
    User "0..1" --> "*" PromptLog
    User "1" --> "*" GenerationFeedback
    PromptLog "1" --> "0..1" GenerationFeedback
    User "1" --> "*" ContentReport : reportsFiled
    PromptLog "1" --> "*" ContentReport
    User "1" --> "*" ModerationAction : target
    User "0..1" --> "*" ModerationAction : actor
```

### Application (FastAPI)

```mermaid
classDiagram
    class FastAPIApp {
        +lifespan()
        +GET /health
    }

    class AuthRouter {
        +POST /auth/register()
        +POST /auth/login()
        +POST /auth/logout()
        +GET /auth/me()
    }

    class UserRouter {
        +GET /policies()
        +GET /me/consents()
        +POST /me/consents()
        +GET /me/generations()
        +PUT /me/generations/id/feedback()
        +POST /me/reports()
        +PATCH /me()
    }

    class GenerateRouter {
        +POST /generate()
    }

    class AdminRouter {
        +GET /admin/stats()
        +GET /admin/analytics()
        +GET /admin/users()
        +PATCH /admin/users/id()
        +GET /admin/generations()
        +GET /admin/reports()
        +POST /admin/moderation()
        +GET /admin/events()
    }

    class Database {
        +Prisma client
        +connect()
        +disconnect()
    }

    class Settings {
        +String image_provider
        +String image_size
        +String openai_api_key
        +String stability_api_key
        +String huggingface_api_key
        +Int auth_session_days
    }

    class GenerateImageRequest {
        +String prompt
        +ProviderName provider
        +Boolean attested_ethical_use
        +Boolean attested_no_real_person_misuse
    }

    class GenerateImageResponse {
        +String image_base64
        +String provider
        +Int generation_id
        +Int duration_ms
        +String model
    }

    class PromptSafetyViolation {
        +String category
        +String reason
    }

    class PromptBlockedError {
        +Int status_code
        +String code
        +PromptSafetyViolation violation
    }

    class ImageProvider {
        <<interface>>
        +generate_image(prompt) dict
    }

    class OpenAIProvider {
        +generate_image(prompt) dict
    }

    class StabilityProvider {
        +generate_image(prompt) dict
    }

    class HuggingFaceProvider {
        +generate_image(prompt) dict
    }

    class ProviderFactory {
        +get_provider_module(name)
        +normalize_provider_name(name)
    }

    class ProviderError {
        +String provider
        +Int status_code
    }

    class ProviderConfigError
    class ProviderRuntimeError

    FastAPIApp --> AuthRouter
    FastAPIApp --> UserRouter
    FastAPIApp --> GenerateRouter
    FastAPIApp --> AdminRouter
    FastAPIApp --> Database
    FastAPIApp --> Settings
    GenerateRouter --> GenerateImageRequest
    GenerateRouter --> GenerateImageResponse
    GenerateRouter --> Database
    GenerateRouter --> PromptBlockedError
    GenerateRouter --> ProviderFactory
    PromptBlockedError --> PromptSafetyViolation
    ProviderFactory --> ImageProvider
    OpenAIProvider ..|> ImageProvider
    StabilityProvider ..|> ImageProvider
    HuggingFaceProvider ..|> ImageProvider
    ProviderConfigError --|> ProviderError
    ProviderRuntimeError --|> ProviderError
    OpenAIProvider --> Settings
    StabilityProvider --> Settings
    HuggingFaceProvider --> Settings
```

## ERD

PostgreSQL as modeled in `backend/prisma/schema.prisma`. Image bytes live on `PromptLog.imageBase64` — there is no separate Image table. `AuthSession` is the login session; `PromptLog.sessionId` is only the client `X-Session-Id` string (not a foreign key). `ModerationAction.promptLogId` is an optional logical reference (no Prisma `@relation`).

```mermaid
erDiagram
    User ||--o{ AuthIdentity : "has"
    User ||--o{ AuthSession : "has"
    User |o--o{ AuthEvent : "may have"
    User ||--o{ UserConsent : "accepts"
    PolicyDocument ||--o{ UserConsent : "accepted as"
    User |o--o{ PromptLog : "owns"
    User ||--o{ GenerationFeedback : "writes"
    PromptLog ||--o| GenerationFeedback : "has"
    User ||--o{ ContentReport : "files"
    PromptLog ||--o{ ContentReport : "reported as"
    User ||--o{ ModerationAction : "target"
    User |o--o{ ModerationAction : "actor"
    PromptLog |o--o{ ModerationAction : "optional"

    User {
        string id PK
        string email UK
        datetime emailVerifiedAt
        string passwordHash
        string displayName
        UserRole role
        AccountStatus status
        datetime suspendedUntil
        boolean isAdult
        datetime ageAttestedAt
        datetime createdAt
        datetime updatedAt
        datetime lastLoginAt
    }

    AuthIdentity {
        string id PK
        string userId FK
        string provider
        string providerUserId
        datetime createdAt
        datetime updatedAt
    }

    AuthSession {
        string id PK
        string userId FK
        string tokenHash UK
        string ipAddress
        string userAgent
        datetime expiresAt
        datetime revokedAt
        datetime createdAt
    }

    AuthEvent {
        string id PK
        string userId FK
        AuthEventType type
        string ipAddress
        string userAgent
        string metadata
        datetime createdAt
    }

    PolicyDocument {
        string id PK
        PolicyKind kind
        string version
        datetime effectiveAt
        string summary
        datetime createdAt
    }

    UserConsent {
        string id PK
        string userId FK
        string policyDocumentId FK
        datetime acceptedAt
        string ipAddress
    }

    PromptLog {
        int id PK
        string userId FK
        string sessionId
        string promptText
        string imageBase64
        string provider
        int durationMs
        string modelName
        string imageSize
        boolean attestedEthicalUse
        boolean attestedNoRealPersonMisuse
        SafetyStatus safetyStatus
        string safetyNotes
        string blockedReason
        ViolationCategory violationCategory
        datetime retentionExpiresAt
        datetime createdAt
        datetime updatedAt
    }

    GenerationFeedback {
        string id PK
        int promptLogId FK
        string userId FK
        FeedbackVerdict verdict
        string tags
        string remark
        datetime createdAt
        datetime updatedAt
    }

    ContentReport {
        string id PK
        int promptLogId FK
        string reporterId FK
        ViolationCategory violationCategory
        string details
        ReportStatus status
        datetime createdAt
        datetime updatedAt
    }

    ModerationAction {
        string id PK
        string targetUserId FK
        string actorId FK
        int promptLogId
        ModerationActionType action
        string reason
        ViolationCategory violationCategory
        datetime createdAt
    }
```

Unique composites: `AuthIdentity(provider, providerUserId)`, `PolicyDocument(kind, version)`, `UserConsent(userId, policyDocumentId)`, `GenerationFeedback.promptLogId`.

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
| OpenAI | `gpt-image-2` | `OPENAI_API_KEY` | [platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys) |
| Stability AI | Stable Image Core | `STABILITY_API_KEY` | [platform.stability.ai/account/keys](https://platform.stability.ai/account/keys) |
| HuggingFace | `black-forest-labs/FLUX.1-schnell` (via Inference Providers, e.g. fal-ai) | `HUGGINGFACE_API_KEY` | [tokens](https://huggingface.co/settings/tokens) + [provider settings](https://huggingface.co/settings/inference-providers) |

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

The UI uses hash routes: `#/login`, `#/admin/login`, `#/app/guidelines`, `#/app/generate`, `#/app/gallery`, `#/app/help`, `#/admin`.

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
- `provider` — optional: `openai` · `stability` · `huggingface` (defaults to `IMAGE_PROVIDER`)
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
AI-Image-Gen/
├── docker-compose.yml          Postgres + FastAPI + Vite
├── Dockerfile.backend
├── Dockerfile.frontend
├── README.md
│
├── backend/                    FastAPI API (port 8000)
│   ├── .env.example            Copy to .env; set at least one provider key
│   ├── requirements.txt
│   ├── prisma/
│   │   ├── schema.prisma       Users, sessions, policies, PromptLog, …
│   │   ├── seed.py             Admin/user accounts + policy documents
│   │   └── migrations/
│   ├── tests/
│   │   ├── test_safety.py
│   │   └── test_security.py
│   └── app/
│       ├── main.py             App, CORS, /health, mounts routers
│       ├── database.py         Prisma connection
│       ├── schemas.py          Pydantic request/response models
│       ├── deps.py             Bearer auth, staff, consent gates
│       ├── auth.py             Sessions, password, account checks
│       ├── security.py         Hashing helpers
│       ├── consent.py          Latest required policies
│       ├── safety.py           Prompt denylist (before any provider)
│       ├── models.py           create_prompt_log
│       ├── serializers.py      JSON shapes for UI/admin
│       ├── analytics.py        Admin charts
│       ├── utils.py            Settings / IMAGE_PROVIDER
│       ├── routes.py           POST /generate
│       ├── routes_auth.py      /auth/register, login, logout, me
│       ├── routes_user.py      /policies, /me/consents, gallery, reports
│       ├── routes_admin.py     /admin/stats, users, generations, …
│       └── providers/
│           ├── provider_factory.py
│           ├── openai_provider.py
│           ├── stability_provider.py
│           └── huggingface_provider.py
│
└── frontend/                   Vite + vanilla JS (port 5173)
    ├── index.html
    ├── main.js
    ├── style.css
    ├── vite.config.js
    └── src/
        ├── api.js              fetch + Bearer token
        ├── auth.js             localStorage session
        ├── router.js           Hash routes
        ├── layout.js           Nav shells
        ├── lightbox.js
        ├── feedback.js
        ├── charts.js
        └── views/
            ├── auth.js         Login / register / admin login
            ├── studio.js       Generate, gallery, guidelines, account
            ├── admin.js        Overview, users, generations, reports
            └── help.js
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


